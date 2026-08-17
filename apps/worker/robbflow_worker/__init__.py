"""Consume persisted domain events and run automations / notifications."""

import asyncio
import logging

from sqlalchemy import select

from robbflow_api.db import SessionLocal, init_db
from robbflow_automation import default_engine
from robbflow_domain.models import DomainEvent

log = logging.getLogger("robbflow.worker")
rules = default_engine()


async def tick() -> None:
    async with SessionLocal() as db:
        events = list(
            await db.scalars(select(DomainEvent).order_by(DomainEvent.created_at.desc()).limit(20))
        )
        for event in events:
            await rules.handle(event.type, event.payload or {})


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    await init_db()
    log.info("RobbFlow worker started")
    while True:
        try:
            await tick()
        except Exception:
            log.exception("worker tick failed")
        await asyncio.sleep(5)


if __name__ == "__main__":
    asyncio.run(main())
