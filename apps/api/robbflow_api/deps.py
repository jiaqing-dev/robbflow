from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from robbflow_api.auth import decode_token
from robbflow_api.db import get_db
from robbflow_domain.models import Membership, User, Workspace

bearer = HTTPBearer(auto_error=False)


class CurrentContext:
    def __init__(self, user: User, workspace: Workspace, role: str = "member"):
        self.user = user
        self.workspace = workspace
        self.role = role


async def get_current(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> CurrentContext:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        data = decode_token(creds.credentials)
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token") from exc

    user = await db.get(User, UUID(data["user_id"]))
    workspace = await db.get(Workspace, UUID(data["workspace_id"]))
    if user is None or workspace is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid session")
    membership = await db.scalar(
        select(Membership).where(
            Membership.workspace_id == workspace.id, Membership.user_id == user.id
        )
    )
    role = membership.role if membership else "guest"
    return CurrentContext(user, workspace, role)
