from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from robbflow_api.auth import hash_password
from robbflow_api.bootstrap import bootstrap_workspace
from robbflow_api.events import emit
from robbflow_domain.enums import EventType, MembershipRole, Priority, RelationType, WorkItemType
from robbflow_domain.models import (
    Comment,
    Membership,
    Milestone,
    Organization,
    Project,
    Sprint,
    Team,
    User,
    Workflow,
    WorkItem,
    WorkItemRelation,
    WorkItemTypeSchema,
    Workspace,
)

DEMO_EMAIL = "demo@robbflow.dev"
DEMO_PASSWORD = "robbflow"


async def seed_if_empty(db: AsyncSession) -> None:
    existing = await db.scalar(select(User.id).where(User.email == DEMO_EMAIL))
    if not existing:
        await seed_demo(db)
        await ensure_v02(db)
        return
    ready = await db.scalar(
        select(WorkItemTypeSchema.id).where(WorkItemTypeSchema.key == "bug").limit(1)
    )
    if ready is None:
        await ensure_v02(db)
        return
    for ws in await db.scalars(select(Workspace)):
        await bootstrap_workspace(db, ws.id)
    await db.commit()


async def seed_demo(db: AsyncSession) -> User:
    user = User(email=DEMO_EMAIL, name="萝卜", password_hash=hash_password(DEMO_PASSWORD))
    org = Organization(slug="robbflow", name="RobbFlow")
    workspace = Workspace(organization=org, slug="main", name="RobbFlow")
    db.add_all([user, org, workspace])
    await db.flush()

    db.add(Membership(workspace_id=workspace.id, user_id=user.id, role=MembershipRole.OWNER))
    db.add(Team(workspace_id=workspace.id, slug="core", name="Core"))

    eng = Project(
        workspace_id=workspace.id,
        slug="engineering",
        name="研发",
        description="研发操作系统核心",
        key_prefix="ENG",
        color="#f97316",
        templates=["engineering", "qa_loop"],
    )
    product = Project(
        workspace_id=workspace.id,
        slug="product",
        name="产品",
        description="产品与需求闭环",
        key_prefix="PRD",
        color="#8b5cf6",
        templates=["product"],
    )
    db.add_all([eng, product])
    await db.flush()

    samples: list[tuple[Project, dict]] = [
        (
            eng,
            {
                "type": WorkItemType.REQUIREMENT,
                "title": "Work Item Engine：统一需求 / 任务 / Bug 模型",
                "status": "development",
                "priority": Priority.URGENT,
                "description": "所有工作对象抽象为 Entity + type + properties JSONB，避免字段表爆炸。",
            },
        ),
        (
            eng,
            {
                "type": WorkItemType.TASK,
                "title": "实现 Workflow 状态机与非法流转校验",
                "status": "in_review",
                "priority": Priority.HIGH,
                "description": "工程 / 产品 / AI 团队可挂载不同 workflow preset。",
            },
        ),
        (
            eng,
            {
                "type": WorkItemType.TASK,
                "title": "Relation Engine：需求 → 代码 → 测试 → 发布追溯",
                "status": "todo",
                "priority": Priority.HIGH,
            },
        ),
        (
            eng,
            {
                "type": WorkItemType.BUG,
                "title": "Kanban 拖拽后 position 未持久化",
                "status": "to_verify",
                "priority": Priority.MEDIUM,
                "properties": {
                    "severity": "P2",
                    "environment": "测试",
                    "version": "0.2.0",
                    "steps": "1. 打开看板\n2. 将卡片拖到另一列\n3. 刷新页面",
                    "expected": "卡片仍在拖入的列，顺序保持。",
                    "actual": "刷新后卡片回到原列。",
                },
            },
        ),
        (
            eng,
            {
                "type": WorkItemType.TASK,
                "title": "Command Palette ⌘K：创建 / 搜索 / 指派",
                "status": "done",
                "priority": Priority.MEDIUM,
            },
        ),
        (
            eng,
            {
                "type": WorkItemType.IMPROVEMENT,
                "title": "接入飞书 / 企微 / 钉钉机器人通知",
                "status": "backlog",
                "priority": Priority.LOW,
            },
        ),
        (
            product,
            {
                "type": WorkItemType.REQUIREMENT,
                "status": "idea",
                "priority": Priority.HIGH,
                "description": "「帮我把登录模块重构一下，下周发布」→ Requirement + Tasks + Milestone。",
            },
        ),
        (
            product,
            {
                "type": WorkItemType.ISSUE,
                "title": "中国企业场景：SSO / LDAP / 私有化 / 信创",
                "status": "backlog",
                "priority": Priority.MEDIUM,
            },
        ),
        (
            product,
            {
                "type": WorkItemType.ACTION,
                "title": "整理 V0.1 七个核心页面信息架构",
                "status": "done",
                "priority": Priority.HIGH,
            },
        ),
    ]

    created: list[WorkItem] = []
    for project, spec in samples:
        key = f"{project.key_prefix}-{project.next_number}"
        project.next_number += 1
        item = WorkItem(
            workspace_id=workspace.id,
            project_id=project.id,
            type=spec["type"],
            key=key,
            title=spec["title"],
            description=spec.get("description"),
            status=spec["status"],
            priority=spec["priority"],
            creator_id=user.id,
            assignee_id=user.id if spec["status"] != "backlog" else None,
            properties=spec.get("properties") or {},
            position=float(project.next_number),
        )
        db.add(item)
        created.append(item)

    await db.flush()
    db.add(
        Comment(
            work_item_id=created[0].id,
            author_id=user.id,
            body="这是整个产品的技术壁垒，V0.1 先把模型跑通。",
        )
    )
    await emit(
        db,
        event_type=EventType.WORK_ITEM_CREATED,
        payload={"key": created[0].key, "title": created[0].title},
        workspace_id=workspace.id,
        actor_id=user.id,
        entity_type="work_item",
        entity_id=created[0].id,
        action="created",
    )
    await db.commit()
    return user


