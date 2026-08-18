from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from robbflow_api.deps import CurrentContext
from robbflow_domain.enums import MembershipRole
from robbflow_domain.models import Membership

_ADMINS = {MembershipRole.OWNER.value, MembershipRole.ADMIN.value}


async def membership_role(db: AsyncSession, ctx: CurrentContext) -> str:
    if getattr(ctx, "role", None):
        return ctx.role
    row = await db.scalar(
        select(Membership).where(
            Membership.workspace_id == ctx.workspace.id, Membership.user_id == ctx.user.id
        )
    )
    return row.role if row else MembershipRole.GUEST.value


def require_admin(role: str) -> None:
    if role not in _ADMINS:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "需要管理员权限才能修改流程")


def can_take_transition(
    *,
    role: str,
    require_role: str | None,
    require_approver: bool,
    actor_id: UUID,
    assignee_id: UUID | None,
) -> bool:
    if require_approver and assignee_id != actor_id:
        return False
    if not require_role:
        return True
    if require_role == "assignee":
        return assignee_id == actor_id
    if require_role == "admin":
        return role in _ADMINS
    if require_role == "owner":
        return role == MembershipRole.OWNER.value
    if require_role == "member":
        return role != MembershipRole.GUEST.value
    return role == require_role
