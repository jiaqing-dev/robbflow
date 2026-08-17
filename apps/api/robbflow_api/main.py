from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from robbflow_api.config import settings
from robbflow_api.db import SessionLocal, init_db
from robbflow_api.routers import api_router
from robbflow_api.seed import seed_if_empty


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()
    if settings.seed:
        async with SessionLocal() as db:
            await seed_if_empty(db)
    yield


app = FastAPI(
    title="RobbFlow API",
    description="Open Source Engineering Operating System",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "product": "RobbFlow"}
