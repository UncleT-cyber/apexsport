from __future__ import annotations
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from core.config.settings import get_settings

engine = None
SessionLocal = None

def get_engine():
    global engine, SessionLocal
    if engine is None:
        url = get_settings().database.url
        engine = create_async_engine(url, echo=get_settings().database.echo, pool_size=get_settings().database.pool_size, max_overflow=get_settings().database.max_overflow)
        SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    return engine
