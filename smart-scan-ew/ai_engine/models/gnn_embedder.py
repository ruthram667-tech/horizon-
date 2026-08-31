"""
Smart Scan EW — GNN Embedder
==============================
2-layer Graph Attention Network (GAT) using PyTorch Geometric.
Produces per-channel node embeddings that encode relational spectrum state:
spectral adjacency, observed hop transitions, and per-channel features.
"""

import torch
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
    2-layer Graph Attention Network for spectrum state encoding.
    
    Architecture:
        Input:  Data(x=[N, 4], edge_index=[2, E])
                Node features: [latest_rssi, dwell_time, duty_cycle, detection_prob]
        Layer1: GATConv(4 → 32, heads=4) → ELU → Dropout(0.3)   # output: [N, 128]
        Layer2: GATConv(128 → 32, heads=1, concat=False)          # output: [N, 32]
    
    Outputs [N, 32] node embeddings representing relational spectrum states.
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

        # Layer 1: Multi-head GAT
        # Input: [N, in_channels=4]
        # Output: [N, hidden_channels * heads = 32 * 4 = 128]
        self.conv1 = GATConv(
            in_channels,
            hidden_channels,
            heads=heads,
            dropout=dropout,
            concat=True,
        )

        # Layer 2: Single-head GAT (aggregation)
        # Input: [N, hidden_channels * heads = 128]
        # Output: [N, out_channels = 32]
        self.conv2 = GATConv(
            hidden_channels * heads,
            out_channels,
            heads=1,
            concat=False,
            dropout=dropout,
        )

    def forward(self, data) -> torch.Tensor:
        """
        Forward pass through the GAT.
        
        Args:
            data: PyG Data object with x=[N, 4] and edge_index=[2, E]
            
        Returns:
            Node embeddings of shape [N, out_channels]
        """
        x, edge_index = data.x, data.edge_index

        # Layer 1
        x = F.dropout(x, p=self.dropout, training=self.training)
        x = self.conv1(x, edge_index)
        x = F.elu(x)

        # Layer 2
        x = F.dropout(x, p=self.dropout, training=self.training)
        x = self.conv2(x, edge_index)

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

    # 1. Spectral adjacency edges (channels within ±2 of each other)
    for i in range(num_channels):
        for offset in [-2, -1, 1, 2]:
            j = i + offset
            if 0 <= j < num_channels:
                edges_src.append(i)
                edges_dst.append(j)

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

    # Add self-loops
    for i in range(num_channels):
        edges_src.append(i)
        edges_dst.append(i)

    edge_index = torch.tensor([edges_src, edges_dst], dtype=torch.long)
    x = torch.tensor(node_features, dtype=torch.float32)

    return Data(x=x, edge_index=edge_index)


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
