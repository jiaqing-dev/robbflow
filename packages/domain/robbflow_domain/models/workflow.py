from typing import Any
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from robbflow_domain.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class WorkItemTypeSchema(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Admin-defined type schema. Extra fields live in work_item.properties JSONB."""

    __tablename__ = "work_item_type"

    workspace_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("workspace.id"), index=True
    )
    key: Mapped[str] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(String(80))
    icon: Mapped[str] = mapped_column(String(32), default="circle")
    color: Mapped[str] = mapped_column(String(16), default="#94a3b8")
    fields: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    workflow_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("workflow.id"), nullable=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    inputs: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)
    outputs: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)
    layout_x: Mapped[float | None] = mapped_column(nullable=True)
    layout_y: Mapped[float | None] = mapped_column(nullable=True)
    detail_layout: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    __table_args__ = (UniqueConstraint("workspace_id", "key"),)


class Workflow(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "workflow"

    workspace_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("workspace.id"), index=True
    )
    key: Mapped[str] = mapped_column(String(64))
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)

    states: Mapped[list["WorkflowState"]] = relationship(
        back_populates="workflow", cascade="all, delete-orphan", order_by="WorkflowState.position"
    )
    transitions: Mapped[list["WorkflowTransition"]] = relationship(
        back_populates="workflow", cascade="all, delete-orphan"
    )

    __table_args__ = (UniqueConstraint("workspace_id", "key"),)


class WorkflowState(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "workflow_state"

    workflow_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("workflow.id"), index=True
    )
    key: Mapped[str] = mapped_column(String(64))
    name: Mapped[str] = mapped_column(String(80))
    category: Mapped[str] = mapped_column(String(32), default="unstarted")
    color: Mapped[str] = mapped_column(String(16), default="#64748b")
    position: Mapped[int] = mapped_column(Integer, default=0)

    layout_x: Mapped[float] = mapped_column(default=0)
    layout_y: Mapped[float] = mapped_column(default=0)

    workflow: Mapped[Workflow] = relationship(back_populates="states")

    __table_args__ = (UniqueConstraint("workflow_id", "key"),)


class WorkflowTransition(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "workflow_transition"

    workflow_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("workflow.id"), index=True
    )
    from_state: Mapped[str] = mapped_column(String(64))
    to_state: Mapped[str] = mapped_column(String(64))
    name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    require_role: Mapped[str | None] = mapped_column(String(32), nullable=True)
    require_approver: Mapped[bool] = mapped_column(Boolean, default=False)

    workflow: Mapped[Workflow] = relationship(back_populates="transitions")
