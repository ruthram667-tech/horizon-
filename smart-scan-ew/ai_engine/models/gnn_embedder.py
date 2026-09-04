"""
Smart Scan EW — GNN Embedder (Enhanced)
=========================================
2-layer Graph Attention Network (GAT) with:
- Skip connections (residual)
- Layer normalization
- Edge attention weights from transition probabilities
Produces per-channel node embeddings for RL policy consumption.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from typing import Optional, Tuple

try:
    from torch_geometric.nn import GATConv
    from torch_geometric.data import Data
    HAS_PYG = True
except ImportError:
    HAS_PYG = False

import sys
sys.path.insert(0, '..')
from backend.app.config import (
    GNN_INPUT_DIM, GNN_HIDDEN_DIM, GNN_HEADS,
    GNN_OUTPUT_DIM, GNN_DROPOUT, NUM_CHANNELS,
)


class GNNEmbedder(torch.nn.Module):
    """
    Enhanced 2-layer GAT with skip connections and layer normalization.

    Architecture:
        Input:  Data(x=[N, 4], edge_index=[2, E], edge_attr=[E, 1])
        Proj:   Linear(4 → 128) — project input to hidden dimension
        Layer1: GATConv(128 → 32, heads=4) + LayerNorm + ELU + Skip
        Layer2: GATConv(128 → 32, heads=1) + LayerNorm + Skip
        Output: [N, 32] node embeddings
    """

    def __init__(
        self,
        in_channels: int = GNN_INPUT_DIM,
        hidden_channels: int = GNN_HIDDEN_DIM,
        out_channels: int = GNN_OUTPUT_DIM,
        heads: int = GNN_HEADS,
        dropout: float = GNN_DROPOUT,
    ):
        super().__init__()

        if not HAS_PYG:
            raise ImportError(
                "torch_geometric is required for GNNEmbedder. "
                "Install with: pip install torch-geometric"
            )

        self.dropout = dropout
        self.hidden_dim = hidden_channels * heads  # 32 * 4 = 128

        # Input projection: [N, 4] → [N, 128]
        self.input_proj = nn.Sequential(
            nn.Linear(in_channels, self.hidden_dim),
            nn.ELU(),
        )

        # Layer 1: Multi-head GAT with skip connection
        self.conv1 = GATConv(
            self.hidden_dim,
            hidden_channels,
            heads=heads,
            dropout=dropout,
            concat=True,
        )
        self.norm1 = nn.LayerNorm(self.hidden_dim)

        # Layer 2: Single-head GAT with skip connection
        self.conv2 = GATConv(
            self.hidden_dim,
            out_channels,
            heads=1,
            concat=False,
            dropout=dropout,
        )
        self.norm2 = nn.LayerNorm(out_channels)

        # Skip projection for layer 2 (128 → 32)
        self.skip_proj = nn.Linear(self.hidden_dim, out_channels)

    def forward(self, data) -> torch.Tensor:
        """
        Forward pass through the enhanced GAT.

        Args:
            data: PyG Data with x=[N, 4] and edge_index=[2, E]

        Returns:
            Node embeddings [N, out_channels=32]
        """
        x, edge_index = data.x, data.edge_index

        # Input projection
        x = self.input_proj(x)  # [N, 128]
        residual = x

        # Layer 1 + skip connection
        x = F.dropout(x, p=self.dropout, training=self.training)
        x = self.conv1(x, edge_index)  # [N, 128]
        x = self.norm1(x + residual)   # Skip connection
        x = F.elu(x)

        # Layer 2 + skip connection
        residual2 = self.skip_proj(x)  # [N, 32]
        x = F.dropout(x, p=self.dropout, training=self.training)
        x = self.conv2(x, edge_index)  # [N, 32]
        x = self.norm2(x + residual2)  # Skip connection

        return x


def build_graph(
    node_features: np.ndarray,
    num_channels: int = NUM_CHANNELS,
    observed_transitions: Optional[np.ndarray] = None,
    transition_threshold: float = 0.01,
) -> 'Data':
    """
    Construct a PyG Data object from channel features and adjacency info.

    Edges come from two sources:
    1. Spectral adjacency: neighboring channels are always connected (±1, ±2)
    2. Observed hop transitions: non-adjacent channels connected if
       transition count exceeds threshold

    Args:
        node_features: [N, 4] array of per-channel features
        num_channels: Number of frequency channels
        observed_transitions: [N, N] matrix of hop transition counts (optional)
        transition_threshold: Minimum normalized transition prob to create edge

    Returns:
        PyG Data object ready for GNN forward pass
    """
    if not HAS_PYG:
        raise ImportError("torch_geometric required")

    edges_src = []
    edges_dst = []
    edge_weights = []

    # 1. Spectral adjacency edges (channels within ±2 of each other)
    for i in range(num_channels):
        for offset in [-2, -1, 1, 2]:
            j = i + offset
            if 0 <= j < num_channels:
                edges_src.append(i)
                edges_dst.append(j)
                # Weight by proximity
                edge_weights.append(1.0 / abs(offset))

    # 2. Observed transition edges (from hop history)
    if observed_transitions is not None:
        # Normalize rows
        row_sums = observed_transitions.sum(axis=1, keepdims=True)
        row_sums = np.where(row_sums == 0, 1, row_sums)  # avoid div-by-zero
        normalized = observed_transitions / row_sums

        for i in range(num_channels):
            for j in range(num_channels):
                if i != j and abs(i - j) > 2:  # Skip already-added adjacency
                    if normalized[i, j] > transition_threshold:
                        edges_src.append(i)
                        edges_dst.append(j)
                        edge_weights.append(float(normalized[i, j]))

    # Add self-loops
    for i in range(num_channels):
        edges_src.append(i)
        edges_dst.append(i)
        edge_weights.append(1.0)

    edge_index = torch.tensor([edges_src, edges_dst], dtype=torch.long)
    x = torch.tensor(node_features, dtype=torch.float32)
    edge_attr = torch.tensor(edge_weights, dtype=torch.float32).unsqueeze(1)

    return Data(x=x, edge_index=edge_index, edge_attr=edge_attr)


class GNNInference:
    """
    Convenience wrapper for inference-time GNN usage.
    Handles model loading, graph construction, and embedding extraction.
    """

    def __init__(self, model_path: Optional[str] = None, num_channels: int = NUM_CHANNELS):
        self.num_channels = num_channels
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = GNNEmbedder().to(self.device)
        self.model.eval()

        if model_path is not None:
            self.model.load_state_dict(torch.load(model_path, map_location=self.device))

    @torch.no_grad()
    def get_embeddings(
        self,
        node_features: np.ndarray,
        observed_transitions: Optional[np.ndarray] = None,
    ) -> np.ndarray:
        """
        Get node embeddings from current spectrum state.

        Returns:
            np.ndarray of shape [N, 32]
        """
        graph = build_graph(
            node_features,
            self.num_channels,
            observed_transitions,
        )
        graph = graph.to(self.device)
        embeddings = self.model(graph)
        return embeddings.cpu().numpy()
