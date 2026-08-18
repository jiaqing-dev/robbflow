"""Identify external document URLs (Feishu / DingTalk / generic). Not a wiki."""

from __future__ import annotations

from urllib.parse import unquote, urlparse

from robbflow_domain.feishu_docs import InvalidDocLinkError, is_feishu_host

DINGTALK_HOST_SUFFIXES = ("dingtalk.com", "dingtalkapps.com")


def is_dingtalk_host(host: str) -> bool:
    host = host.lower().split(":")[0]
    return any(host == suffix or host.endswith(f".{suffix}") for suffix in DINGTALK_HOST_SUFFIXES)


def parse_doc_url(url: str) -> dict[str, str]:
    raw = url.strip()
    if not raw.startswith(("http://", "https://")):
        raise InvalidDocLinkError("请粘贴完整链接（以 https:// 开头）")
    parsed = urlparse(raw)
    host = parsed.netloc
    parts = [unquote(p) for p in parsed.path.split("/") if p]
    title = parts[-1] if parts else "文档"
    if len(title) > 120:
        title = title[:120]
    if is_feishu_host(host):
        kind = "wiki" if "/wiki/" in parsed.path else "docx" if "/docx/" in parsed.path else "doc"
        if title in {"docx", "docs", "wiki", "file", "drive"}:
            title = "飞书文档"
        return {"url": raw, "title": title, "provider": "feishu", "kind": kind}
    if is_dingtalk_host(host):
        if title in {"document", "docs", "i"}:
            title = "钉钉文档"
        return {"url": raw, "title": title, "provider": "dingtalk", "kind": "doc"}
    return {"url": raw, "title": title or parsed.netloc, "provider": "url", "kind": "doc"}
