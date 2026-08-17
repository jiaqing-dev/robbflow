from fastapi import APIRouter

from robbflow_api.routers import (
    agent,
    auth,
    cycles,
    inbox,
    meta,
    projects,
    types,
    work_items,
    workflows,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(projects.router)
api_router.include_router(work_items.router)
api_router.include_router(inbox.router)
api_router.include_router(agent.router)
api_router.include_router(meta.router)
api_router.include_router(workflows.router)
api_router.include_router(types.router)
api_router.include_router(cycles.router)
