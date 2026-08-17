"""Work item types, priorities, statuses, and relation kinds."""

from enum import StrEnum


class WorkItemType(StrEnum):
    REQUIREMENT = "requirement"
    FEATURE = "feature"
    TASK = "task"
    BUG = "bug"
    ISSUE = "issue"
    RISK = "risk"
    IMPROVEMENT = "improvement"
    INCIDENT = "incident"
    TEST_CASE = "test_case"
    TEST_TASK = "test_task"
    ACTION = "action"


class Priority(StrEnum):
    URGENT = "urgent"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    NONE = "none"


class StateCategory(StrEnum):
    UNSTARTED = "unstarted"
    STARTED = "started"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class RelationType(StrEnum):
    BLOCKS = "blocks"
    DEPENDS_ON = "depends_on"
    RELATES_TO = "relates_to"
    DUPLICATES = "duplicates"
    IMPLEMENTS = "implements"
    TESTED_BY = "tested_by"
    FIXED_BY = "fixed_by"
    PARENT_OF = "parent_of"
    BELONGS_TO = "belongs_to"
    COVERS = "covers"
    DERIVED_FROM = "derived_from"


class MembershipRole(StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
    GUEST = "guest"


class EventType(StrEnum):
    WORK_ITEM_CREATED = "WorkItemCreated"
    WORK_ITEM_UPDATED = "WorkItemUpdated"
    WORK_ITEM_MOVED = "WorkItemMoved"
    COMMENT_CREATED = "CommentCreated"
    PROJECT_CREATED = "ProjectCreated"
    PROJECT_UPDATED = "ProjectUpdated"
    USER_JOINED = "UserJoined"
    WORKFLOW_UPDATED = "WorkflowUpdated"
    SPRINT_UPDATED = "SprintUpdated"
