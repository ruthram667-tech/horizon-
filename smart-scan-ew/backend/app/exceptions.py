"""
Smart Scan EW — Custom Exceptions
====================================
Application-specific exception classes with FastAPI handlers.
"""

from fastapi import HTTPException, status


class ScanError(HTTPException):
    """Base exception for scan-related errors."""
    def __init__(self, detail: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(status_code=status_code, detail=detail)


class ScanAlreadyRunning(ScanError):
    """Raised when attempting to start a scan that is already running."""
    def __init__(self):
        super().__init__(
            detail="Scan is already running. Stop the current scan before starting a new one.",
            status_code=status.HTTP_409_CONFLICT,
        )


class ScanNotRunning(ScanError):
    """Raised when attempting to stop a scan that is not running."""
    def __init__(self):
        super().__init__(
            detail="No scan is currently running.",
            status_code=status.HTTP_409_CONFLICT,
        )


class ModelNotFound(ScanError):
    """Raised when the RL model checkpoint is not found."""
    def __init__(self, model_path: str = ""):
        detail = f"Trained model not found at '{model_path}'. Using heuristic fallback."
        super().__init__(detail=detail, status_code=status.HTTP_404_NOT_FOUND)


class ConfigurationError(ScanError):
    """Raised for invalid configuration values."""
    def __init__(self, detail: str):
        super().__init__(
            detail=f"Invalid configuration: {detail}",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )


class WebSocketLimitExceeded(ScanError):
    """Raised when too many WebSocket clients are connected."""
    def __init__(self, max_clients: int = 10):
        super().__init__(
            detail=f"Maximum WebSocket clients ({max_clients}) exceeded.",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        )
