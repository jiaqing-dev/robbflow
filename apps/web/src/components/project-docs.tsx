"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useState } from "react";

import { ApiError, dataApi } from "@/lib/api";
import { PROVIDER_LABEL } from "@/lib/labels";

export function ProjectDocs({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [error, setError] = useState("");
  const docs = useQuery({
    queryKey: ["documents", projectId],
    queryFn: () => dataApi.documents({ project_id: projectId }),
  });
  const addLink = useMutation({
    mutationFn: () => dataApi.createDocument({ project_id: projectId, url: url.trim() }),
    onSuccess: () => {
      setUrl("");
      setError("");
      qc.invalidateQueries({ queryKey: ["documents", projectId] });
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : "无法添加"),
  });
  const addNote = useMutation({
    mutationFn: () =>
      dataApi.createDocument({
        project_id: projectId,
        kind: "note",
        title: noteTitle.trim() || "短文",
        body: noteBody,
      }),
    onSuccess: () => {
      setNoteTitle("");
      setNoteBody("");
      setError("");
      qc.invalidateQueries({ queryKey: ["documents", projectId] });
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : "无法保存短文"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => dataApi.deleteDocument(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents", projectId] }),
  });

  return (
    <div className="h-full overflow-y-auto px-6 pb-10">
      <h2 className="mb-1 text-[14px] font-medium">项目文档库</h2>
      <p className="mb-5 text-[12px] text-[#8b90a0]">
        平铺引用飞书 / 钉钉 / 网盘链接，或写一篇 Markdown 短文。不做 Wiki、目录树或协同编辑。
      </p>
      <div className="mb-6 max-w-2xl space-y-2">
        {(docs.data ?? []).map((doc) => (
          <div key={doc.id} className="rounded-lg border border-[#232633] bg-[#12141a] px-3 py-2.5">
            <div className="flex items-center gap-2 text-[12px]">
              <span className="rounded bg-[#1a1d26] px-1.5 py-0.5 text-[10px] text-[#ffb088]">
                {PROVIDER_LABEL[doc.provider] ?? doc.provider}
              </span>
              {doc.url ? (
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 flex-1 items-center gap-1 truncate hover:text-white"
                >
                  <span className="truncate">{doc.title}</span>
                  <ExternalLink size={11} className="shrink-0 text-[#6d7280]" />
                </a>
              ) : (
                <span className="flex-1 truncate">{doc.title}</span>
              )}
              <button onClick={() => remove.mutate(doc.id)} className="text-[#6d7280] hover:text-white">
                移除
              </button>
            </div>
            {doc.kind === "note" && doc.body && (
              <pre className="mt-2 whitespace-pre-wrap text-[12px] text-[#b4b8c5]">{doc.body}</pre>
            )}
          </div>
        ))}
        {(docs.data ?? []).length === 0 && !docs.isLoading && (
          <p className="text-[12px] text-[#6d7280]">还没有文档。粘贴链接或写一篇短文。</p>
        )}
      </div>
      <div className="mb-8 max-w-2xl">
        <div className="mb-2 text-[12px] text-[#8b90a0]">粘贴外部链接</div>
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && url.trim()) addLink.mutate();
            }}
            placeholder="https://… 飞书 / 钉钉 / 网盘 / 任意 https"
            className="h-[34px] min-w-0 flex-1 rounded-md border border-[#232633] bg-[#0e1014] px-3 text-[12px] outline-none focus:border-[#ff6a2b]"
          />
          <button
            disabled={!url.trim() || addLink.isPending}
            onClick={() => addLink.mutate()}
            className="h-[34px] rounded-md bg-[#ff6a2b] px-3 text-[12px] text-black disabled:opacity-40"
          >
            引用
          </button>
        </div>
      </div>
      <div className="max-w-2xl">
        <div className="mb-2 text-[12px] text-[#8b90a0]">Markdown 短文（规格 / 纪要）</div>
        <input
          value={noteTitle}
          onChange={(e) => setNoteTitle(e.target.value)}
          placeholder="标题"
          className="mb-2 h-[34px] w-full rounded-md border border-[#232633] bg-[#0e1014] px-3 text-[12px] outline-none focus:border-[#ff6a2b]"
        />
        <textarea
          value={noteBody}
          onChange={(e) => setNoteBody(e.target.value)}
          placeholder="正文，支持 Markdown"
          className="mb-2 h-28 w-full rounded-md border border-[#232633] bg-[#0e1014] p-3 text-[13px] outline-none focus:border-[#ff6a2b]"
        />
        <button
          disabled={!noteBody.trim() || addNote.isPending}
          onClick={() => addNote.mutate()}
          className="rounded-md bg-[#ff6a2b] px-3 py-1.5 text-[12px] font-medium text-black disabled:opacity-40"
        >
          保存短文
        </button>
      </div>
      {error && <p className="mt-3 text-[12px] text-rose-400">{error}</p>}
    </div>
  );
}
