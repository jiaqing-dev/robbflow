# 本地开发

1. 复制环境变量：`cp .env.example .env`
2. `make infra` 启动 PostgreSQL 16 与 Redis 7（宿主机端口 **15432** / **16379**，避免与本机已有 5432/6379 冲突）
3. `uv sync` 安装 Python workspace（API / worker / domain / workflow / …）
4. `pnpm install` 安装前端
5. 两个终端：`make api` 与 `make web`

API 文档：http://localhost:8000/docs  
Web：http://localhost:3000

演示用户由 API 启动时自动写入（`ROBBFLOW_SEED=true`）：

```text
demo@robbflow.dev / robbflow
```

Python 3.12+。系统若只有更旧的 Node，请使用 Homebrew 的 Node 20/22，并确保 `pnpm` 可用。
