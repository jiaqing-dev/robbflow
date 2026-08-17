"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { dataApi } from "@/lib/api";

export default function SettingsPage() {
  const qc = useQueryClient();
  const types = useQuery({ queryKey: ["work-item-types"], queryFn: dataApi.workItemTypes });
  const workflows = useQuery({ queryKey: ["workflows"], queryFn: dataApi.workflows });
  const projects = useQuery({ queryKey: ["projects"], queryFn: dataApi.projects });
  const [prompt, setPrompt] = useState("帮我把登录模块重构一下，下周发布。");
  const [projectId, setProjectId] = useState("");
  const plan = useMutation({
    mutationFn: () => dataApi.plan(prompt, projectId || projects.data?.[0]?.id, true),
  });
  const saveType = useMutation({
    mutationFn: (row: { id: string; name: string; icon: string; color: string; fields: Array<Record<string, unknown>>; workflow_id: string | null }) =>
      dataApi.updateWorkItemType(row.id, row),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-item-types"] }),
  });

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <h1 className="mb-1 text-[18px] font-semibold tracking-tight">设置</h1>
      <p className="mb-8 text-[12px] text-[#8b90a0]">流程设计 · 工作项类型 · AI 助手</p>

      <section className="mb-10 max-w-3xl">
        <h2 className="mb-3 text-[13px] font-medium">流程与演示</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/workflows"
            className="rounded-xl border border-[#232633] bg-[#12141a] px-4 py-3 hover:border-[#3a3f52]"
          >
            <div className="text-[13px] font-medium">流程设计</div>
            <p className="mt-1 text-[12px] text-[#8b90a0]">状态机、类型关系图。日常入口在项目看板，编辑放在这里。</p>
          </Link>
          <Link
            href="/demo"
            className="rounded-xl border border-[#232633] bg-[#12141a] px-4 py-3 hover:border-[#3a3f52]"
          >
            <div className="text-[13px] font-medium">操作演示</div>
            <p className="mt-1 text-[12px] text-[#8b90a0]">走一遍从需求到缺陷的示例路径。</p>
          </Link>
        </div>
      </section>

      <section className="mb-10 max-w-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-medium">工作项类型</h2>
          <Link href="/workflows" className="text-[12px] text-[#ffb088]">
            打开流程目录 →
          </Link>
        </div>
        <div className="space-y-2">
          {(types.data ?? []).map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-lg border border-[#232633] bg-[#12141a] px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
              <span className="w-24 text-[13px]">{t.name}</span>
              <span className="w-20 font-mono text-[11px] text-[#6d7280]">{t.key}</span>
              <select
                value={t.workflow_id ?? ""}
                onChange={(e) =>
                  saveType.mutate({
                    id: t.id,
                    name: t.name,
                    icon: t.icon,
                    color: t.color,
                    fields: t.fields,
                    workflow_id: e.target.value || null,
                  })
                }
                className="flex-1 rounded border border-[#2a2e3a] bg-[#0b0c0e] px-2 py-1 text-[12px]"
              >
                <option value="">未绑定流程</option>
                {(workflows.data ?? []).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-[#6d7280]">{t.fields.length} 自定义字段</span>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-2xl">
        <h2 className="mb-2 text-[13px] font-medium">AI 助手（规则拆解）</h2>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="mb-2 rounded-md border border-[#232633] bg-[#0e1014] px-2 py-1.5 text-[12px]"
        >
          {(projects.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="h-24 w-full rounded-md border border-[#232633] bg-[#0e1014] p-3 text-[13px] outline-none focus:border-[#ff6a2b]"
        />
        <button
          onClick={() => plan.mutate()}
          disabled={plan.isPending}
          className="mt-2 rounded-md bg-[#ff6a2b] px-3 py-1.5 text-[12px] font-medium text-black"
        >
          拆解并创建
        </button>
        {plan.data && (
          <pre className="mt-3 overflow-auto rounded-md border border-[#232633] bg-[#0e1014] p-3 text-[11px] text-[#c4c8d4]">
            {JSON.stringify(plan.data, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
