"""Analytics / observability tables + snapshots for reproducibility."""
from sqlalchemy import String, Float, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, timezone
from database.models.base import Base

class PredictionRecord(Base):
    __tablename__ = "predictions"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    event_id: Mapped[str] = mapped_column(String, nullable=False)
    market: Mapped[str] = mapped_column(String, nullable=False)
    selection: Mapped[str] = mapped_column(String, nullable=False)
    model_probability: Mapped[float] = mapped_column(Float, nullable=False)
    calibrated_probability: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    model_version: Mapped[str] = mapped_column(String, default="v0")
    feature_version: Mapped[str] = mapped_column(String, default="v0")
    prompt_version: Mapped[str | None] = mapped_column(String, nullable=True)
    data_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    data_snapshot_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class CalibrationBucket(Base):
    __tablename__ = "calibration_buckets"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    bucket: Mapped[str] = mapped_column(String, nullable=False)  # e.g. 0.5-0.6
    predicted_rate: Mapped[float] = mapped_column(Float, nullable=False)
    actual_rate: Mapped[float] = mapped_column(Float, nullable=False)
    count: Mapped[int] = mapped_column(default=0)
    brier_score: Mapped[float] = mapped_column(Float, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
