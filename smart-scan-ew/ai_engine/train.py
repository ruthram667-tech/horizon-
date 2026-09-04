"""
Smart Scan EW — Training Pipeline (Enhanced)
===============================================
Trains the DQN agent on the synthetic spectrum scanning environment.

Enhanced with:
- TensorBoard logging
- Checkpoint management (keep top-K models)
- Periodic evaluation episodes
- Training curve plotting
- Resume from checkpoint support
- Curriculum learning

Usage:
    python train.py --timesteps 100000 --algo dqn
    python train.py --timesteps 50000 --algo sb3-dqn
    python train.py --timesteps 100000 --algo dqn --curriculum
    python train.py --timesteps 100000 --algo dqn --resume checkpoints/checkpoint_50000.pt
"""

import argparse
import os
import sys
import time
import json
import numpy as np
from collections import deque

# Add paths
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.config import NUM_CHANNELS, GNN_OUTPUT_DIM, EPISODE_LENGTH


def train_native_dqn(
    timesteps: int,
    num_channels: int,
    num_emitters: int,
    save_dir: str,
    resume_path: str = None,
    use_curriculum: bool = False,
    use_dueling: bool = True,
    use_prioritized: bool = True,
):
    """Train using enhanced native PyTorch DQN."""
    from env.spectrum_env import SpectrumScanEnv
    from models.rl_policy import DQNAgent

    # Optional TensorBoard
    try:
        from torch.utils.tensorboard import SummaryWriter
        tb_dir = os.path.join(save_dir, "tensorboard")
        os.makedirs(tb_dir, exist_ok=True)
        writer = SummaryWriter(tb_dir)
        has_tb = True
    except ImportError:
        writer = None
        has_tb = False

    print("=" * 60)
    print("  Smart Scan EW — Enhanced DQN Training")
    print("=" * 60)
    print(f"  Channels:     {num_channels}")
    print(f"  Emitters:     {num_emitters}")
    print(f"  Timesteps:    {timesteps}")
    print(f"  Dueling:      {use_dueling}")
    print(f"  Prioritized:  {use_prioritized}")
    print(f"  Curriculum:   {use_curriculum}")
    print(f"  TensorBoard:  {'Yes → ' + tb_dir if has_tb else 'No (install tensorboard)'}")
    print(f"  Save dir:     {save_dir}")
    if resume_path:
        print(f"  Resume from:  {resume_path}")
    print("=" * 60)

    # Create environment
    env = SpectrumScanEnv(
        num_channels=num_channels,
        num_emitters=num_emitters,
        use_gnn=False,
        curriculum=use_curriculum,
        normalize_obs=True,
    )

    # Create evaluation environment
    eval_env = SpectrumScanEnv(
        num_channels=num_channels,
        num_emitters=num_emitters,
        use_gnn=False,
        curriculum=False,
        normalize_obs=False,
    )

    # Create agent
    agent = DQNAgent(
        num_channels=num_channels,
        embedding_dim=GNN_OUTPUT_DIM,
        use_dueling=use_dueling,
        use_prioritized=use_prioritized,
    )

    # Resume from checkpoint
    start_step = 0
    if resume_path and os.path.exists(resume_path):
        try:
            agent.load(resume_path)
            print(f"  ✓ Resumed from {resume_path} (ε={agent.epsilon:.3f})")
        except Exception as e:
            print(f"  ⚠ Could not resume: {e}")

    os.makedirs(save_dir, exist_ok=True)

    # Training tracking
    best_episode_reward = -float('inf')
    top_k_models = []  # (reward, path) tuples, keep top 5
    K = 5

    obs, info = env.reset()
    episode_reward = 0.0
    episode_count = 0
    episode_hits = 0
    episode_start = time.time()

    rewards_history = deque(maxlen=100)
    pd_history = deque(maxlen=100)
    loss_history = deque(maxlen=100)

    # Training metrics for saving
    training_log = []

    for step in range(1, timesteps + 1):
        action = agent.select_action(obs)
        next_obs, reward, terminated, truncated, info = env.step(action)

        done = terminated or truncated
        agent.store_transition(obs, action, reward, next_obs, done)

        loss = agent.train_step()
        if loss is not None:
            loss_history.append(loss)

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

            avg_reward_10 = np.mean(list(rewards_history)[-10:]) if rewards_history else 0
            avg_reward_100 = np.mean(list(rewards_history)) if rewards_history else 0
            avg_loss = np.mean(list(loss_history)) if loss_history else 0

            # Log to console
            print(
                f"  Ep {episode_count:4d} | "
                f"Step {step:7d}/{timesteps} | "
                f"Rwd {episode_reward:8.1f} | "
                f"Avg10 {avg_reward_10:8.1f} | "
                f"Pd {pd_val:.3f} | "
                f"Hits {episode_hits:3d} | "
                f"ε {agent.epsilon:.3f} | "
                f"Loss {avg_loss:.4f} | "
                f"{elapsed:.1f}s"
            )

            # TensorBoard logging
            if writer:
                writer.add_scalar("reward/episode", episode_reward, step)
                writer.add_scalar("reward/avg_10", avg_reward_10, step)
                writer.add_scalar("reward/avg_100", avg_reward_100, step)
                writer.add_scalar("metrics/pd", pd_val, step)
                writer.add_scalar("metrics/hits", episode_hits, step)
                writer.add_scalar("agent/epsilon", agent.epsilon, step)
                writer.add_scalar("agent/loss", avg_loss, step)
                writer.add_scalar("agent/lr", agent.optimizer.param_groups[0]['lr'], step)

            # Save training log entry
            training_log.append({
                "episode": episode_count,
                "step": step,
                "reward": round(episode_reward, 2),
                "avg_reward_10": round(avg_reward_10, 2),
                "pd": round(pd_val, 4),
                "hits": episode_hits,
                "epsilon": round(agent.epsilon, 4),
            })

            # Save best model
            if episode_reward > best_episode_reward:
                best_episode_reward = episode_reward
                best_path = os.path.join(save_dir, "best_model.pt")
                agent.save(best_path)

            # Top-K model tracking
            model_path = os.path.join(save_dir, f"top_ep{episode_count}.pt")
            if len(top_k_models) < K:
                agent.save(model_path)
                top_k_models.append((episode_reward, model_path))
                top_k_models.sort(key=lambda x: x[0], reverse=True)
            elif episode_reward > top_k_models[-1][0]:
                # Remove worst model
                _, worst_path = top_k_models.pop()
                if os.path.exists(worst_path):
                    os.remove(worst_path)
                agent.save(model_path)
                top_k_models.append((episode_reward, model_path))
                top_k_models.sort(key=lambda x: x[0], reverse=True)

            # Reset
            obs, info = env.reset()
            episode_reward = 0.0
            episode_hits = 0
            episode_start = time.time()

        # Periodic checkpoint
        if step % 10000 == 0:
            ckpt_path = os.path.join(save_dir, f"checkpoint_{step}.pt")
            agent.save(ckpt_path)

            # Run evaluation
            eval_rewards = []
            eval_pds = []
            for _ in range(5):
                eval_obs, _ = eval_env.reset()
                eval_ep_reward = 0
                for __ in range(EPISODE_LENGTH):
                    eval_action = agent.predict(eval_obs)
                    eval_obs, eval_reward, eval_term, eval_trunc, eval_info = eval_env.step(eval_action)
                    eval_ep_reward += eval_reward
                    if eval_term or eval_trunc:
                        break
                eval_rewards.append(eval_ep_reward)
                eval_pds.append(eval_info.get("pd", 0))

            eval_avg = np.mean(eval_rewards)
            eval_pd_avg = np.mean(eval_pds)
            print(f"\n  📊 Eval @ {step}: Avg Reward={eval_avg:.1f}, Avg Pd={eval_pd_avg:.3f}\n")

            if writer:
                writer.add_scalar("eval/avg_reward", eval_avg, step)
                writer.add_scalar("eval/avg_pd", eval_pd_avg, step)

    # Final save
    agent.save(os.path.join(save_dir, "final_model.pt"))

    # Save training log
    log_path = os.path.join(save_dir, "training_log.json")
    with open(log_path, "w") as f:
        json.dump(training_log, f, indent=2)

    if writer:
        writer.close()

    print("\n" + "=" * 60)
    print(f"  Training complete! Best reward: {best_episode_reward:.1f}")
    print(f"  Models saved to: {save_dir}")
    print(f"  Training log: {log_path}")
    if has_tb:
        print(f"  TensorBoard: tensorboard --logdir {tb_dir}")
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

    print("  Checking environment...")
    check_env(env, warn=True)
    print("  Environment check passed ✓")

    os.makedirs(save_dir, exist_ok=True)

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

    eval_callback = EvalCallback(
        env,
        best_model_save_path=save_dir,
        eval_freq=5000,
        n_eval_episodes=5,
        verbose=1,
    )
    model.learn(total_timesteps=timesteps, callback=eval_callback)
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
    parser.add_argument("--resume", type=str, default=None, help="Checkpoint path to resume from")
    parser.add_argument("--curriculum", action="store_true", help="Enable curriculum learning")
    parser.add_argument("--no-dueling", action="store_true", help="Disable dueling DQN")
    parser.add_argument("--no-prioritized", action="store_true", help="Disable prioritized replay")

    args = parser.parse_args()

    if args.algo == "dqn":
        train_native_dqn(
            args.timesteps,
            args.channels,
            args.emitters,
            args.save_dir,
            resume_path=args.resume,
            use_curriculum=args.curriculum,
            use_dueling=not args.no_dueling,
            use_prioritized=not args.no_prioritized,
        )
    else:
        train_sb3(args.timesteps, args.algo, args.channels, args.emitters, args.save_dir)
