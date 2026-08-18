from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from robbflow_domain.models import Notification


async def notify(
    db: AsyncSession,
    *,
    workspace_id: UUID,
    recipient_id: UUID | None,
    title: str,
    body: str = "",
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    payload: dict[str, Any] | None = None,
    actor_id: UUID | None = None,
) -> None:
    if recipient_id is None or recipient_id == actor_id:
        return
    db.add(
        Notification(
            workspace_id=workspace_id,
            recipient_id=recipient_id,
            title=title,
            body=body,
            entity_type=entity_type,
            entity_id=entity_id,
            payload=payload or {},
        )
    )
