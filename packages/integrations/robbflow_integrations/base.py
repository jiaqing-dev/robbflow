"""Unified office / git / drive connectors. Implementations never sync wiki bodies."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass
class DocRef:
    url: str
    title: str
    provider: str
    kind: str = "doc"
    external_id: str | None = None
    mime: str | None = None


@dataclass
class NotifyCard:
    title: str
    body: str
    url: str | None = None


class Connector(Protocol):
    key: str
    name: str

    async def identify(self, url: str) -> DocRef | None: ...

    async def notify(self, external_id: str, card: NotifyCard) -> bool: ...

    async def fetch_meta(self, external_id: str) -> dict[str, Any]: ...

    async def test_connection(self) -> bool: ...
