"""Notifications, saved views, documents, git links, IM bindings, connector secrets."""

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from robbflow_domain.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Notification(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "notification"

    workspace_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("workspace.id"), index=True
    )
    recipient_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), index=True
    )
    title: Mapped[str] = mapped_column(String(300))
    body: Mapped[str] = mapped_column(Text, default="")
    entity_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    entity_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class SavedView(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "saved_view"

    workspace_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("workspace.id"), index=True
    )
    project_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("project.id"), nullable=True, index=True
    )
    created_by: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(120))
    filters: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)


class Document(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """DocRef: external file, upload, or a short markdown note. Not a wiki."""

    __tablename__ = "document"

    workspace_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("workspace.id"), index=True
    )
    project_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("project.id"), nullable=True, index=True
    )
    work_item_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("work_item.id"), nullable=True, index=True
    )
    provider: Mapped[str] = mapped_column(String(32), default="url")
    kind: Mapped[str] = mapped_column(String(32), default="doc")
    title: Mapped[str] = mapped_column(String(300))
    url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    mime: Mapped[str | None] = mapped_column(String(120), nullable=True)
    external_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    storage_key: Mapped[str | None] = mapped_column(String(500), nullable=True)


class GitLink(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "git_link"

    work_item_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("work_item.id"), index=True
    )
    provider: Mapped[str] = mapped_column(String(32), default="github")
    repo: Mapped[str] = mapped_column(String(300))
    ref: Mapped[str] = mapped_column(String(200), default="")
    url: Mapped[str] = mapped_column(String(2000))
    kind: Mapped[str] = mapped_column(String(32), default="branch")


class IdentityBinding(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "identity_binding"

    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), index=True)
    workspace_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("workspace.id"), index=True
    )
    provider: Mapped[str] = mapped_column(String(32))
    external_id: Mapped[str] = mapped_column(String(200))

    __table_args__ = (UniqueConstraint("workspace_id", "provider", "external_id"),)


class IntegrationCredential(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "integration_credential"

    workspace_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("workspace.id"), index=True
    )
    provider: Mapped[str] = mapped_column(String(32))
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    __table_args__ = (UniqueConstraint("workspace_id", "provider"),)