async def ensure_v02(db: AsyncSession) -> None:
    """Idempotent V0.2 data: workflows, types, sprint/milestone, relations, extra member."""
    workspaces = list(await db.scalars(select(Workspace)))
    for ws in workspaces:
        await bootstrap_workspace(db, ws.id)
        eng_wf = await db.scalar(
            select(Workflow).where(Workflow.workspace_id == ws.id, Workflow.key == "engineering")
        )
        if eng_wf:
            typed = await db.scalars(
                select(WorkItemTypeSchema).where(
                    WorkItemTypeSchema.workspace_id == ws.id,
                    WorkItemTypeSchema.key.in_(["requirement", "action", "risk"]),
                )
            )
            for row in typed:
                row.workflow_id = eng_wf.id

    demo = await db.scalar(select(User).where(User.email == DEMO_EMAIL))
    workspace = await db.scalar(select(Workspace).where(Workspace.slug == "main"))
    eng = await db.scalar(select(Project).where(Project.slug == "engineering"))
    if demo is None or workspace is None or eng is None:
        await db.commit()
        return

    mate = await db.scalar(select(User).where(User.email == "lin@robbflow.dev"))
    if mate is None:
        mate = User(
            email="lin@robbflow.dev",
            name="林间",
            password_hash=hash_password(DEMO_PASSWORD),
        )
        db.add(mate)
        await db.flush()
        db.add(Membership(workspace_id=workspace.id, user_id=mate.id, role=MembershipRole.MEMBER))

    sprint = await db.scalar(
        select(Sprint).where(Sprint.project_id == eng.id, Sprint.name == "Sprint 12")
    )
    if sprint is None:
        now = datetime.now(UTC)
        sprint = Sprint(
            workspace_id=workspace.id,
            project_id=eng.id,
            name="Sprint 12",
            goal="可编辑 Workflow + 追溯图 + 泳道视图",
            start_at=now - timedelta(days=2),
            end_at=now + timedelta(days=12),
            status="active",
        )
        db.add(sprint)
        await db.flush()

    milestone = await db.scalar(
        select(Milestone).where(Milestone.project_id == eng.id, Milestone.name == "V0.2 可视化流程")
    )
    if milestone is None:
        milestone = Milestone(
            workspace_id=workspace.id,
            project_id=eng.id,
            name="V0.2 可视化流程",
            description="对标飞书项目：自定义工作项、流程图、泳道图、Sprint / Milestone",
            due_at=datetime.now(UTC) + timedelta(days=14),
            status="active",
        )
        db.add(milestone)
        await db.flush()

    for project in await db.scalars(select(Project).where(Project.workspace_id == workspace.id)):
        if not project.templates:
            if project.slug == "product":
                project.templates = ["product"]
            elif project.slug == "engineering":
                project.templates = ["engineering", "qa_loop"]
            else:
                project.templates = ["engineering"]
        if project.slug == "engineering" and project.name == "Engineering":
            project.name = "研发"
        if project.slug == "product" and project.name == "Product":
            project.name = "产品"

    items = list(await db.scalars(select(WorkItem).where(WorkItem.project_id == eng.id)))
    by_key = {i.key: i for i in items}

    bug_demo = by_key.get("ENG-4")
    if bug_demo is not None:
        props = dict(bug_demo.properties or {})
        if props.get("environment") == "local":
            props["environment"] = "测试"
        props.setdefault("severity", "P2")
        props.setdefault("environment", "测试")
        props.setdefault("version", "0.2.0")
        props.setdefault("steps", "1. 打开看板\n2. 将卡片拖到另一列\n3. 刷新页面")
        props.setdefault("expected", "卡片仍在拖入的列，顺序保持。")
        props.setdefault("actual", "刷新后卡片回到原列。")
        bug_demo.properties = props

    if not any(item.type == WorkItemType.TEST_CASE for item in items):
        case = WorkItem(
            workspace_id=workspace.id,
            project_id=eng.id,
            type=WorkItemType.TEST_CASE,
            key=f"{eng.key_prefix}-{eng.next_number}",
            title="看板拖拽后刷新仍保持列顺序",
            description="覆盖缺陷：Kanban 拖拽后 position 未持久化。",
            status="draft",
            priority=Priority.HIGH,
            creator_id=demo.id,
            assignee_id=mate.id if mate else demo.id,
            properties={"steps": "拖拽卡片 → 刷新页面 → 核对列与顺序"},
            position=float(eng.next_number),
        )
        eng.next_number += 1
        qa_task = WorkItem(
            workspace_id=workspace.id,
            project_id=eng.id,
            type=WorkItemType.TEST_TASK,
            key=f"{eng.key_prefix}-{eng.next_number}",
            title="Sprint 12 回归：看板与缺陷闭环",
            status="in_progress",
            priority=Priority.HIGH,
            creator_id=demo.id,
            assignee_id=mate.id if mate else demo.id,
            properties={},
            position=float(eng.next_number),
        )
        eng.next_number += 1
        db.add_all([case, qa_task])
        await db.flush()
        items.extend([case, qa_task])
        by_key[case.key] = case
        by_key[qa_task.key] = qa_task
        bug = by_key.get("ENG-4")
        if bug:
            db.add_all(
                [
                    WorkItemRelation(
                        source_id=qa_task.id, target_id=case.id, relation_type=RelationType.COVERS
                    ),
                    WorkItemRelation(
                        source_id=bug.id, target_id=case.id, relation_type=RelationType.TESTED_BY
                    ),
                ]
            )

    for item in items:
        if item.status in {
            "in_progress",
            "in_review",
            "testing",
            "development",
            "to_verify",
            "prd",
            "blocked",
        }:
            item.sprint_id = sprint.id
            item.milestone_id = milestone.id
        if item.key.endswith("-2") and mate is not None:
            item.assignee_id = mate.id
        if item.key.endswith("-4") and mate is not None:
            item.assignee_id = mate.id

    rel_count = await db.scalar(select(func.count()).select_from(WorkItemRelation))
    req = by_key.get("ENG-1")
    task_wf = by_key.get("ENG-2")
    task_rel = by_key.get("ENG-3")
    bug = by_key.get("ENG-4")
    if not rel_count and req and task_wf and task_rel and bug:
        db.add_all(
            [
                WorkItemRelation(
                    source_id=req.id, target_id=task_wf.id, relation_type=RelationType.IMPLEMENTS
                ),
                WorkItemRelation(
                    source_id=req.id, target_id=task_rel.id, relation_type=RelationType.IMPLEMENTS
                ),
                WorkItemRelation(
                    source_id=bug.id, target_id=task_rel.id, relation_type=RelationType.FIXED_BY
                ),
                WorkItemRelation(
                    source_id=task_rel.id, target_id=bug.id, relation_type=RelationType.RELATES_TO
                ),
            ]
        )
    await db.commit()
