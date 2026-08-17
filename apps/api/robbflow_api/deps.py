from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from robbflow_api.auth import decode_token
from robbflow_api.db import get_db
from robbflow_domain.models import User, Workspace

bearer = HTTPBearer(auto_error=False)


class CurrentContext:
    def __init__(self, user: User, workspace: Workspace):
        self.user = user
        self.workspace = workspace


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
    return CurrentContext(user, workspace)
