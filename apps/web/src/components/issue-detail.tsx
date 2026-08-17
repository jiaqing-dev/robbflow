"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";

import { FeishuDocs } from "@/components/feishu-docs";
import { IssueFieldInput } from "@/components/issue-field-input";
import { RelationGraph } from "@/components/relation-graph";
import { WorkItemPicker } from "@/components/work-item-picker";
import { dataApi, type WorkItem, type WorkItemType, type Workflow } from "@/lib/api";
import {
  resolveLayout,
  typeFields,
  type LayoutBlock,
  type TypeField,
} from "@/lib/detail-layout";
import { renderCommentHtml } from "@/lib/comment-md";
import { parseGitUrl } from "@/lib/git-url";
import { isOverdue, PRIORITY_LABEL, RELATION_LABEL, STATUS_LABEL, TYPE_LABEL } from "@/lib/labels";

const REL_TYPES = Object.keys(RELATION_LABEL);
const selectClass =
  "w-full rounded-md border border-[#2a2e3a] bg-[#0b0c0e] px-2 py-1.5 text-[12px] outline-none focus:border-[#ff6a2b]";

export function IssueDetail({
  issueKey,
  variant = "page",
}: {
  issueKey: string;
  variant?: "page" | "peek";
}) {
  const qc = useQueryClient();
  const item = useQuery({ queryKey: ["issue", issueKey], queryFn: () => dataApi.workItem(issueKey) });
  const comments = useQuery({
    queryKey: ["comments", issueKey],
    queryFn: () => dataApi.comments(issueKey),
    enabled: !!item.data,
  });
  const activity = useQuery({
    queryKey: ["issue-activity", issueKey],
    queryFn: () => dataApi.itemActivity(issueKey),
    enabled: !!item.data,
  });
  const relations = useQuery({
    queryKey: ["relations", issueKey],
    queryFn: () => dataApi.relations(issueKey),
    enabled: !!item.data,
  });
  const graph = useQuery({
    queryKey: ["graph", issueKey],
    queryFn: () => dataApi.graph(issueKey),
    enabled: !!item.data,
  });
  const workflows = useQuery({ queryKey: ["workflows"], queryFn: dataApi.workflows });
  const types = useQuery({ queryKey: ["work-item-types"], queryFn: dataApi.workItemTypes });
  const sprints = useQuery({
    queryKey: ["sprints", item.data?.project_id],
    queryFn: () => dataApi.sprints(item.data?.project_id),
    enabled: !!item.data?.project_id,
  });
  const milestones = useQuery({
    queryKey: ["milestones", item.data?.project_id],
    queryFn: () => dataApi.milestones(item.data?.project_id),
    enabled: !!item.data?.project_id,
  });
  const members = useQuery({ queryKey: ["members"], queryFn: dataApi.members });
  const children = useQuery({
    queryKey: ["children", issueKey],
    queryFn: () => dataApi.children(issueKey),
    enabled: !!item.data,
  });
  const gitLinks = useQuery({
    queryKey: ["git-links", issueKey],
    queryFn: () => dataApi.gitLinks(issueKey),
    enabled: !!item.data,
  });
  const parent = useQuery({
    queryKey: ["issue-parent", item.data?.parent_id],
    queryFn: () => dataApi.workItem(item.data!.parent_id!),
    enabled: !!item.data?.parent_id,
  });
  const [title, setTitle] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [relType, setRelType] = useState("relates_to");
  const [relTarget, setRelTarget] = useState("");
  const [relError, setRelError] = useState("");
  const [activityTab, setActivityTab] = useState<"comments" | "history">("comments");
  const [childId, setChildId] = useState("");
  const [gitUrl, setGitUrl] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [patchError, setPatchError] = useState("");

  useEffect(() => {
    setTitle(null);
    setDescription(null);
    setBody("");
    setRelError("");
    setActivityTab("comments");
  }, [issueKey]);

  const patch = useMutation({
    mutationFn: (payload: Record<string, unknown>) => dataApi.updateWorkItem(issueKey, payload),
    onSuccess: (next) => {
      setPatchError("");
      qc.setQueryData(["issue", issueKey], next);
      qc.invalidateQueries({ queryKey: ["board"] });
      qc.invalidateQueries({ queryKey: ["inbox"] });
      qc.invalidateQueries({ queryKey: ["my-work"] });
      qc.invalidateQueries({ queryKey: ["issue-activity", issueKey] });
    },
    onError: (err: Error) => setPatchError(err.message),
  });
  const comment = useMutation({
    mutationFn: () => dataApi.addComment(issueKey, body),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["comments", issueKey] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
  const attachChild = useMutation({
    mutationFn: (id: string) => dataApi.updateWorkItem(id, { parent_id: item.data?.id }),
    onSuccess: () => {
      setChildId("");
      qc.invalidateQueries({ queryKey: ["children", issueKey] });
    },
  });
  const addGit = useMutation({
    mutationFn: () => {
      const parsed = parseGitUrl(gitUrl);
      if (!parsed) throw new Error("请粘贴 GitHub / GitLab 链接");
      return dataApi.addGitLink(issueKey, parsed);
    },
    onSuccess: () => {
      setGitUrl("");
      qc.invalidateQueries({ queryKey: ["git-links", issueKey] });
    },
  });
  const delGit = useMutation({
    mutationFn: (id: string) => dataApi.deleteGitLink(issueKey, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["git-links", issueKey] }),
  });
  const addRel = useMutation({
    mutationFn: () => dataApi.addRelation(issueKey, relTarget, relType),
    onSuccess: () => {
      setRelTarget("");
      setRelError("");
      qc.invalidateQueries({ queryKey: ["relations", issueKey] });
      qc.invalidateQueries({ queryKey: ["graph", issueKey] });
    },
    onError: (err: Error) => setRelError(err.message),
  });
  const delRel = useMutation({
    mutationFn: (id: string) => dataApi.deleteRelation(issueKey, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["relations", issueKey] });
      qc.invalidateQueries({ queryKey: ["graph", issueKey] });
    },
  });

  const issue = item.data;
  const typeRow = types.data?.find((t) => t.key === issue?.type);
  const fields = useMemo(() => typeFields(typeRow?.fields), [typeRow?.fields]);
  const layout = useMemo(
    () => resolveLayout(issue?.type ?? "task", typeRow?.detail_layout, fields),
    [issue?.type, typeRow?.detail_layout, fields],
  );
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
  const allowedTargets = useMemo(() => {
    const keys = new Set((typeRow?.outputs ?? []).map((p) => p.type_key).filter((k) => k && k !== "__project__"));
    return keys;
  }, [typeRow]);
  const relChoices = useMemo(() => {
    const outs = typeRow?.outputs ?? [];
    if (!outs.length) return REL_TYPES;
    const set = new Set(outs.map((p) => p.relation));
    return REL_TYPES.filter((t) => set.has(t)).concat(REL_TYPES.filter((t) => !set.has(t)));
  }, [typeRow]);

  if (item.isLoading) return <div className="px-6 py-16 text-[13px] text-[#6d7280]">加载中…</div>;
  if (!issue) return <div className="px-6 py-16 text-[13px] text-rose-400">未找到 {issueKey}</div>;

  const titleValue = title ?? issue.title;
  const descValue = description ?? issue.description ?? "";
  const statusMeta = wf?.states.find((s) => s.key === issue.status);

  function saveProperty(key: string, value: string | number | null) {
    const prev = issue!.properties?.[key];
    const next = value == null || value === "" ? null : value;
    if (String(prev ?? "") === String(next ?? "")) return;
    patch.mutate({ properties: { [key]: next } });
  }

  const ctx: BlockCtx = {
    issue,
    typeRow,
    fields,
    wf,
    allowed,
    members: members.data ?? [],
    sprints: sprints.data ?? [],
    milestones: milestones.data ?? [],
    patch: (payload) => patch.mutate(payload),
    saveProperty,
  };

  return (
    <div className="flex h-full">
      <section className={`min-w-0 flex-1 overflow-y-auto py-5 ${variant === "peek" ? "px-5" : "px-8"}`}>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-[#8b90a0]">
          <Link href={`/projects/${issue.project_id}`} className="hover:text-white">
            {issue.project_name}
          </Link>
          <span>/</span>
          <span
            className="rounded-sm px-1.5 py-0.5 text-[11px] font-medium"
            style={{ background: `${typeRow?.color ?? "#94a3b8"}22`, color: typeRow?.color ?? "#94a3b8" }}
          >
            {typeRow?.name ?? TYPE_LABEL[issue.type] ?? issue.type}
          </span>
          <span className="font-mono">{issue.key}</span>
          {parent.data && (
            <>
              <span>/</span>
              <Link href={`/issues/${parent.data.key}`} className="hover:text-white">
                父项 {parent.data.key}
              </Link>
            </>
          )}
          {isOverdue(issue) && <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[11px] text-rose-300">逾期</span>}
          {variant === "page" && (
            <Link href="/workflows/types" className="ml-auto text-[11px] text-[#6d7280] hover:text-[#ffb088]">
              配置此类型详情页
            </Link>
          )}
        </div>
        <input
          value={titleValue}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            const next = titleValue.trim();
            if (next && next !== issue.title) patch.mutate({ title: next });
          }}
          className="mb-4 w-full bg-transparent text-[22px] font-semibold tracking-tight outline-none"
        />
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <select
            value={issue.status}
            onChange={(e) => patch.mutate({ status: e.target.value })}
            className="rounded-md border px-2 py-1 text-[12px] font-medium"
            style={{
              borderColor: statusMeta?.color ?? "#2a2e3a",
              color: statusMeta?.color ?? "#eceef2",
              background: "#0b0c0e",
            }}
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
          <select
            value={issue.priority}
            onChange={(e) => patch.mutate({ priority: e.target.value })}
            className={selectClass + " w-auto"}
          >
            {Object.entries(PRIORITY_LABEL).map(([k, label]) => (
              <option key={k} value={k}>
                优先级 · {label}
              </option>
            ))}
          </select>
          <select
            value={issue.assignee_id ?? ""}
            onChange={(e) => patch.mutate({ assignee_id: e.target.value || null })}
            className={selectClass + " w-auto"}
          >
            <option value="">未指派</option>
            {(members.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        {patchError && <p className="mb-4 text-[12px] text-rose-400">{patchError}</p>}

        {layout.main.map((block) => (
          <div key={`${block.kind}:${block.key}`} className="mb-8">
            {block.kind === "system" && block.key === "description" && (
              <MainSection title="描述">
                <textarea
                  value={descValue}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => {
                    if (descValue !== (issue.description ?? "")) {
                      patch.mutate({ description: descValue || null });
                    }
                  }}
                  placeholder="点击添加描述…"
                  className="min-h-[120px] w-full resize-y rounded-md border border-transparent bg-transparent p-0 text-[14px] leading-7 text-[#c4c8d4] outline-none focus:border-[#2a2e3a] focus:bg-[#0b0c0e] focus:p-3"
                />
              </MainSection>
            )}
            {block.kind === "system" && block.key === "docs" && (
              <MainSection title="文档引用">
                <FeishuDocs itemId={issue.id} />
              </MainSection>
            )}
            {block.kind === "system" && block.key === "graph" && (
              <MainSection title="追溯图">
                <div className={`overflow-hidden rounded-xl border border-[#232633] ${variant === "peek" ? "h-[220px]" : "h-[320px]"}`}>
                  {graph.data ? (
                    <RelationGraph graph={graph.data} />
                  ) : (
                    <div className="px-4 py-10 text-center text-[12px] text-[#6d7280]">暂无关联</div>
                  )}
                </div>
              </MainSection>
            )}
            {block.kind === "system" && block.key === "relations" && (
              <MainSection title="关联">
                <div className="mb-3 space-y-2">
                  {(relations.data ?? []).map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-2 rounded-md border border-[#232633] px-3 py-2 text-[12px]"
                    >
                      <span className="text-[#ffb088]">{RELATION_LABEL[r.relation_type] ?? r.relation_type}</span>
                      <Link href={`/issues/${r.source_key}`} className="font-mono text-[#8b90a0]">
                        {r.source_key}
                      </Link>
                      <span>→</span>
                      <Link href={`/issues/${r.target_key}`} className="truncate">
                        {r.target_key} {r.target_title}
                      </Link>
                      <button onClick={() => delRel.mutate(r.id)} className="ml-auto text-[#6d7280]">
                        删除
                      </button>
                    </div>
                  ))}
                  {(relations.data ?? []).length === 0 && (
                    <p className="text-[12px] text-[#6d7280]">尚未关联其他工作项</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <select
                    value={relType}
                    onChange={(e) => setRelType(e.target.value)}
                    className="rounded-md border border-[#232633] bg-[#0e1014] px-2 py-1.5 text-[12px]"
                  >
                    {relChoices.map((t) => (
                      <option key={t} value={t}>
                        {RELATION_LABEL[t]}
                      </option>
                    ))}
                  </select>
                  <WorkItemPicker
                    excludeId={issue.id}
                    value={relTarget}
                    onChange={setRelTarget}
                    preferredTypes={allowedTargets}
                  />
                  <button
                    disabled={!relTarget || addRel.isPending}
                    onClick={() => addRel.mutate()}
                    className="h-[34px] shrink-0 rounded-md bg-[#ff6a2b] px-3 text-[12px] text-black disabled:opacity-40"
                  >
                    添加
                  </button>
                </div>
                {relError && <p className="mt-2 text-[12px] text-rose-400">{relError}</p>}
              </MainSection>
            )}
            {block.kind === "system" && block.key === "activity" && (
              <MainSection title="活动">
                <div className="mb-3 flex gap-1 border-b border-[#232633] text-[12px]">
                  {(
                    [
                      ["comments", "评论"],
                      ["history", "动态"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setActivityTab(key)}
                      className={`px-3 py-1.5 ${activityTab === key ? "border-b-2 border-[#ff6a2b] text-white" : "text-[#8b90a0]"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {activityTab === "comments" && (
                  <>
                    <div className="space-y-3">
                      {(comments.data ?? []).map((c) => (
                        <div key={c.id} className="rounded-lg border border-[#232633] bg-[#12141a] p-3">
                          <div className="mb-1 text-[11px] text-[#8b90a0]">
                            {c.author.name} · {new Date(c.created_at).toLocaleString()}
                          </div>
                          <div
                            className="text-[13px] leading-6"
                            dangerouslySetInnerHTML={{ __html: renderCommentHtml(c.body) }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-4">
                      <textarea
                        value={body}
                        onChange={(e) => {
                          const next = e.target.value;
                          setBody(next);
                          setMentionOpen(next.endsWith("@") || /@[\u4e00-\u9fa5A-Za-z0-9_.-]*$/.test(next));
                        }}
                        placeholder="写下评论… 支持 Markdown，用 @姓名 提醒成员"
                        className="h-24 w-full rounded-md border border-[#232633] bg-[#0e1014] p-3 text-[13px] outline-none focus:border-[#ff6a2b]"
                      />
                      {mentionOpen && (
                        <div className="mt-1 rounded-md border border-[#232633] bg-[#12141a] py-1">
                          {(members.data ?? []).map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              className="block w-full px-3 py-1 text-left text-[12px] hover:bg-[#1a1d26]"
                              onClick={() => {
                                setBody((prev) => prev.replace(/@[\u4e00-\u9fa5A-Za-z0-9_.-]*$/, `@${m.name} `));
                                setMentionOpen(false);
                              }}
                            >
                              @{m.name}
                            </button>
                          ))}
                        </div>
                      )}
                      <button
                        disabled={!body.trim() || comment.isPending}
                        onClick={() => comment.mutate()}
                        className="mt-2 rounded-md bg-[#ff6a2b] px-3 py-1.5 text-[12px] font-medium text-black disabled:opacity-40"
                      >
                        发送
                      </button>
                    </div>
                  </>
                )}
                {activityTab === "history" && (
                  <ul className="space-y-2">
                    {(activity.data ?? []).map((a) => (
                      <li key={a.id} className="text-[12px] text-[#8b90a0]">
                        {a.action} · {new Date(a.created_at).toLocaleString()}
                      </li>
                    ))}
                    {(activity.data ?? []).length === 0 && (
                      <li className="text-[12px] text-[#6d7280]">还没有动态</li>
                    )}
                  </ul>
                )}
              </MainSection>
            )}
            {block.kind === "field" && (
              <MainField block={block} fields={fields} issue={issue} saveProperty={saveProperty} members={members.data} />
            )}
          </div>
        ))}
        <div className="mb-8">
          <MainSection title="子工作项">
            <div className="mb-3 space-y-1">
              {(children.data ?? []).map((child) => (
                <Link
                  key={child.id}
                  href={`/issues/${child.key}`}
                  className="flex items-center gap-2 rounded-md border border-[#232633] px-3 py-1.5 text-[12px] hover:bg-[#12141a]"
                >
                  <span className="font-mono text-[#8b90a0]">{child.key}</span>
                  <span className="truncate">{child.title}</span>
                  <span className="ml-auto text-[#6d7280]">{STATUS_LABEL[child.status] ?? child.status}</span>
                </Link>
              ))}
              {(children.data ?? []).length === 0 && (
                <p className="text-[12px] text-[#6d7280]">还没有子项。把已有工作项挂到这里即可。</p>
              )}
            </div>
            <div className="flex gap-2">
              <WorkItemPicker excludeId={issue.id} value={childId} onChange={setChildId} />
              <button
                disabled={!childId || attachChild.isPending}
                onClick={() => attachChild.mutate(childId)}
                className="h-[34px] shrink-0 rounded-md bg-[#ff6a2b] px-3 text-[12px] text-black disabled:opacity-40"
              >
                挂为子项
              </button>
            </div>
          </MainSection>
        </div>
        <div className="mb-8">
          <MainSection title="Git 关联">
            <div className="mb-3 space-y-2">
              {(gitLinks.data ?? []).map((g) => (
                <div key={g.id} className="flex items-center gap-2 rounded-md border border-[#232633] px-3 py-2 text-[12px]">
                  <span className="rounded bg-[#1a1d26] px-1.5 py-0.5 text-[10px] text-[#ffb088]">{g.provider}</span>
                  <a href={g.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:text-white">
                    {g.repo}
                    {g.ref ? ` @ ${g.ref}` : ""}
                  </a>
                  <button onClick={() => delGit.mutate(g.id)} className="text-[#6d7280]">
                    移除
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={gitUrl}
                onChange={(e) => setGitUrl(e.target.value)}
                placeholder="https://github.com/org/repo/pull/12"
                className="h-[34px] min-w-0 flex-1 rounded-md border border-[#232633] bg-[#0e1014] px-3 text-[12px] outline-none focus:border-[#ff6a2b]"
              />
              <button
                disabled={!gitUrl.trim() || addGit.isPending}
                onClick={() => addGit.mutate()}
                className="h-[34px] shrink-0 rounded-md bg-[#ff6a2b] px-3 text-[12px] text-black disabled:opacity-40"
              >
                关联
              </button>
            </div>
            {addGit.isError && (
              <p className="mt-2 text-[12px] text-rose-400">
                {addGit.error instanceof Error ? addGit.error.message : "无法关联"}
              </p>
            )}
          </MainSection>
        </div>
      </section>
      <aside className={`shrink-0 overflow-y-auto border-l border-[#232633] p-4 ${variant === "peek" ? "w-[260px]" : "w-[320px]"}`}>
        <div className="mb-3 text-[11px] tracking-wide text-[#6d7280]">详细信息</div>
        {layout.sidebar.map((block) => (
          <SidebarBlock key={`${block.kind}:${block.key}`} block={block} ctx={ctx} />
        ))}
      </aside>
    </div>
  );
}

function MainSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-[13px] font-medium text-[#eceef2]">{title}</h2>
      {children}
    </div>
  );
}

function MainField({
  block,
  fields,
  issue,
  saveProperty,
  members,
}: {
  block: LayoutBlock;
  fields: TypeField[];
  issue: WorkItem;
  saveProperty: (key: string, value: string | number | null) => void;
  members?: Array<{ id: string; name: string }>;
}) {
  const field = fields.find((f) => f.key === block.key);
  if (!field) return null;
  return (
    <MainSection title={field.name}>
      <IssueFieldInput
        field={field}
        value={issue.properties?.[field.key]}
        onChange={(v) => saveProperty(field.key, v)}
        members={members}
        multiline
      />
    </MainSection>
  );
}

type BlockCtx = {
  issue: WorkItem;
  typeRow?: WorkItemType;
  fields: TypeField[];
  wf?: Workflow;
  allowed: string[];
  members: Array<{ id: string; name: string }>;
  sprints: Array<{ id: string; name: string }>;
  milestones: Array<{ id: string; name: string }>;
  patch: (payload: Record<string, unknown>) => void;
  saveProperty: (key: string, value: string | number | null) => void;
};

function SidebarBlock({ block, ctx }: { block: LayoutBlock; ctx: BlockCtx }) {
  const { issue, typeRow, fields, wf, allowed, members, sprints, milestones, patch, saveProperty } = ctx;
  if (block.kind === "field") {
    const field = fields.find((f) => f.key === block.key);
    if (!field) return null;
    return (
      <SideField label={field.name}>
        <IssueFieldInput
          field={field}
          value={issue.properties?.[field.key]}
          onChange={(v) => saveProperty(field.key, v)}
          members={members}
        />
      </SideField>
    );
  }
  switch (block.key) {
    case "type":
      return (
        <SideField label="类型">
          <span style={{ color: typeRow?.color }}>{typeRow?.name ?? TYPE_LABEL[issue.type] ?? issue.type}</span>
        </SideField>
      );
    case "status":
      return (
        <SideField label="状态">
          <select value={issue.status} onChange={(e) => patch({ status: e.target.value })} className={selectClass}>
            {allowed.map((s) => {
              const named = wf?.states.find((st) => st.key === s);
              return (
                <option key={s} value={s}>
                  {named?.name ?? STATUS_LABEL[s] ?? s}
                </option>
              );
            })}
          </select>
        </SideField>
      );
    case "assignee":
      return (
        <SideField label="负责人">
          <select
            value={issue.assignee_id ?? ""}
            onChange={(e) => patch({ assignee_id: e.target.value || null })}
            className={selectClass}
          >
            <option value="">未指派</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </SideField>
      );
    case "reporter":
      return <SideField label="报告人">{issue.creator?.name ?? "—"}</SideField>;
    case "priority":
      return (
        <SideField label="优先级">
          <select
            value={issue.priority}
            onChange={(e) => patch({ priority: e.target.value })}
            className={selectClass}
          >
            {Object.entries(PRIORITY_LABEL).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </SideField>
      );
    case "sprint":
      return (
        <SideField label="迭代">
          <select
            value={issue.sprint_id ?? ""}
            onChange={(e) => patch({ sprint_id: e.target.value || null })}
            className={selectClass}
          >
            <option value="">未规划</option>
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </SideField>
      );
    case "milestone":
      return (
        <SideField label="里程碑">
          <select
            value={issue.milestone_id ?? ""}
            onChange={(e) => patch({ milestone_id: e.target.value || null })}
            className={selectClass}
          >
            <option value="">未挂接</option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </SideField>
      );
    case "dates":
      return (
        <div className="mb-3 space-y-2">
          <SideField label="截止日期">
            <input
              type="datetime-local"
              value={toLocalInput(issue.due_at)}
              onChange={(e) => patch({ due_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
              className={selectClass}
            />
          </SideField>
          <SideField label="创建">{new Date(issue.created_at).toLocaleString()}</SideField>
          <SideField label="更新">{new Date(issue.updated_at).toLocaleString()}</SideField>
        </div>
      );
    default:
      return null;
  }
}

function SideField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-[11px] tracking-wide text-[#6d7280]">{label}</div>
      <div className="text-[13px]">{children}</div>
    </div>
  );
}

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
