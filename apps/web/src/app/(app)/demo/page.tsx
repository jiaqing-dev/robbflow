"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";

import { CreateIssueDialog } from "@/components/create-issue-dialog";
import { WorkItemPicker } from "@/components/work-item-picker";
import { dataApi, type WorkItem } from "@/lib/api";
import { PRIORITY_LABEL, RELATION_LABEL, STATUS_LABEL, TYPE_LABEL } from "@/lib/labels";

const REL_TYPES = Object.keys(RELATION_LABEL);

export default function DemoPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [relType, setRelType] = useState("relates_to");
  const [relTarget, setRelTarget] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [message, setMessage] = useState("");

  const projects = useQuery({ queryKey: ["projects"], queryFn: dataApi.projects });
  const items = useQuery({
    queryKey: ["demo-items"],
    queryFn: () => dataApi.workItems({ limit: "50" }),
  });
  const members = useQuery({ queryKey: ["members"], queryFn: dataApi.members });
  const types = useQuery({ queryKey: ["work-item-types"], queryFn: dataApi.workItemTypes });
  const workflows = useQuery({ queryKey: ["workflows"], queryFn: dataApi.workflows });

  const key = selectedKey || items.data?.[0]?.key || "";
  const item = useQuery({
    queryKey: ["issue", key],
    queryFn: () => dataApi.workItem(key),
    enabled: !!key,
  });
  const relations = useQuery({
    queryKey: ["relations", key],
    queryFn: () => dataApi.relations(key),
    enabled: !!key,
  });
  const comments = useQuery({
    queryKey: ["comments", key],
    queryFn: () => dataApi.comments(key),
    enabled: !!key,
  });

  const issue = item.data;
  const typeRow = types.data?.find((t) => t.key === issue?.type);
  const wf = useMemo(() => {
    if (!workflows.data) return undefined;
    return (
      workflows.data.find((w) => w.id === typeRow?.workflow_id) ??
      workflows.data.find((w) => w.is_default) ??
      workflows.data[0]
    );
  }, [workflows.data, typeRow]);
  const allowed = useMemo(() => {
    if (!issue || !wf) return [issue?.status].filter(Boolean) as string[];
    const next = wf.transitions.filter((t) => t.from_state === issue.status).map((t) => t.to_state);
    return [issue.status, ...next];
  }, [issue, wf]);

  const patch = useMutation({
    mutationFn: (payload: Record<string, unknown>) => dataApi.updateWorkItem(key, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["issue", key] });
      qc.invalidateQueries({ queryKey: ["demo-items"] });
      qc.invalidateQueries({ queryKey: ["inbox"] });
      qc.invalidateQueries({ queryKey: ["my-work"] });
      setMessage("已保存");
    },
    onError: (err: Error) => setMessage(err.message),
  });
  const addRel = useMutation({
    mutationFn: () => dataApi.addRelation(key, relTarget, relType),
    onSuccess: () => {
      setRelTarget("");
      qc.invalidateQueries({ queryKey: ["relations", key] });
      qc.invalidateQueries({ queryKey: ["graph", key] });
      setMessage("关联已添加");
    },
    onError: (err: Error) => setMessage(err.message),
  });
  const comment = useMutation({
    mutationFn: () => dataApi.addComment(key, commentBody),
    onSuccess: () => {
      setCommentBody("");
      qc.invalidateQueries({ queryKey: ["comments", key] });
      setMessage("评论已发送");
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const project = projects.data?.[0];

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <header className="mb-6">
        <h1 className="text-[18px] font-semibold tracking-tight">操作演示</h1>
        <p className="mt-1 max-w-2xl text-[12px] leading-5 text-[#8b90a0]">
          在本页直接做一遍日常操作：新建、改状态、指派负责人、搜索关联、评论。演示账号{" "}
          <span className="font-mono text-[#c4c8d4]">demo@robbflow.dev / robbflow</span>
          ，第二成员「林间」可用于指派。
        </p>
      </header>

      {message && (
        <div className="mb-4 rounded-md border border-[#2a2e3a] bg-[#12141a] px-3 py-2 text-[12px] text-[#ffb088]">
          {message}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Step n={1} title="新建工作项">
            <p className="mb-2 text-[12px] text-[#8b90a0]">
              也可随时按 ⌘N。创建后会出现在收件箱、项目看板和下面的列表里。
            </p>
            <button
              onClick={() => setCreateOpen(true)}
              className="rounded-md bg-[#ff6a2b] px-3 py-1.5 text-[12px] font-medium text-black"
            >
              打开新建对话框
            </button>
          </Step>

          <Step n={2} title="选一张单据做后续操作">
            <select
              value={key}
              onChange={(e) => {
                setSelectedKey(e.target.value);
                setMessage("");
              }}
              className="w-full rounded-md border border-[#232633] bg-[#0e1014] px-2 py-1.5 text-[12px]"
            >
              {(items.data ?? []).map((i) => (
                <option key={i.id} value={i.key}>
                  {i.key} · {TYPE_LABEL[i.type] ?? i.type} · {i.title}
                </option>
              ))}
            </select>
            {issue && (
              <p className="mt-2 text-[12px] text-[#8b90a0]">
                当前：
                <Link href={`/issues/${issue.key}`} className="ml-1 text-[#ffb088]">
                  {issue.key} {issue.title}
                </Link>
                {issue.project_name ? ` · ${issue.project_name}` : ""}
              </p>
            )}
          </Step>

          <Step n={3} title="流转状态">
            <p className="mb-2 text-[12px] text-[#8b90a0]">
              只能前进一格、回退一格或取消，不能从「待处理」直接跳到「已完成」。
            </p>
            <select
              disabled={!issue}
              value={issue?.status ?? ""}
              onChange={(e) => patch.mutate({ status: e.target.value })}
              className="w-full rounded-md border border-[#232633] bg-[#0e1014] px-2 py-1.5 text-[12px]"
            >
              {allowed.map((s) => {
                const named = wf?.states.find((st) => st.key === s);
                return (
                  <option key={s} value={s}>
                    {named?.name ?? STATUS_LABEL[s] ?? s}
                  </option>
                );
              })}
            </select>
          </Step>

          <Step n={4} title="指派负责人">
            <p className="mb-2 text-[12px] text-[#8b90a0]">成员来自当前工作区，可选「萝卜」或「林间」。</p>
            <select
              disabled={!issue}
              value={issue?.assignee_id ?? ""}
              onChange={(e) => patch.mutate({ assignee_id: e.target.value || null })}
              className="w-full rounded-md border border-[#232633] bg-[#0e1014] px-2 py-1.5 text-[12px]"
            >
              <option value="">未指派</option>
              {(members.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.email}
                </option>
              ))}
            </select>
          </Step>

          <Step n={5} title="搜索并添加关联">
            <p className="mb-2 text-[12px] text-[#8b90a0]">
              输入编号或标题关键词即可查出工作项。推荐类型会标 ★，仍可关联其它类型。
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={relType}
                onChange={(e) => setRelType(e.target.value)}
                className="rounded-md border border-[#232633] bg-[#0e1014] px-2 py-1.5 text-[12px]"
              >
                {REL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {RELATION_LABEL[t]}
                  </option>
                ))}
              </select>
              <WorkItemPicker
                excludeId={issue?.id}
                value={relTarget}
                onChange={setRelTarget}
                preferredTypes={new Set((typeRow?.outputs ?? []).map((p) => p.type_key))}
              />
              <button
                disabled={!issue || !relTarget || addRel.isPending}
                onClick={() => addRel.mutate()}
                className="rounded-md bg-[#ff6a2b] px-3 py-1.5 text-[12px] text-black disabled:opacity-40"
              >
                添加关联
              </button>
            </div>
            <div className="mt-3 space-y-1">
              {(relations.data ?? []).map((r) => (
                <div key={r.id} className="text-[12px] text-[#b4b8c5]">
                  <span className="text-[#ffb088]">{RELATION_LABEL[r.relation_type] ?? r.relation_type}</span>{" "}
                  {r.source_key} → {r.target_key} {r.target_title}
                </div>
              ))}
              {(relations.data ?? []).length === 0 && (
                <div className="text-[12px] text-[#6d7280]">这张单据还没有关联</div>
              )}
            </div>
          </Step>

          <Step n={6} title="写一条评论">
            <textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="例如：这条需求本迭代做完"
              className="h-20 w-full rounded-md border border-[#232633] bg-[#0e1014] p-2 text-[12px] outline-none focus:border-[#ff6a2b]"
            />
            <button
              disabled={!issue || !commentBody.trim() || comment.isPending}
              onClick={() => comment.mutate()}
              className="mt-2 rounded-md bg-[#ff6a2b] px-3 py-1.5 text-[12px] font-medium text-black disabled:opacity-40"
            >
              发送评论
            </button>
            <div className="mt-3 space-y-2">
              {(comments.data ?? []).slice(0, 3).map((c) => (
                <div key={c.id} className="text-[12px] text-[#b4b8c5]">
                  <span className="text-[#8b90a0]">{c.author.name}：</span>
                  {c.body}
                </div>
              ))}
            </div>
          </Step>
        </div>

        <aside className="space-y-3">
          <div className="rounded-xl border border-[#232633] bg-[#12141a] p-4">
            <div className="mb-2 text-[13px] font-medium">当前单据</div>
            {issue ? <IssueSummary issue={issue} /> : <p className="text-[12px] text-[#6d7280]">加载中…</p>}
          </div>
          <div className="rounded-xl border border-[#232633] bg-[#12141a] p-4">
            <div className="mb-2 text-[13px] font-medium">接着去这些页面看效果</div>
            <ul className="space-y-2 text-[12px]">
              {project && (
                <li>
                  <Link href={`/projects/${project.slug}`} className="text-[#ffb088]">
                    项目看板 · 拖拽改状态
                  </Link>
                </li>
              )}
              <li>
                <Link href="/cycles" className="text-[#ffb088]">
                  迭代 · 把工作项挂到 Sprint
                </Link>
              </li>
              <li>
                <Link href="/workflows" className="text-[#ffb088]">
                  流程设计 · 看类型关系和状态流
                </Link>
              </li>
              <li>
                <Link href="/inbox" className="text-[#ffb088]">
                  收件箱 · 未完成或未指派
                </Link>
              </li>
              <li className="text-[#8b90a0]">⌘K 搜索工作项并跳转详情</li>
            </ul>
          </div>
        </aside>
      </div>

      <CreateIssueDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#232633] bg-[#12141a] p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ff6a2b] text-[11px] font-semibold text-black">
          {n}
        </span>
        <h2 className="text-[14px] font-medium">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function IssueSummary({ issue }: { issue: WorkItem }) {
  return (
    <dl className="space-y-1.5 text-[12px] text-[#b4b8c5]">
      <div>
        类型 {TYPE_LABEL[issue.type] ?? issue.type}
      </div>
      <div>状态 {STATUS_LABEL[issue.status] ?? issue.status}</div>
      <div>优先级 {PRIORITY_LABEL[issue.priority] ?? issue.priority}</div>
      <div>负责人 {issue.assignee?.name ?? "未指派"}</div>
    </dl>
  );
}
