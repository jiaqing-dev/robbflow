# Architecture

RobbFlow is an **Engineering Operating System**, not an issue tracker with extra screens.

```text
┌──────────────────────────────────────────────┐
│                    Web UI                    │
│        Next.js / React / TypeScript          │
├──────────────────────────────────────────────┤
│                Application API               │
│          REST / (GraphQL later)              │
├──────────────────────────────────────────────┤
│                Domain Layer                  │
│  Project │ WorkItem │ Workflow │ Relation    │
├──────────────────────────────────────────────┤
│               Automation Layer               │
│     Workflow Engine │ Rule Engine │ Events   │
├──────────────────────────────────────────────┤
│                   AI Layer                   │
│         Agent │ Tool │ MCP │ RAG │ LLM       │
├──────────────────────────────────────────────┤
│              Integration Layer               │
│   GitHub │ GitLab │ Jenkins │ 飞书 │ 企微    │
├──────────────────────────────────────────────┤
│                 Data Layer                   │
│     PostgreSQL │ Redis │ Object Storage      │
└──────────────────────────────────────────────┘
```

## Work Item Engine

Every work object is one row:

```text
work_item (type, title, status, priority, properties JSONB, …)
```

Types (`requirement`, `task`, `bug`, `incident`, …) are not separate tables. Custom fields live in `properties` and are described by `work_item_type.fields`.

## Workflow Engine

`packages/workflow` owns states and transitions. V0.2 persists them in PostgreSQL and lets admins edit the graph in the UI. The API refuses illegal moves. Teams attach a workflow to each work item type (Feishu-style).

Default engineering flow is sequential (forward, one-step back, cancel) — not a complete graph — so the flowchart is a real process.

## Relation Engine

`work_item_relation(source_id, target_id, relation_type)` encodes:

```text
blocks | depends_on | relates_to | duplicates | implements | tested_by | fixed_by
```

This is the traceability graph: Requirement → Task → PR → Test → Release → Incident.

## Event Bus

Mutations emit `DomainEvent` + `Activity`. The worker and rule engine subscribe. Notifications, automations, and agents never patch the core use-case functions.

## Multi-tenant

```text
Organization → Workspace → Team / Project → WorkItem
```

JWT carries `user_id` + `workspace_id`. V0.5 adds RBAC / ABAC / audit / SSO.
