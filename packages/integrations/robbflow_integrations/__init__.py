"""Git / IM / CI integration stubs. Implemented in V0.3."""

from __future__ import annotations


class Integration:
    key: str
    name: str

    async def test_connection(self) -> bool:
        return False


class GitHubIntegration(Integration):
    key = "github"
    name = "GitHub"


class GitLabIntegration(Integration):
    key = "gitlab"
    name = "GitLab"


class LarkIntegration(Integration):
    key = "lark"
    name = "飞书"


class WeComIntegration(Integration):
    key = "wecom"
    name = "企业微信"


class DingTalkIntegration(Integration):
    key = "dingtalk"
    name = "钉钉"


REGISTRY: dict[str, type[Integration]] = {
    cls.key: cls
    for cls in (
        GitHubIntegration,
        GitLabIntegration,
        LarkIntegration,
        WeComIntegration,
        DingTalkIntegration,
    )
}
