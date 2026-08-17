"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { dataApi, type WorkflowState, type WorkflowTransition } from "@/lib/api";
import { isDiagramTransition } from "@/lib/flow-diagram";
import { CATEGORY_LABEL } from "@/lib/labels";

const WorkflowCanvas = dynamic(
  () => import("@/components/workflow-canvas").then((m) => m.WorkflowCanvas),
  {
    ssr: false,
    loading: () => <div className="px-6 py-16 text-[13px] text-[#6d7280]">加载流程图…</div>,
  },
);

export default function WorkflowEditorPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const wf = useQuery({ queryKey: ["workflow", id], queryFn: () => dataApi.workflow(id) });
  const [draft, setDraft] = useState<{
    states: WorkflowState[];
    transitions: WorkflowTransition[];
  } | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [tab, setTab] = useState<"nodes" | "links">("nodes");

  const current = useMemo(() => {
    if (!wf.data) return null;
    return {
      ...wf.data,
      states: draft?.states ?? wf.data.states,
      transitions: draft?.transitions ?? wf.data.transitions,
    };
  }, [wf.data, draft]);

  const save = useMutation({
    mutationFn: () => {
      if (!wf.data || !current) throw new Error("no workflow");
      const keys = current.states.map((s) => s.key);
      if (new Set(keys).size !== keys.length) {
        throw new Error("状态标识重复。请给每个节点一个唯一标识后再保存。");
      }
      return dataApi.saveWorkflow(id, {
        name: wf.data.name,
        description: wf.data.description,
        is_default: wf.data.is_default,
        states: current.states,
        transitions: current.transitions,
      });
    },
    onSuccess: (saved) => {
      setDraft({ states: saved.states, transitions: saved.transitions });
      qc.setQueryData(["workflow", id], saved);
      qc.invalidateQueries({ queryKey: ["workflows"] });
    },
  });

  function patchState(key: string, patch: Partial<WorkflowState>) {
    if (!current) return;
    setDraft({
      states: current.states.map((s) => (s.key === key ? { ...s, ...patch } : s)),
      transitions: current.transitions,
    });
  }

  function renameState(oldKey: string, nextKey: string) {
    if (!current) return;
    const key = nextKey.trim().replace(/\s+/g, "_").slice(0, 64);
    if (!key || key === oldKey) return;
    if (current.states.some((s) => s.key === key)) return;
    setDraft({
      states: current.states.map((s) => (s.key === oldKey ? { ...s, key } : s)),
      transitions: current.transitions.map((t) => ({
        ...t,
        from_state: t.from_state === oldKey ? key : t.from_state,
        to_state: t.to_state === oldKey ? key : t.to_state,
      })),
    });
    if (selectedKey === oldKey) setSelectedKey(key);
  }

  function addState() {
    if (!current) return;
    const used = new Set(current.states.map((s) => s.key));
    let n = current.states.length + 1;
    let key = `state_${n}`;
    while (used.has(key)) {
      n += 1;
      key = `state_${n}`;
    }
    setDraft({
      states: [
        ...current.states,
        {
          key,
          name: `新状态 ${n}`,
          category: "started",
          color: "#38bdf8",
          position: current.states.length,
          layout_x: 80 + current.states.length * 320,
          layout_y: 96,
        },
      ],
      transitions: current.transitions,
    });
    setSelectedKey(key);
  }

  function addTransition() {
    if (!current || current.states.length < 2) return;
    const from = selectedKey && current.states.some((s) => s.key === selectedKey)
      ? selectedKey
      : current.states[0].key;
    const to = current.states.find((s) => s.key !== from)?.key ?? current.states[0].key;
    if (current.transitions.some((t) => t.from_state === from && t.to_state === to)) return;
    setDraft({
      states: current.states,
      transitions: [...current.transitions, { from_state: from, to_state: to, name: "前进", require_role: null, require_approver: false }],
    });
    setTab("links");
  }

  if (wf.isLoading || !current) {
    return <div className="px-6 py-16 text-[13px] text-[#6d7280]">加载流程图…</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-[#232633] px-6 py-3">
        <div>
          <div className="mb-0.5 text-[12px] text-[#8b90a0]">
            <Link href="/workflows" className="hover:text-[#ffb088]">
              流程设计
            </Link>
            <span className="mx-1">/</span>
            状态流转
          </div>
          <h1 className="text-[16px] font-semibold">{current.name}</h1>
          <p className="text-[12px] text-[#8b90a0]">图上只画前向流转；回退、取消仍可在「流转」表里配置，不会画到图上。</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={addState}
            className="rounded-md border border-[#232633] px-3 py-1.5 text-[12px]"
          >
            添加状态
          </button>
          <button
            onClick={addTransition}
            className="rounded-md border border-[#232633] px-3 py-1.5 text-[12px]"
          >
            添加流转
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="rounded-md bg-[#ff6a2b] px-3 py-1.5 text-[12px] font-medium text-black"
          >
            {save.isPending ? "保存中…" : "保存流程"}
          </button>
        </div>
      </header>
      {save.isError && (
        <div className="border-b border-rose-500/30 bg-rose-500/10 px-6 py-2 text-[12px] text-rose-300">
          {(save.error as Error).message || "保存失败"}
        </div>
      )}
      <div className="min-h-[280px] flex-[3] border-b border-[#232633]">
        <WorkflowCanvas
          workflow={current}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          onChange={(next) => setDraft(next)}
        />
      </div>
      <div className="flex min-h-[200px] flex-[2] flex-col overflow-hidden">
        <div className="flex gap-1 border-b border-[#232633] px-3 py-1.5 text-[12px]">
          <button
            onClick={() => setTab("nodes")}
            className={`rounded px-2.5 py-1 ${tab === "nodes" ? "bg-[#1a1d26] text-white" : "text-[#8b90a0]"}`}
          >
            节点
          </button>
          <button
            onClick={() => setTab("links")}
            className={`rounded px-2.5 py-1 ${tab === "links" ? "bg-[#1a1d26] text-white" : "text-[#8b90a0]"}`}
          >
            流转
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {tab === "nodes" ? (
            <table className="w-full text-left text-[12px]">
              <thead className="sticky top-0 bg-[#0e1014] text-[#6d7280]">
                <tr>
                  <th className="px-3 py-2 font-normal">名称</th>
                  <th className="px-3 py-2 font-normal">标识</th>
                  <th className="px-3 py-2 font-normal">分类</th>
                  <th className="px-3 py-2 font-normal">颜色</th>
                </tr>
              </thead>
              <tbody>
                {current.states.map((s) => (
                  <tr
                    key={s.key}
                    onClick={() => setSelectedKey(s.key)}
                    className={`cursor-pointer border-t border-[#1b1e27] ${
                      selectedKey === s.key ? "bg-[#1a1d26]" : "hover:bg-[#12141a]"
                    }`}
                  >
                    <td className="px-3 py-1.5">
                      <input
                        value={s.name}
                        onChange={(e) => patchState(s.key, { name: e.target.value })}
                        className="w-full bg-transparent outline-none"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        key={s.key}
                        defaultValue={s.key}
                        onBlur={(e) => renameState(s.key, e.target.value)}
                        className="w-full bg-transparent font-mono text-[#8b90a0] outline-none"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        value={s.category}
                        onChange={(e) => patchState(s.key, { category: e.target.value })}
                        className="bg-transparent"
                      >
                        {Object.entries(CATEGORY_LABEL).map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="color"
                        value={s.color}
                        onChange={(e) => patchState(s.key, { color: e.target.value })}
                        className="h-6 w-8 cursor-pointer bg-transparent"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-[12px]">
              <thead className="sticky top-0 bg-[#0e1014] text-[#6d7280]">
                <tr>
                  <th className="px-3 py-2 font-normal">从</th>
                  <th className="px-3 py-2 font-normal">动作</th>
                  <th className="px-3 py-2 font-normal">到</th>
                  <th className="px-3 py-2 font-normal">谁能过</th>
                  <th className="px-3 py-2 font-normal">负责人</th>
                  <th className="px-3 py-2 font-normal">图上</th>
                  <th className="px-3 py-2 font-normal" />
                </tr>
              </thead>
              <tbody>
                {current.transitions.map((t, i) => (
                  <tr
                    key={`${t.from_state}-${t.to_state}-${i}`}
                    className={`border-t border-[#1b1e27] ${
                      isDiagramTransition(t, current.states) ? "" : "text-[#6d7280]"
                    }`}
                  >
                    <td className="px-3 py-1.5">
                      <select
                        value={t.from_state}
                        onChange={(e) => {
                          const next = current.transitions.map((row, idx) =>
                            idx === i ? { ...row, from_state: e.target.value } : row,
                          );
                          setDraft({ states: current.states, transitions: next });
                        }}
                        className="bg-transparent"
                      >
                        {current.states.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        value={t.name ?? ""}
                        onChange={(e) => {
                          const next = current.transitions.map((row, idx) =>
                            idx === i ? { ...row, name: e.target.value } : row,
                          );
                          setDraft({ states: current.states, transitions: next });
                        }}
                        className="w-full bg-transparent outline-none"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        value={t.to_state}
                        onChange={(e) => {
                          const next = current.transitions.map((row, idx) =>
                            idx === i ? { ...row, to_state: e.target.value } : row,
                          );
                          setDraft({ states: current.states, transitions: next });
                        }}
                        className="bg-transparent"
                      >
                        {current.states.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        value={t.require_role ?? ""}
                        onChange={(e) => {
                          const next = current.transitions.map((row, idx) =>
                            idx === i ? { ...row, require_role: e.target.value || null } : row,
                          );
                          setDraft({ states: current.states, transitions: next });
                        }}
                        className="bg-transparent"
                      >
                        <option value="">任何人</option>
                        <option value="member">成员</option>
                        <option value="admin">管理员</option>
                        <option value="owner">所有者</option>
                        <option value="assignee">负责人</option>
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={Boolean(t.require_approver)}
                        onChange={(e) => {
                          const next = current.transitions.map((row, idx) =>
                            idx === i ? { ...row, require_approver: e.target.checked } : row,
                          );
                          setDraft({ states: current.states, transitions: next });
                        }}
                      />
                    </td>
                    <td className="px-3 py-1.5 text-[11px] text-[#6d7280]">
                      {isDiagramTransition(t, current.states) ? "显示" : "不画"}
                    </td>
                    <td className="px-3 py-1.5">
                      <button
                        onClick={() =>
                          setDraft({
                            states: current.states,
                            transitions: current.transitions.filter((_, idx) => idx !== i),
                          })
                        }
                        className="text-[#6d7280]"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
