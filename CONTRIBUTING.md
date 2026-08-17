# 贡献指南

感谢你对 RobbFlow（萝卜）的兴趣。

## 原则

1. 这是 **Engineering OS**，不是「更漂亮的禅道」。改动应落在 Work Item / Workflow / Relation / Event / Agent 之一。
2. 不要为新业务对象新建一张宽表。优先 `work_item.type` + `properties` JSONB + schema definition。
3. 流程不要写死在路由里。状态流转走 `packages/workflow`。
4. 副作用走 Event Bus，不要在核心用例里堆通知 / 自动化逻辑。
5. 提交信息使用 Conventional Commits：`feat:` `fix:` `docs:` `refactor:` `test:` `chore:`。

## 本地开发

见 README「快速开始」。Python 测试：

```bash
uv run pytest
uv run ruff check apps packages
```

前端：

```bash
pnpm --filter @robbflow/web lint
```

## PR

- 小而完整：一个 PR 解决一个问题。
- 领域层变更请带测试（尤其是 Workflow 流转）。
- 不要提交 `.env`、密钥、本地数据库文件。
