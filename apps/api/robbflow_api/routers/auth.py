from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from robbflow_api.auth import create_access_token, hash_password_async, verify_password_async
from robbflow_api.bootstrap import bootstrap_workspace
from robbflow_api.db import get_db
from robbflow_api.deps import CurrentContext, get_current
from robbflow_api.events import emit
from robbflow_api.schemas import LoginIn, MeOut, RegisterIn, TokenOut, UserOut, WorkspaceOut
from robbflow_domain.enums import EventType, MembershipRole
from robbflow_domain.models import Membership, Organization, User, Workspace

router = APIRouter(prefix="/auth", tags=["auth"])


def _slugify(value: str) -> str:
    slug = "".join(ch.lower() if ch.isalnum() else "-" for ch in value).strip("-")
    return slug[:64] or "workspace"


@router.post("/register", response_model=TokenOut)
async def register(body: RegisterIn, db: AsyncSession = Depends(get_db)) -> TokenOut:
    exists = await db.scalar(select(User).where(User.email == body.email.lower()))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    user = User(
        email=body.email.lower(),
        name=body.name,
        password_hash=await hash_password_async(body.password),
    )
    org = Organization(slug=_slugify(body.workspace_name), name=body.workspace_name)
    workspace = Workspace(organization=org, slug="main", name=body.workspace_name)
    db.add_all([user, org, workspace])
    await db.flush()
    db.add(
        Membership(
            workspace_id=workspace.id,
            user_id=user.id,
            role=MembershipRole.OWNER,
        )
    )
    await bootstrap_workspace(db, workspace.id)
    await emit(
        db,
        event_type=EventType.USER_JOINED,
        payload={"email": user.email},
        workspace_id=workspace.id,
        actor_id=user.id,
        entity_type="user",
        entity_id=user.id,
        action="joined",
    )
    await db.commit()
    return TokenOut(access_token=create_access_token(user.id, workspace.id))


@router.post("/login", response_model=TokenOut)
async def login(body: LoginIn, db: AsyncSession = Depends(get_db)) -> TokenOut:
    user = await db.scalar(select(User).where(User.email == body.email.lower()))
    if user is None or not await verify_password_async(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "邮箱或密码不正确")
    membership = await db.scalar(select(Membership).where(Membership.user_id == user.id))
    if membership is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No workspace")
    return TokenOut(access_token=create_access_token(user.id, membership.workspace_id))


@router.get("/me", response_model=MeOut)
async def me(ctx: CurrentContext = Depends(get_current)) -> MeOut:
    return MeOut(
        user=UserOut.model_validate(ctx.user),
        workspace=WorkspaceOut.model_validate(ctx.workspace),
        role=ctx.role,
    )
