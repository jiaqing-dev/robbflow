"""Parse Feishu / Lark document URLs for work-item references (no wiki storage)."""

from __future__ import annotations

from urllib.parse import unquote, urlparse

FEISHU_HOST_SUFFIXES = ("feishu.cn", "feishu.com", "larksuite.com", "larkoffice.com")


class InvalidDocLinkError(ValueError):
    pass


def is_feishu_host(host: str) -> bool:
    host = host.lower().split(":")[0]
    return any(host == suffix or host.endswith(f".{suffix}") for suffix in FEISHU_HOST_SUFFIXES)


def parse_feishu_doc(url: str) -> dict[str, str]:
    raw = url.strip()
    if not raw.startswith(("http://", "https://")):
        raise InvalidDocLinkError("请粘贴完整的飞书文档链接（以 https:// 开头）")
    parsed = urlparse(raw)
    if not is_feishu_host(parsed.netloc):
        raise InvalidDocLinkError("只支持飞书文档（feishu.cn / larksuite.com），不在系统内建 Wiki")
    parts = [unquote(p) for p in parsed.path.split("/") if p]
    title = parts[-1] if parts else "飞书文档"
    if title in {"docx", "docs", "wiki", "file", "drive"}:
        title = "飞书文档"
    if len(title) > 120:
        title = title[:120]
    kind = "wiki" if "/wiki/" in parsed.path else "docx" if "/docx/" in parsed.path else "doc"
    return {"url": raw, "title": title, "provider": "feishu", "kind": kind}
