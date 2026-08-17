"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useState } from "react";

import { ApiError, dataApi, type WorkItemLink } from "@/lib/api";
import { PROVIDER_LABEL } from "@/lib/labels";

export function FeishuDocs({ itemId }: { itemId: string }) {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const links = useQuery({
    queryKey: ["links", itemId],
    queryFn: () => dataApi.itemLinks(itemId),
  });
  const add = useMutation({
    mutationFn: () => dataApi.addItemLink(itemId, url.trim()),
    onSuccess: () => {
      setUrl("");
      setError("");
      qc.invalidateQueries({ queryKey: ["links", itemId] });
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : "无法添加文档");
    },
  });
  const remove = useMutation({
    mutationFn: (linkId: string) => dataApi.deleteItemLink(itemId, linkId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["links", itemId] }),
  });

  return (
    <div>
      <p className="mb-3 text-[12px] text-[#8b90a0]">
        粘贴飞书、钉钉或任意 https 链接即可引用。系统不建 Wiki，正文仍以外部文档为准。
      </p>
      <div className="mb-3 space-y-2">
        {(links.data ?? []).map((link) => (
          <DocRow key={link.id} link={link} onRemove={() => remove.mutate(link.id)} />
        ))}
        {(links.data ?? []).length === 0 && !links.isLoading && (
          <p className="text-[12px] text-[#6d7280]">还没有引用文档</p>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && url.trim()) add.mutate();
          }}
          placeholder="https://… 飞书 / 钉钉 / 文档链接"
          className="h-[34px] min-w-0 flex-1 rounded-md border border-[#232633] bg-[#0e1014] px-3 text-[12px] outline-none focus:border-[#ff6a2b]"
        />
        <button
          disabled={!url.trim() || add.isPending}
          onClick={() => add.mutate()}
          className="h-[34px] shrink-0 rounded-md bg-[#ff6a2b] px-3 text-[12px] text-black disabled:opacity-40"
        >
          引用
        </button>
      </div>
      {error && <p className="mt-2 text-[12px] text-rose-400">{error}</p>}
    </div>
  );
}

function DocRow({ link, onRemove }: { link: WorkItemLink; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-[#232633] px-3 py-2 text-[12px]">
      <span className="rounded bg-[#1a1d26] px-1.5 py-0.5 text-[10px] text-[#ffb088]">
        {PROVIDER_LABEL[link.provider] ?? link.provider}
      </span>
      <a
        href={link.url}
        target="_blank"
        rel="noreferrer"
        className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-[#eceef2] hover:text-white"
      >
        <span className="truncate">{link.title}</span>
        <ExternalLink size={11} className="shrink-0 text-[#6d7280]" />
      </a>
      <button onClick={onRemove} className="shrink-0 text-[#6d7280] hover:text-white">
        移除
      </button>
    </div>
  );
}
