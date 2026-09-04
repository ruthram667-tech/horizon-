"""
Smart Scan EW — Structured Logging
====================================
Centralized logging configuration with colored terminal output
and structured formatting for the EW backend.
"""

import logging
import sys
from datetime import datetime


class ColoredFormatter(logging.Formatter):
    """Custom formatter with ANSI color codes for terminal output."""

    COLORS = {
        'DEBUG':    '\033[36m',    # Cyan
        'INFO':     '\033[32m',    # Green
        'WARNING':  '\033[33m',    # Yellow
        'ERROR':    '\033[31m',    # Red
        'CRITICAL': '\033[41m',    # Red background
    }
    RESET = '\033[0m'
    BOLD = '\033[1m'
    DIM = '\033[2m'

    ICONS = {
        'DEBUG':    '[*]',
        'INFO':     '[+]',
        'WARNING':  '[!]',
        'ERROR':    '[-]',
        'CRITICAL': '[F]',
    }

    def format(self, record):
        color = self.COLORS.get(record.levelname, '')
        icon = self.ICONS.get(record.levelname, '')
        timestamp = datetime.fromtimestamp(record.created).strftime('%H:%M:%S')

        # Format message
        msg = f"{self.DIM}{timestamp}{self.RESET} "
        msg += f"{color}{icon} {record.levelname:8s}{self.RESET} "
        msg += f"{self.DIM}[{record.name}]{self.RESET} "
        msg += f"{record.getMessage()}"

        if record.exc_info:
            msg += '\n' + self.formatException(record.exc_info)

        return msg


def setup_logging(level: str = "INFO") -> logging.Logger:
    """
    Configure and return the root application logger.

    Args:
        level: Logging level string (DEBUG, INFO, WARNING, ERROR)

    Returns:
        Configured root logger
    """
    # Root logger
    logger = logging.getLogger("smart_scan_ew")
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Remove existing handlers
    logger.handlers.clear()

    # Console handler with colors
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(ColoredFormatter())
    logger.addHandler(console_handler)

    # Prevent duplicate logs from propagating
    logger.propagate = False

    return logger


def get_logger(name: str) -> logging.Logger:
    """
    Get a child logger with the given name.

    Args:
        name: Logger name (e.g., 'api', 'simulation', 'inference')

    Returns:
        Child logger instance
    """
    return logging.getLogger(f"smart_scan_ew.{name}")
