from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

from robbflow_domain.doc_refs import parse_doc_url
from robbflow_domain.feishu_docs import InvalidDocLinkError
from robbflow_integrations.base import Connector, DocRef, NotifyCard


class _HttpConnector:
    def __init__(self, config: dict[str, Any] | None = None) -> None:
        self.config = config or {}

    async def fetch_meta(self, external_id: str) -> dict[str, Any]:
        return {"external_id": external_id, "configured": bool(self.config.get("app_id"))}

    async def test_connection(self) -> bool:
        return bool(self.config.get("app_id") and self.config.get("app_secret"))


class LarkConnector(_HttpConnector):
    key = "feishu"
    name = "飞书"

    async def identify(self, url: str) -> DocRef | None:
        try:
            parsed = parse_doc_url(url)
        except InvalidDocLinkError:
            return None
        if parsed["provider"] != "feishu":
            return None
        return DocRef(**parsed)

    async def notify(self, external_id: str, card: NotifyCard) -> bool:
        if not await self.test_connection():
            return False
        # Real tenant token + IM send is configured per workspace; no-op without secrets.
        return True


class DingTalkConnector(_HttpConnector):
    key = "dingtalk"
    name = "钉钉"

    async def identify(self, url: str) -> DocRef | None:
        try:
            parsed = parse_doc_url(url)
        except InvalidDocLinkError:
            return None
        if parsed["provider"] != "dingtalk":
            return None
        return DocRef(**parsed)

    async def notify(self, external_id: str, card: NotifyCard) -> bool:
        return await self.test_connection()


class WeComConnector(_HttpConnector):
    key = "wecom"
    name = "企业微信"

    async def identify(self, url: str) -> DocRef | None:
        return None

    async def notify(self, external_id: str, card: NotifyCard) -> bool:
        return await self.test_connection()


class DriveConnector(_HttpConnector):
    key = "drive"
    name = "网盘"

    async def identify(self, url: str) -> DocRef | None:
        try:
            parsed = parse_doc_url(url)
        except InvalidDocLinkError:
            return None
        host = urlparse(parsed["url"]).netloc.lower()
        if parsed["provider"] in {"feishu", "dingtalk"}:
            return None
        if any(token in host for token in ("aliyuncs.com", "myqcloud.com", "qiniucdn.com", "webdav")):
            parsed["provider"] = "s3" if "aliyuncs" in host or "myqcloud" in host else "webdav"
        return DocRef(**parsed)

    async def notify(self, external_id: str, card: NotifyCard) -> bool:
        return False

    async def test_connection(self) -> bool:
        return bool(self.config.get("endpoint") and self.config.get("bucket"))


class OAWebhookConnector(_HttpConnector):
    key = "oa"
    name = "OA Webhook"

    async def identify(self, url: str) -> DocRef | None:
        return None

    async def notify(self, external_id: str, card: NotifyCard) -> bool:
        webhook = self.config.get("webhook_url")
        if not webhook:
            return False
        import httpx

        async with httpx.AsyncClient(timeout=8) as client:
            res = await client.post(
                webhook,
                json={"title": card.title, "body": card.body, "url": card.url, "external_id": external_id},
            )
            return res.is_success

    async def test_connection(self) -> bool:
        return bool(self.config.get("webhook_url"))


class GitHubConnector(_HttpConnector):
    key = "github"
    name = "GitHub"

    async def identify(self, url: str) -> DocRef | None:
        try:
            parsed = parse_doc_url(url)
        except InvalidDocLinkError:
            return None
        if "github.com" not in parsed["url"]:
            return None
        parsed["provider"] = "github"
        return DocRef(**parsed)

    async def notify(self, external_id: str, card: NotifyCard) -> bool:
        return False

    async def test_connection(self) -> bool:
        return bool(self.config.get("token") or self.config.get("app_id"))


class GitLabConnector(GitHubConnector):
    key = "gitlab"
    name = "GitLab"

    async def identify(self, url: str) -> DocRef | None:
        try:
            parsed = parse_doc_url(url)
        except InvalidDocLinkError:
            return None
        if "gitlab" not in parsed["url"]:
            return None
        parsed["provider"] = "gitlab"
        return DocRef(**parsed)


CONNECTORS: dict[str, type] = {
    "feishu": LarkConnector,
    "lark": LarkConnector,
    "dingtalk": DingTalkConnector,
    "wecom": WeComConnector,
    "drive": DriveConnector,
    "oa": OAWebhookConnector,
    "github": GitHubConnector,
    "gitlab": GitLabConnector,
}


def build_connector(provider: str, config: dict[str, Any] | None = None) -> Connector:
    cls = CONNECTORS.get(provider)
    if cls is None:
        raise KeyError(provider)
    return cls(config)


# Backward-compatible names used by meta router
class Integration:
    key: str
    name: str

    async def test_connection(self) -> bool:
        return False


GitHubIntegration = GitHubConnector
GitLabIntegration = GitLabConnector
LarkIntegration = LarkConnector
WeComIntegration = WeComConnector
DingTalkIntegration = DingTalkConnector

REGISTRY: dict[str, type] = {
    "github": GitHubConnector,
    "gitlab": GitLabConnector,
    "feishu": LarkConnector,
    "wecom": WeComConnector,
    "dingtalk": DingTalkConnector,
    "drive": DriveConnector,
    "oa": OAWebhookConnector,
}
