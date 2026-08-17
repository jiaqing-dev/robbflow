from collections.abc import AsyncIterator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from robbflow_api.config import settings
from robbflow_domain.models import Base

engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    pool_recycle=1800,
)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


_ALTERS = [
    "ALTER TABLE workflow_state ADD COLUMN IF NOT EXISTS layout_x DOUBLE PRECISION DEFAULT 0",
    "ALTER TABLE workflow_state ADD COLUMN IF NOT EXISTS layout_y DOUBLE PRECISION DEFAULT 0",
    "ALTER TABLE work_item ADD COLUMN IF NOT EXISTS sprint_id UUID",
    "ALTER TABLE work_item ADD COLUMN IF NOT EXISTS milestone_id UUID",
    "ALTER TABLE work_item_type ADD COLUMN IF NOT EXISTS description TEXT",
    "ALTER TABLE work_item_type ADD COLUMN IF NOT EXISTS inputs JSONB",
    "ALTER TABLE work_item_type ADD COLUMN IF NOT EXISTS outputs JSONB",
    "ALTER TABLE work_item_type ADD COLUMN IF NOT EXISTS layout_x DOUBLE PRECISION",
    "ALTER TABLE work_item_type ADD COLUMN IF NOT EXISTS layout_y DOUBLE PRECISION",
    "ALTER TABLE project ADD COLUMN IF NOT EXISTS templates JSONB",
    "ALTER TABLE work_item_type ADD COLUMN IF NOT EXISTS detail_layout JSONB",
    "ALTER TABLE workflow_transition ADD COLUMN IF NOT EXISTS require_role VARCHAR(32)",
    "ALTER TABLE workflow_transition ADD COLUMN IF NOT EXISTS require_approver BOOLEAN DEFAULT false",
]


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        for stmt in _ALTERS:
            await conn.execute(text(stmt))
