from __future__ import annotations
import sys
from pathlib import Path
from loguru import logger
from core.config.settings import get_settings

def setup_logging() -> None:
    settings = get_settings()
    logger.remove()
    fmt = "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | <level>{message}</level>"
    logger.add(sys.stderr, format=fmt, level=settings.log_level, colorize=True)
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    logger.add(log_dir / "apexsport_{time:YYYY-MM-DD}.log", format=fmt, level="DEBUG", rotation="1 day", retention="30 days", compression="gz")
    logger.info("Logging initialized", env=settings.env.value)
