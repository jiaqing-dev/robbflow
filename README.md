# RobbFlow · 萝卜

**Open Source Engineering Operating System**

面向中国企业研发团队的开源研发协作操作系统。把人、项目、需求、任务、代码、CI/CD、文档、质量、数据与 AI Agent 串成一条闭环——而不是再做一个禅道或 Jira 替代品。

```text
Project → Work → Workflow → Automation → AI
```

[快速开始](#快速开始) · [架构](docs/architecture/overview.md) · [产品定义](docs/product/vision.md) · [对标飞书项目](docs/product/feishu-benchmark.md) · [路线图](docs/product/roadmap.md)

---

## 定位

RobbFlow 是 **AI-native Engineering OS**：

| 层 | 能力 |
| --- | --- |
| Organization | 组织、用户、团队、权限、SSO |
| Project | 项目、产品、Roadmap、Milestone、Sprint |
| Work | 统一 Work Item：需求 / 任务 / Bug / 风险 / 测试 / 发布 |
| Workflow | 可配置状态机，而不是写死在代码里的流程 |
| Automation | 事件总线 + 规则引擎 |
| AI | Planner / Dev / Delivery Agent |

核心不是「项目管理」，而是 **企业工作对象关系系统**：所有对象都是 `Entity`，靠 `Relation` 追溯 **需求 → 代码 → 测试 → 发布 → 线上问题**。

## V0.2 已包含（对标飞书项目）

- 可编辑 Workflow：状态 / 流转持久化，可视化流程图（拖拽、连线）
- 自定义工作项类型：绑定流程 + JSONB 自定义字段
- 泳道图：按负责人 / 类型 / 优先级
- Relation 追溯图：需求 → 任务 → 缺陷
- Sprint / Milestone，Roadmap 时间线
- 非法流转由 Workflow Engine 拒绝（顺序前进 / 回退 / 取消）

### V0.2.x 日常手感

- 侧栏日常入口：收件箱、我的工作、项目、规划、设置（流程设计放在设置里）
- 项目中心：看板 / 泳道 / 列表 / 迭代；点事项用 Peek 侧栏，不离开当前页
- 看板拖拽改状态，非法列拒绝（仍走 Workflow Engine）
- 不做内建 Wiki：工作项上粘贴飞书文档链接即可引用

演示账号：`demo@robbflow.dev` / `robbflow`

## 技术栈

| 层 | 选型 |
| --- | --- |
| Web | Next.js · React · TypeScript · Tailwind CSS · TanStack Query |
| API | Python 3.12+ · FastAPI · SQLAlchemy 2 · Pydantic |
| Data | PostgreSQL · Redis · JSONB ·（后续 pgvector） |
| Monorepo | uv workspace · pnpm workspace |

## 仓库结构

```text
robbflow/
├── apps/web                 Next.js
├── apps/api                 FastAPI
├── apps/worker              Event worker
├── packages/domain          WorkItem / Org / Event 模型
├── packages/workflow        Workflow Engine
├── packages/automation      Rule Engine
├── packages/integrations    Git / IM / CI
├── packages/agent           AI Agent
├── infra/docker
└── docs/
```

## 快速开始

需要：**Docker**、**Python 3.12+**、**Node.js 20+**（推荐 22）。包管理器用 [uv](https://docs.astral.sh/uv/) 和 [pnpm](https://pnpm.io/) 10。

本地端口（避免和本机已有 Postgres/Redis 抢 5432 / 6379）：

| 服务 | 地址 |
| --- | --- |
| Web | http://localhost:3000 |
| API / Swagger | http://localhost:8000/docs |
| PostgreSQL | `localhost:15432` |
| Redis | `localhost:16379` |

### 1. 安装工具

**macOS（Homebrew）**

```bash
brew install python@3.12 node@22 docker

# uv：Python 工作区
curl -LsSf https://astral.sh/uv/install.sh | sh

# pnpm：与仓库 packageManager 对齐
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
corepack enable
corepack prepare pnpm@10.14.0 --activate
```

系统自带 Node 过旧（例如 v14）时，必须把 `node@22` 放到 `PATH` 前面，否则 `pnpm` / Next.js 无法启动。

**确认版本**

```bash
python3 --version    # >= 3.12
node --version       # >= 20
uv --version
pnpm --version       # 10.x
docker compose version
```

`uv` 也可以自己拉 Python，不必先装系统 Python：

```bash
uv python install 3.12
```

### 2. 克隆与环境变量

```bash
git clone https://github.com/robbflow/robbflow.git
cd robbflow
cp .env.example .env
```

`.env` 会被 FastAPI（`pydantic-settings`）读取，常用项：

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | 默认 `postgresql+asyncpg://robbflow:robbflow@localhost:15432/robbflow` |
| `REDIS_URL` | 默认 `redis://localhost:16379/0` |
| `SEED` | 默认 `true`，API 启动时写入演示数据 |
| `NEXT_PUBLIC_API_URL` | 前端请求的 API，默认 `http://127.0.0.1:8000` |
| `JWT_SECRET` | 开发可沿用示例值，生产必须更换 |

### 3. 安装依赖

```bash
uv sync             # Python workspace：api / worker / domain / workflow / …
pnpm install        # 前端 apps/web
```

`uv sync` 会按根目录 `pyproject.toml` 安装 workspace 成员，并带上开发依赖（pytest、ruff）。`pnpm install` 只装 `apps/web`（见 `pnpm-workspace.yaml`）。

### 4. 启动

三个终端（或先起基础设施，再起 API 与 Web）：

```bash
make infra          # PostgreSQL 16 + Redis 7（后台）
make api            # FastAPI，热重载  http://localhost:8000
make web            # Next.js          http://localhost:3000
```

等价命令（不依赖 Make 时）：

```bash
docker compose up -d postgres redis

uv run --package robbflow-api uvicorn robbflow_api.main:app --reload --host 0.0.0.0 --port 8000

pnpm --filter @robbflow/web dev
# 或：pnpm dev
```

API 启动时会 `create_all` 并补齐新列；`SEED=true` 时自动写入演示工作区。

打开 http://127.0.0.1:3000 登录：

```text
demo@robbflow.dev / robbflow
lin@robbflow.dev  / robbflow    # 第二成员「林间」，用于指派/协作
```

可选：

```bash
make worker         # 异步 worker
make seed           # 手动再跑一遍演示数据（幂等）
```

### 常用命令

```bash
make help           # 列出目标
make test           # uv run pytest
make lint           # ruff + 前端 lint
make fmt            # ruff format
```

```bash
uv run pytest
uv run ruff check apps packages
pnpm --filter @robbflow/web lint
```

### 常见问题

- **15432 / 16379 端口被占用**：改 `docker-compose.yml` 的宿主机端口，并同步 `.env` 里的 `DATABASE_URL` / `REDIS_URL`。
- **`make web` 报 `pnpm: No such file or directory`**：pnpm 由 corepack 提供，常在 Homebrew `node@22` 目录里。Makefile 已自动把该路径加入 `PATH`。也可在当前 shell 执行：

```bash
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
corepack enable && corepack prepare pnpm@10.14.0 --activate
which pnpm   # 应能打印路径
make web
```
- **Next 报 Node 版本过低**：确认 `node -v` 为 20+，Homebrew 用户检查 PATH 是否指向 `node@22`。
- **API 连不上数据库**：先 `docker compose ps`，等 Postgres `healthy` 后再 `make api`。
- **登录失败 / Failed to fetch**：前端在 3000，API 必须单独开着。先 `make infra`，再 `make api`，最后 `make web`。浏览器请访问 http://127.0.0.1:3000（不要只开前端）。API 地址用 `127.0.0.1` 而不是 `localhost`，避免 macOS 把 localhost 解析到 IPv6。
- **前端接口 401 / 连错地址**：检查 `NEXT_PUBLIC_API_URL`（默认 `http://127.0.0.1:8000`），改完需重启 `make web`。

## 许可与商业模式

Community Edition 以 **Apache 2.0** 发布，核心功能完整、可私有化部署。

Enterprise / Cloud / AI 将覆盖 SSO、高级权限、审计、HA 与托管服务——而不是把社区版阉割一半再卖 License。

## 状态

V0.2 可运行：自定义工作项 / 流程、可视化流程图与泳道图、Relation 追溯、Sprint / Milestone。欢迎 Issue 与 PR。见 [CONTRIBUTING.md](CONTRIBUTING.md)。
