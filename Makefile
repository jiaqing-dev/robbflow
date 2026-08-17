.PHONY: help infra api web worker dev seed test lint fmt check-pnpm

# Homebrew node@22 is keg-only; corepack's pnpm lives there, not on default PATH.
export PATH := /opt/homebrew/opt/node@22/bin:/usr/local/opt/node@22/bin:$(PATH)

help:
	@echo "RobbFlow — Open Source Engineering Operating System"
	@echo ""
	@echo "  make infra    Start PostgreSQL + Redis"
	@echo "  make api      Run FastAPI (reload)"
	@echo "  make web      Run Next.js"
	@echo "  make worker   Run async worker"
	@echo "  make seed     Re-seed demo data"
	@echo "  make test     Run Python tests"
	@echo "  make lint     Ruff + frontend lint"

infra:
	docker compose up -d postgres redis

api:
	uv run --package robbflow-api uvicorn robbflow_api.main:app --reload --host 0.0.0.0 --port 8000

web:
	@$(MAKE) --no-print-directory check-pnpm
	pnpm --filter @robbflow/web dev

worker:
	uv run --package robbflow-worker python -m robbflow_worker

dev: infra
	@echo "Infra is up. In two terminals run: make api   and   make web"

seed:
	uv run --package robbflow-api python -m robbflow_api.seed

test:
	uv run pytest

lint:
	uv run ruff check apps packages
	@$(MAKE) --no-print-directory check-pnpm
	pnpm lint

check-pnpm:
	@command -v pnpm >/dev/null || { \
	  echo "找不到 pnpm。请先安装 Node 20+，然后执行："; \
	  echo "  corepack enable && corepack prepare pnpm@10.14.0 --activate"; \
	  echo "Homebrew node@22："; \
	  echo "  export PATH=\"/opt/homebrew/opt/node@22/bin:\$$PATH\""; \
	  exit 1; \
	}

fmt:
	uv run ruff format apps packages
