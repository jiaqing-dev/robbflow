from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from robbflow_domain.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from robbflow_domain.models.identity import User, Workspace


class Project(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "project"

    workspace_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("workspace.id"), index=True
    )
    slug: Mapped[str] = mapped_column(String(64))
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    key_prefix: Mapped[str] = mapped_column(String(8), default="ENG")
    next_number: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(32), default="active")
    color: Mapped[str] = mapped_column(String(16), default="#f97316")
    templates: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)

    workspace: Mapped[Workspace] = relationship(back_populates="projects")
    work_items: Mapped[list["WorkItem"]] = relationship(back_populates="project")

    __table_args__ = (UniqueConstraint("workspace_id", "slug"),)


class WorkItem(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Unified work object. Requirement / Task / Bug / … are `type` + schema."""

    __tablename__ = "work_item"

    workspace_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("workspace.id"), index=True
    )
    project_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("project.id"), index=True
    )
    type: Mapped[str] = mapped_column(String(32), index=True)
    key: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(64), default="todo", index=True)
    priority: Mapped[str] = mapped_column(String(16), default="none", index=True)
    creator_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    assignee_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )
    parent_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("work_item.id"), nullable=True, index=True
    )
    start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    position: Mapped[float] = mapped_column(Float, default=0)
    properties: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    sprint_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("sprint.id"), nullable=True, index=True
    )
    milestone_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("milestone.id"), nullable=True, index=True
    )

    project: Mapped[Project] = relationship(back_populates="work_items")
    creator: Mapped[User] = relationship(foreign_keys=[creator_id])
    assignee: Mapped[User | None] = relationship(foreign_keys=[assignee_id])
    comments: Mapped[list["Comment"]] = relationship(
        back_populates="work_item", cascade="all, delete-orphan"
    )
    links: Mapped[list["WorkItemLink"]] = relationship(
        back_populates="work_item", cascade="all, delete-orphan"
    )

    __table_args__ = (UniqueConstraint("workspace_id", "key"),)


class WorkItemRelation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "work_item_relation"

    source_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("work_item.id"), index=True
    )
    target_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("work_item.id"), index=True
    )
    relation_type: Mapped[str] = mapped_column(String(32))

    __table_args__ = (UniqueConstraint("source_id", "target_id", "relation_type"),)


class Comment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "comment"

    work_item_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("work_item.id"), index=True
    )
    author_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)

    work_item: Mapped[WorkItem] = relationship(back_populates="comments")
    author: Mapped[User] = relationship()


class WorkItemLink(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """External document reference. V0.2.x stores Feishu URLs instead of a built-in wiki."""

    __tablename__ = "work_item_link"

    work_item_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("work_item.id"), index=True
    )
    url: Mapped[str] = mapped_column(String(2000))
    title: Mapped[str] = mapped_column(String(200))
    provider: Mapped[str] = mapped_column(String(32), default="feishu")
    kind: Mapped[str] = mapped_column(String(32), default="doc")

    work_item: Mapped[WorkItem] = relationship(back_populates="links")

    __table_args__ = (UniqueConstraint("work_item_id", "url"),)


class Activity(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "activity"

    workspace_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("workspace.id"), index=True
    )
    actor_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    entity_type: Mapped[str] = mapped_column(String(64))
    entity_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), index=True)
    action: Mapped[str] = mapped_column(String(64))
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class DomainEvent(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "event"

    workspace_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("workspace.id"), nullable=True, index=True
    )
    type: Mapped[str] = mapped_column(String(64), index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
