"""Sport domain tables — canonical."""
from sqlalchemy import String, DateTime, ForeignKey, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone
from database.models.base import Base

class CompetitionRecord(Base):
    __tablename__ = "competitions"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    sport_code: Mapped[str] = mapped_column(String, default="football")
    name: Mapped[str] = mapped_column(String, nullable=False)
    code: Mapped[str] = mapped_column(String, nullable=False)
    country: Mapped[str | None] = mapped_column(String, nullable=True)

class ParticipantRecord(Base):
    __tablename__ = "participants"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    sport_code: Mapped[str] = mapped_column(String, default="football")
    name: Mapped[str] = mapped_column(String, nullable=False)
    code: Mapped[str] = mapped_column(String, nullable=False)
    country: Mapped[str | None] = mapped_column(String, nullable=True)

class EventRecord(Base):
    __tablename__ = "events"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    sport_code: Mapped[str] = mapped_column(String, default="football")
    competition_id: Mapped[str] = mapped_column(String, ForeignKey("competitions.id"))
    home_participant_id: Mapped[str] = mapped_column(String, ForeignKey("participants.id"))
    away_participant_id: Mapped[str] = mapped_column(String, ForeignKey("participants.id"))
    kickoff_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String, default="scheduled")
    home_score: Mapped[int | None] = mapped_column(nullable=True)
    away_score: Mapped[int | None] = mapped_column(nullable=True)

class ExternalIdentity(Base):
    """Preserve provider IDs attached to canonical entity — never destroy."""
    __tablename__ = "external_identities"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    entity_type: Mapped[str] = mapped_column(String, nullable=False)  # team/player/competition/event/market/bookmaker
    canonical_id: Mapped[str] = mapped_column(String, nullable=False)
    provider: Mapped[str] = mapped_column(String, nullable=False)
    external_id: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
