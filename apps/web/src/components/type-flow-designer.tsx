"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { DetailLayoutEditor } from "@/components/detail-layout-editor";
import { PROJECT_NODE_KEY, TypeFlowCanvas, edgesFromTypes } from "@/components/type-flow-canvas";
import { dataApi, type TypeGraphEdge, type WorkItemType } from "@/lib/api";
import { typeFields } from "@/lib/detail-layout";
import { uniqueForwardTypeEdges } from "@/lib/flow-diagram";
import { RELATION_LABEL } from "@/lib/labels";

const FIELD_TYPES = [
  ["text", "文本"],
  ["number", "数字"],
  ["select", "单选"],
  ["date", "日期"],
  ["user", "人员"],
  ["textarea", "多行文本"],
] as const;

const REL_OPTIONS = Object.entries(RELATION_LABEL);

type FieldRow = { key: string; name: string; type: string; options?: string[] };

function asFields(raw: Array<Record<string, unknown>>): FieldRow[] {
  return raw.map((f) => ({
    key: String(f.key ?? ""),
    name: String(f.name ?? ""),
    type: String(f.type ?? "text"),
    options: Array.isArray(f.options) ? f.options.map(String) : undefined,
  }));
}

export function TypeFlowDesigner() {
  const qc = useQueryClient();
  const typesQuery = useQuery({ queryKey: ["work-item-types"], queryFn: dataApi.workItemTypes });
  const workflows = useQuery({ queryKey: ["workflows"], queryFn: dataApi.workflows });
  const [draftTypes, setDraftTypes] = useState<WorkItemType[] | null>(null);
  const [draftEdges, setDraftEdges] = useState<TypeGraphEdge[] | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>("requirement");
  const [tab, setTab] = useState<"nodes" | "fields" | "links" | "layout">("nodes");
  const [error, setError] = useState("");
  const [newLink, setNewLink] = useState({ source: "", relation: "relates_to", target: "", label: "" });

  useEffect(() => {
    if (!typesQuery.data) return;
    setDraftTypes((prev) => prev ?? typesQuery.data);
    setDraftEdges((prev) => prev ?? edgesFromTypes(typesQuery.data));
  }, [typesQuery.data]);

  const types = draftTypes ?? typesQuery.data ?? [];
  const edges = useMemo(() => uniqueForwardTypeEdges(draftEdges ?? []), [draftEdges]);
  const selected = types.find((t) => t.key === selectedKey) ?? null;

  const save = useMutation({
    mutationFn: () =>
      dataApi.saveTypeGraph({
        nodes: types.map((t) => ({
          id: t.id,
          layout_x: t.layout_x ?? 0,
          layout_y: t.layout_y ?? 0,
          name: t.name,
          color: t.color,
          description: t.description,
          fields: t.fields,
          workflow_id: t.workflow_id,
          detail_layout: t.detail_layout ?? null,
        })),
        edges: uniqueForwardTypeEdges(edges),
      }),
    onSuccess: (rows) => {
      qc.setQueryData(["work-item-types"], rows);
      setDraftTypes(rows);
      setDraftEdges(edgesFromTypes(rows));
      setError("");
    },
    onError: (err: Error) => setError(err.message),
  });

  const createType = useMutation({
    mutationFn: () => {
      const n = types.length + 1;
      return dataApi.createWorkItemType({
        name: `自定义类型 ${n}`,
        key: `custom_${n}`,
        color: "#38bdf8",
        fields: [],
        inputs: [],
        outputs: [],
        layout_x: 520,
        layout_y: 420,
      });
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["work-item-types"] });
      setDraftTypes((prev) => [...(prev ?? []), row]);
      setSelectedKey(row.key);
    },
  });

  function patchType(key: string, patch: Partial<WorkItemType>) {
    setDraftTypes(types.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  }

  function patchField(index: number, patch: Partial<FieldRow>) {
    if (!selected) return;
    const fields = asFields(selected.fields);
    fields[index] = { ...fields[index], ...patch };
    patchType(selected.key, { fields });
  }

  function addField() {
    if (!selected) return;
    const fields = asFields(selected.fields);
    fields.push({ key: `field_${fields.length + 1}`, name: "新字段", type: "text" });
    patchType(selected.key, { fields });
  }

  function removeField(index: number) {
    if (!selected) return;
    patchType(selected.key, { fields: asFields(selected.fields).filter((_, i) => i !== index) });
  }

  if (typesQuery.isLoading) {
    return <div className="px-6 py-16 text-[13px] text-[#6d7280]">加载流程设计…</div>;
  }
  if (typesQuery.isError) {
    return (
      <div className="px-6 py-16 text-[13px] text-rose-300">
        无法加载工作项类型。请确认 API 已启动后刷新。
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-[#232633] px-4 py-2">
        <p className="text-[12px] text-[#8b90a0]">
          图上只画前向关系（一对节点一条箭头）。回边不会画出。下方「连接」页签可增删。
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => createType.mutate()}
            className="rounded-md border border-[#232633] px-3 py-1.5 text-[12px]"
          >
            新建类型
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="rounded-md bg-[#ff6a2b] px-3 py-1.5 text-[12px] font-medium text-black"
          >
            {save.isPending ? "保存中…" : "保存流程"}
          </button>
        </div>
      </div>
      {error && <div className="px-4 py-1 text-[12px] text-rose-400">{error}</div>}
      <div className="min-h-[280px] flex-[3] border-b border-[#232633]">
        <TypeFlowCanvas
          types={types}
          edges={edges}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          onChange={(next) => {
            setDraftTypes(next.types);
            setDraftEdges(next.edges);
          }}
        />
      </div>
      <div className="flex min-h-[220px] flex-[2] flex-col overflow-hidden">
        <div className="flex items-center gap-1 border-b border-[#232633] px-3 py-1.5 text-[12px]">
          {(
            [
              ["nodes", "节点"],
              ["fields", "字段"],
              ["links", "连接"],
              ["layout", "详情页"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded px-2.5 py-1 ${tab === key ? "bg-[#1a1d26] text-white" : "text-[#8b90a0]"}`}
            >
              {label}
            </button>
          ))}
          {selected && tab !== "links" && (
            <span className="ml-2 text-[11px] text-[#6d7280]">当前：{selected.name}</span>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {tab === "nodes" && (
            <table className="w-full text-left text-[12px]">
              <thead className="sticky top-0 bg-[#0e1014] text-[#6d7280]">
                <tr>
                  <th className="px-3 py-2 font-normal">名称</th>
                  <th className="px-3 py-2 font-normal">标识</th>
                  <th className="px-3 py-2 font-normal">颜色</th>
                  <th className="px-3 py-2 font-normal">绑定状态流</th>
                  <th className="px-3 py-2 font-normal">说明</th>
                </tr>
              </thead>
              <tbody>
                {types.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedKey(t.key)}
                    className={`cursor-pointer border-t border-[#1b1e27] ${
                      selectedKey === t.key ? "bg-[#1a1d26]" : "hover:bg-[#12141a]"
                    }`}
                  >
                    <td className="px-3 py-1.5">
                      <input
                        value={t.name}
                        onChange={(e) => patchType(t.key, { name: e.target.value })}
                        className="w-full bg-transparent outline-none"
                      />
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[#8b90a0]">{t.key}</td>
                    <td className="px-3 py-1.5">
                      <input
                        type="color"
                        value={t.color}
                        onChange={(e) => patchType(t.key, { color: e.target.value })}
                        className="h-6 w-8 cursor-pointer bg-transparent"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        value={t.workflow_id ?? ""}
                        onChange={(e) => patchType(t.key, { workflow_id: e.target.value || null })}
                        className="w-full bg-transparent"
                      >
                        <option value="">未绑定</option>
                        {(workflows.data ?? []).map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        value={t.description ?? ""}
                        onChange={(e) => patchType(t.key, { description: e.target.value })}
                        className="w-full bg-transparent outline-none text-[#b4b8c5]"
                        placeholder="用途说明"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "fields" && (
            <div>
              {!selected ? (
                <div className="px-4 py-8 text-center text-[12px] text-[#6d7280]">请先在图上点选一个类型节点</div>
              ) : (
                <>
                  <table className="w-full text-left text-[12px]">
                    <thead className="sticky top-0 bg-[#0e1014] text-[#6d7280]">
                      <tr>
                        <th className="px-3 py-2 font-normal">显示名</th>
                        <th className="px-3 py-2 font-normal">标识</th>
                        <th className="px-3 py-2 font-normal">类型</th>
                        <th className="px-3 py-2 font-normal">选项（逗号分隔）</th>
                        <th className="px-3 py-2 font-normal" />
                      </tr>
                    </thead>
                    <tbody>
                      {asFields(selected.fields).map((f, i) => (
                        <tr key={`${f.key}-${i}`} className="border-t border-[#1b1e27]">
                          <td className="px-3 py-1.5">
                            <input
                              value={f.name}
                              onChange={(e) => patchField(i, { name: e.target.value })}
                              className="w-full bg-transparent outline-none"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              value={f.key}
                              onChange={(e) => patchField(i, { key: e.target.value })}
                              className="w-full bg-transparent font-mono outline-none"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <select
                              value={f.type}
                              onChange={(e) => patchField(i, { type: e.target.value })}
                              className="bg-transparent"
                            >
                              {FIELD_TYPES.map(([v, label]) => (
                                <option key={v} value={v}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              value={(f.options ?? []).join("，")}
                              onChange={(e) =>
                                patchField(i, {
                                  options: e.target.value
                                    .split(/[,，]/)
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                })
                              }
                              className="w-full bg-transparent outline-none"
                              placeholder={f.type === "select" ? "如：缺陷，需求，任务" : ""}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <button onClick={() => removeField(i)} className="text-[#6d7280]">
                              删除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button onClick={addField} className="px-3 py-2 text-[12px] text-[#ffb088]">
                    + 添加字段
                  </button>
                </>
              )}
            </div>
          )}
          {tab === "layout" && (
            <div className="h-full">
              {!selected ? (
                <div className="px-4 py-8 text-center text-[12px] text-[#6d7280]">请先在图上点选一个类型节点</div>
              ) : (
                <DetailLayoutEditor
                  typeKey={selected.key}
                  stored={selected.detail_layout}
                  fields={typeFields(selected.fields)}
                  onChange={(detail_layout) => patchType(selected.key, { detail_layout })}
                />
              )}
            </div>
          )}
          {tab === "links" && (
            <>
            <table className="w-full text-left text-[12px]">
              <thead className="sticky top-0 bg-[#0e1014] text-[#6d7280]">
                <tr>
                  <th className="px-3 py-2 font-normal">从</th>
                  <th className="px-3 py-2 font-normal">关系</th>
                  <th className="px-3 py-2 font-normal">到</th>
                  <th className="px-3 py-2 font-normal">显示名</th>
                  <th className="px-3 py-2 font-normal" />
                </tr>
              </thead>
              <tbody>
                {edges.map((e, i) => (
                  <tr key={`${e.source_key}-${e.target_key}-${i}`} className="border-t border-[#1b1e27]">
                    <td className="px-3 py-1.5">
                      <select
                        value={e.source_key}
                        onChange={(ev) => {
                          const next = edges.map((row, idx) =>
                            idx === i ? { ...row, source_key: ev.target.value } : row,
                          );
                          setDraftEdges(next);
                        }}
                        className="bg-transparent"
                      >
                        <option value={PROJECT_NODE_KEY}>项目</option>
                        {types.map((t) => (
                          <option key={t.key} value={t.key}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        value={e.relation}
                        onChange={(ev) => {
                          const next = edges.map((row, idx) =>
                            idx === i ? { ...row, relation: ev.target.value } : row,
                          );
                          setDraftEdges(next);
                        }}
                        className="bg-transparent"
                      >
                        {REL_OPTIONS.map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        value={e.target_key}
                        onChange={(ev) => {
                          const next = edges.map((row, idx) =>
                            idx === i ? { ...row, target_key: ev.target.value } : row,
                          );
                          setDraftEdges(next);
                        }}
                        className="bg-transparent"
                      >
                        {types.map((t) => (
                          <option key={t.key} value={t.key}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        value={e.label ?? ""}
                        onChange={(ev) => {
                          const next = edges.map((row, idx) =>
                            idx === i ? { ...row, label: ev.target.value } : row,
                          );
                          setDraftEdges(next);
                        }}
                        className="w-full bg-transparent outline-none"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <button
                        onClick={() => setDraftEdges(edges.filter((_, idx) => idx !== i))}
                        className="text-[#6d7280]"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
                {edges.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-[#6d7280]">
                      在图上从一个节点拖到另一个节点添加前向关系；一对节点只保留一条箭头。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="flex flex-wrap items-center gap-2 border-t border-[#1b1e27] px-3 py-2">
              <select
                value={newLink.source}
                onChange={(e) => setNewLink((s) => ({ ...s, source: e.target.value }))}
                className="rounded border border-[#2a2e3a] bg-[#0b0c0e] px-2 py-1 text-[12px]"
              >
                <option value="">从…</option>
                <option value={PROJECT_NODE_KEY}>项目</option>
                {types.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select
                value={newLink.relation}
                onChange={(e) => setNewLink((s) => ({ ...s, relation: e.target.value }))}
                className="rounded border border-[#2a2e3a] bg-[#0b0c0e] px-2 py-1 text-[12px]"
              >
                {REL_OPTIONS.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={newLink.target}
                onChange={(e) => setNewLink((s) => ({ ...s, target: e.target.value }))}
                className="rounded border border-[#2a2e3a] bg-[#0b0c0e] px-2 py-1 text-[12px]"
              >
                <option value="">到…</option>
                {types.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name}
                  </option>
                ))}
              </select>
              <input
                value={newLink.label}
                onChange={(e) => setNewLink((s) => ({ ...s, label: e.target.value }))}
                placeholder="显示名（可选）"
                className="w-28 bg-transparent text-[12px] outline-none"
              />
              <button
                onClick={() => {
                  if (!newLink.source || !newLink.target || newLink.source === newLink.target) return;
                  setDraftEdges(
                    uniqueForwardTypeEdges([
                      ...edges,
                      {
                        source_key: newLink.source,
                        target_key: newLink.target,
                        relation: newLink.relation,
                        label: newLink.label || null,
                      },
                    ]),
                  );
                  setNewLink({ source: "", relation: "relates_to", target: "", label: "" });
                }}
                className="text-[12px] text-[#ffb088]"
              >
                + 添加连接
              </button>
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
