from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    workspace_name: str = Field(default="我的工作区", max_length=200)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: UUID
    email: str
    name: str
    avatar_url: str | None = None

    model_config = {"from_attributes": True}


class WorkspaceOut(BaseModel):
    id: UUID
    slug: str
    name: str

    model_config = {"from_attributes": True}


class MeOut(BaseModel):
    user: UserOut
    workspace: WorkspaceOut


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str | None = None
    description: str | None = None
    key_prefix: str = Field(default="ENG", max_length=8)
    color: str = "#f97316"
    templates: list[str] = Field(default_factory=lambda: ["engineering"])


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    key_prefix: str | None = Field(default=None, max_length=8)
    color: str | None = None
    status: str | None = None
    templates: list[str] | None = None


class ProjectOut(BaseModel):
    id: UUID
    slug: str
    name: str
    description: str | None
    key_prefix: str
    status: str
    color: str
    created_at: datetime
    templates: list[str] = Field(default_factory=lambda: ["engineering"])

    model_config = {"from_attributes": True}

    @field_validator("templates", mode="before")
    @classmethod
    def _templates(cls, value: Any) -> list[str]:
        if value is None:
            return ["engineering"]
        return value


class WorkItemCreate(BaseModel):
    project_id: UUID
    type: str = "task"
    title: str = Field(min_length=1, max_length=500)
    description: str | None = None
    status: str | None = None
    priority: str = "none"
    assignee_id: UUID | None = None
    parent_id: UUID | None = None
    properties: dict[str, Any] = Field(default_factory=dict)
    sprint_id: UUID | None = None
    milestone_id: UUID | None = None


class WorkItemUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    assignee_id: UUID | None = None
    parent_id: UUID | None = None
    properties: dict[str, Any] | None = None
    due_at: datetime | None = None
    sprint_id: UUID | None = None
    milestone_id: UUID | None = None


class WorkItemOut(BaseModel):
    id: UUID
    project_id: UUID
    type: str
    key: str
    title: str
    description: str | None
    status: str
    priority: str
    creator_id: UUID
    assignee_id: UUID | None
    parent_id: UUID | None
    position: float
    properties: dict[str, Any]
    sprint_id: UUID | None = None
    milestone_id: UUID | None = None
    created_at: datetime
    updated_at: datetime
    assignee: UserOut | None = None
    creator: UserOut | None = None
    project_name: str | None = None

    model_config = {"from_attributes": True}


class CommentCreate(BaseModel):
    body: str = Field(min_length=1)


class CommentOut(BaseModel):
    id: UUID
    body: str
    author: UserOut
    created_at: datetime

    model_config = {"from_attributes": True}


class WorkItemLinkCreate(BaseModel):
    url: str = Field(min_length=8, max_length=2000)
    title: str | None = Field(default=None, max_length=200)


class WorkItemLinkOut(BaseModel):
    id: UUID
    url: str
    title: str
    provider: str
    kind: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ActivityOut(BaseModel):
    id: UUID
    actor_id: UUID | None
    entity_type: str
    entity_id: UUID
    action: str
    payload: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class RelationCreate(BaseModel):
    target_id: UUID
    relation_type: str = "relates_to"


class RelationOut(BaseModel):
    id: UUID
    source_id: UUID
    target_id: UUID
    relation_type: str
    target_key: str | None = None
    target_title: str | None = None
    source_key: str | None = None
    source_title: str | None = None

    model_config = {"from_attributes": True}


class WorkflowStateIn(BaseModel):
    key: str
    name: str
    category: str = "unstarted"
    color: str = "#64748b"
    position: int = 0
    layout_x: float = 0
    layout_y: float = 0


class WorkflowTransitionIn(BaseModel):
    from_state: str
    to_state: str
    name: str | None = None


class WorkflowCreate(BaseModel):
    key: str | None = None
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    is_default: bool = False
    preset: str | None = None


class WorkflowPut(BaseModel):
    name: str
    description: str | None = None
    is_default: bool = False
    states: list[WorkflowStateIn]
    transitions: list[WorkflowTransitionIn]


class WorkflowStateOut(BaseModel):
    key: str
    name: str
    category: str
    color: str
    position: int
    layout_x: float = 0
    layout_y: float = 0


class WorkflowOut(BaseModel):
    id: UUID
    key: str
    name: str
    description: str | None
    is_default: bool
    states: list[WorkflowStateOut]
    transitions: list[WorkflowTransitionIn]
    created_at: datetime

    model_config = {"from_attributes": True}


class TypePort(BaseModel):
    type_key: str
    relation: str = "relates_to"
    label: str | None = None


class WorkItemTypeIn(BaseModel):
    key: str | None = None
    name: str
    icon: str = "circle"
    color: str = "#94a3b8"
    fields: list[dict[str, Any]] = Field(default_factory=list)
    workflow_id: UUID | None = None
    description: str | None = None
    inputs: list[TypePort] | None = None
    outputs: list[TypePort] | None = None
    layout_x: float | None = None
    layout_y: float | None = None
    detail_layout: dict[str, Any] | None = None


class WorkItemTypeOut(BaseModel):
    id: UUID
    key: str
    name: str
    icon: str
    color: str
    fields: list[dict[str, Any]]
    workflow_id: UUID | None
    description: str | None = None
    inputs: list[dict[str, Any]] = Field(default_factory=list)
    outputs: list[dict[str, Any]] = Field(default_factory=list)
    layout_x: float | None = None
    layout_y: float | None = None
    detail_layout: dict[str, Any] | None = None

    model_config = {"from_attributes": True}

    @field_validator("inputs", "outputs", mode="before")
    @classmethod
    def _ports(cls, value: Any) -> list:
        return value or []


class TypeGraphNodeIn(BaseModel):
    id: UUID
    layout_x: float = 0
    layout_y: float = 0
    name: str | None = None
    color: str | None = None
    description: str | None = None
    fields: list[dict[str, Any]] | None = None
    workflow_id: UUID | None = None
    detail_layout: dict[str, Any] | None = None


class TypeGraphEdgeIn(BaseModel):
    source_key: str
    target_key: str
    relation: str = "relates_to"
    label: str | None = None


class TypeGraphPut(BaseModel):
    nodes: list[TypeGraphNodeIn]
    edges: list[TypeGraphEdgeIn]


class SprintCreate(BaseModel):
    project_id: UUID
    name: str
    goal: str | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    status: str = "planned"


class SprintOut(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    goal: str | None
    start_at: datetime | None
    end_at: datetime | None
    status: str
    item_count: int = 0

    model_config = {"from_attributes": True}


class MilestoneCreate(BaseModel):
    project_id: UUID
    name: str
    description: str | None = None
    due_at: datetime | None = None
    status: str = "planned"


class MilestoneOut(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    description: str | None
    due_at: datetime | None
    status: str
    item_count: int = 0

    model_config = {"from_attributes": True}


class AgentPlanIn(BaseModel):
    prompt: str
    project_id: UUID | None = None
    apply: bool = False
