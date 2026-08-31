"""
Smart Scan EW — Training Pipeline
===================================
Trains the DQN agent on the synthetic spectrum scanning environment.
Supports both native PyTorch DQN and Stable-Baselines3 DQN/PPO.

Usage:
    python train.py --timesteps 100000 --algo dqn
    python train.py --timesteps 50000 --algo sb3-dqn
    python train.py --timesteps 50000 --algo sb3-ppo
"""

import argparse
import os
import sys
import time
import numpy as np

# Add paths
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.config import NUM_CHANNELS, GNN_OUTPUT_DIM, EPISODE_LENGTH


def train_native_dqn(timesteps: int, num_channels: int, num_emitters: int, save_dir: str):
    """Train using native PyTorch DQN implementation."""
    from env.spectrum_env import SpectrumScanEnv
    from models.rl_policy import DQNAgent

    print("=" * 60)
    print("  Smart Scan EW — Native DQN Training")
    print("=" * 60)
    print(f"  Channels:   {num_channels}")
    print(f"  Emitters:   {num_emitters}")
    print(f"  Timesteps:  {timesteps}")
    print(f"  Save dir:   {save_dir}")
    print("=" * 60)

    env = SpectrumScanEnv(
        num_channels=num_channels,
        num_emitters=num_emitters,
        use_gnn=False,  # Disable GNN during initial training for speed
    )
    agent = DQNAgent(num_channels=num_channels, embedding_dim=GNN_OUTPUT_DIM)

    os.makedirs(save_dir, exist_ok=True)
    best_episode_reward = -float('inf')

    obs, info = env.reset()
    episode_reward = 0.0
    episode_count = 0
    episode_hits = 0
    episode_start = time.time()

    rewards_history = []
    pd_history = []

    for step in range(1, timesteps + 1):
        action = agent.select_action(obs)
        next_obs, reward, terminated, truncated, info = env.step(action)

        done = terminated or truncated
        agent.store_transition(obs, action, reward, next_obs, done)

        loss = agent.train_step()

        episode_reward += reward
        if info.get("is_hit", False):
            episode_hits += 1

        obs = next_obs

        if done:
            episode_count += 1
            elapsed = time.time() - episode_start
            pd_val = info.get("pd", 0.0)

            rewards_history.append(episode_reward)
            pd_history.append(pd_val)

            # Log every episode
            avg_reward_10 = np.mean(rewards_history[-10:]) if rewards_history else 0
            print(
                f"  Episode {episode_count:4d} | "
                f"Steps {step:7d}/{timesteps} | "
                f"Reward {episode_reward:8.1f} | "
                f"Avg10 {avg_reward_10:8.1f} | "
                f"Pd {pd_val:.3f} | "
                f"Hits {episode_hits:3d} | "
                f"ε {agent.epsilon:.3f} | "
                f"Time {elapsed:.1f}s"
            )

            # Save best model
            if episode_reward > best_episode_reward:
                best_episode_reward = episode_reward
                agent.save(os.path.join(save_dir, "best_model.pt"))

            # Reset
            obs, info = env.reset()
            episode_reward = 0.0
            episode_hits = 0
            episode_start = time.time()

        # Periodic save
        if step % 10000 == 0:
            agent.save(os.path.join(save_dir, f"checkpoint_{step}.pt"))

    # Final save
    agent.save(os.path.join(save_dir, "final_model.pt"))
    print("\n" + "=" * 60)
    print(f"  Training complete! Best reward: {best_episode_reward:.1f}")
    print(f"  Models saved to: {save_dir}")
    print("=" * 60)

    return agent


def train_sb3(timesteps: int, algo: str, num_channels: int, num_emitters: int, save_dir: str):
    """Train using Stable-Baselines3 (DQN or PPO)."""
    try:
        from stable_baselines3 import DQN, PPO
        from stable_baselines3.common.env_checker import check_env
        from stable_baselines3.common.callbacks import EvalCallback
    except ImportError:
        print("ERROR: stable-baselines3 not installed. Use --algo dqn for native training.")
        print("  Install with: pip install stable-baselines3")
        return None

    from env.spectrum_env import SpectrumScanEnv

    print("=" * 60)
    print(f"  Smart Scan EW — SB3 {algo.upper()} Training")
    print("=" * 60)

    env = SpectrumScanEnv(
        num_channels=num_channels,
        num_emitters=num_emitters,
        use_gnn=False,
    )

    # Validate environment
    print("  Checking environment...")
    check_env(env, warn=True)
    print("  Environment check passed ✓")

    os.makedirs(save_dir, exist_ok=True)

    # Create model
    if algo == "sb3-dqn":
        model = DQN(
            "MlpPolicy", env,
            learning_rate=1e-3,
            buffer_size=50_000,
            batch_size=64,
            gamma=0.99,
            exploration_fraction=0.3,
            exploration_final_eps=0.05,
            verbose=1,
        )
    elif algo == "sb3-ppo":
        model = PPO(
            "MlpPolicy", env,
            learning_rate=3e-4,
            n_steps=2048,
            batch_size=64,
            n_epochs=10,
            gamma=0.99,
            verbose=1,
        )
    else:
        raise ValueError(f"Unknown SB3 algo: {algo}")

    # Train
    eval_callback = EvalCallback(
        env,
        best_model_save_path=save_dir,
        eval_freq=5000,
        n_eval_episodes=5,
        verbose=1,
    )
    model.learn(total_timesteps=timesteps, callback=eval_callback)

    # Save
    model.save(os.path.join(save_dir, "final_model"))
    print(f"\n  Model saved to: {save_dir}")

    return model


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Smart Scan EW — Training Pipeline")
    parser.add_argument("--timesteps", type=int, default=100_000, help="Total training timesteps")
    parser.add_argument("--algo", type=str, default="dqn",
                        choices=["dqn", "sb3-dqn", "sb3-ppo"],
                        help="Training algorithm")
    parser.add_argument("--channels", type=int, default=NUM_CHANNELS, help="Number of channels")
    parser.add_argument("--emitters", type=int, default=2, help="Number of FHSS emitters")
    parser.add_argument("--save-dir", type=str, default="checkpoints", help="Model save directory")

    args = parser.parse_args()

    if args.algo == "dqn":
        train_native_dqn(args.timesteps, args.channels, args.emitters, args.save_dir)
    else:
        train_sb3(args.timesteps, args.algo, args.channels, args.emitters, args.save_dir)
