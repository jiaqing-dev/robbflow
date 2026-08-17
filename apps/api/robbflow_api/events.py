from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from robbflow_automation import default_engine
from robbflow_domain.models import Activity, DomainEvent

_rules = default_engine()


async def emit(
    db: AsyncSession,
    *,
    event_type: str,
    payload: dict[str, Any],
    workspace_id: UUID | None = None,
    actor_id: UUID | None = None,
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    action: str | None = None,
) -> None:
    db.add(DomainEvent(workspace_id=workspace_id, type=event_type, payload=payload))
    if entity_type and entity_id:
        db.add(
            Activity(
                workspace_id=workspace_id,
                actor_id=actor_id,
                entity_type=entity_type,
                entity_id=entity_id,
                action=action or event_type,
                payload=payload,
            )
        )
    await _rules.handle(event_type, payload)
