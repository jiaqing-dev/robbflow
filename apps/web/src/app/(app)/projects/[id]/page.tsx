"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { CreateIssueDialog } from "@/components/create-issue-dialog";
import { IssuePeek } from "@/components/issue-peek";
import { Kanban } from "@/components/kanban";
import { ProjectCycles } from "@/components/project-cycles";
import { ProjectDocs } from "@/components/project-docs";
import { ProjectForm } from "@/components/project-form";
import { SwimlaneBoard } from "@/components/swimlane";
import { WorkflowCanvas } from "@/components/workflow-canvas";
import { WorkItemList } from "@/components/work-item-list";
import { authApi, dataApi, type WorkItem, type Workflow } from "@/lib/api";
import { isOverdue } from "@/lib/labels";
import { projectTemplates } from "@/lib/work-templates";

type MainView = "board" | "swimlane" | "list" | "cycles" | "docs" | "flow" | "settings";

const TABS: Array<[MainView, string]> = [
  ["board", "看板"],
  ["swimlane", "泳道"],
  ["list", "列表"],
  ["cycles", "迭代"],
  ["docs", "文档"],
  ["flow", "流程图"],
  ["settings", "设置"],
];

export default function ProjectDetailPage() {
  return (
    <Suspense fallback={<div className="px-6 py-16 text-[13px] text-[#6d7280]">加载项目…</div>}>
      <ProjectDetailInner />
    </Suspense>
  );
}

function ProjectDetailInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const tabParam = searchParams.get("tab") as MainView | null;
  const [view, setView] = useState<MainView>(
    TABS.some(([key]) => key === tabParam) ? (tabParam as MainView) : "board",
  );
  const [lane, setLane] = useState("assignee");
  const [table, setTable] = useState<{ template: string; type: string; name: string } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [peek, setPeek] = useState<WorkItem | null>(null);
  const [viewFilter, setViewFilter] = useState<Record<string, unknown>>({});
  const [viewName, setViewName] = useState("");

  const projectQ = useQuery({ queryKey: ["project", id], queryFn: () => dataApi.project(id) });
  const templates = useQuery({ queryKey: ["work-templates"], queryFn: dataApi.workTemplates });
  const workflows = useQuery({ queryKey: ["workflows"], queryFn: dataApi.workflows });
  const me = useQuery({ queryKey: ["me"], queryFn: authApi.me });
  const sprints = useQuery({ queryKey: ["sprints", id], queryFn: () => dataApi.sprints(id) });
  const savedViews = useQuery({ queryKey: ["views", id], queryFn: () => dataApi.views(id) });

  const grouped = useMemo(
    () => projectTemplates(projectQ.data, templates.data ?? []),
    [projectQ.data, templates.data],
  );

  useEffect(() => {
    if (table) return;
    const first = grouped[0]?.tables[0];
    if (first && grouped[0]) {
      setTable({ template: grouped[0].key, type: first.type_key, name: first.name });
    }
  }, [grouped, table]);

  useEffect(() => {
    if (!table || grouped.length === 0) return;
    const stillThere = grouped.some(
      (tpl) => tpl.key === table.template && tpl.tables.some((row) => row.type_key === table.type),
    );
    if (!stillThere) setTable(null);
  }, [grouped, table]);

  useEffect(() => {
    if (tabParam && TABS.some(([key]) => key === tabParam) && tabParam !== view) {
      setView(tabParam);
    }
  }, [tabParam, view]);

  const board = useQuery({
    queryKey: ["board", id, table?.type ?? "none", view === "swimlane" ? lane : "none"],
    queryFn: () =>
      dataApi.board(id, {
        type: table?.type,
        lane: view === "swimlane" ? lane : undefined,
      }),
    enabled: view !== "settings" && view !== "cycles" && view !== "docs" && !!table,
  });

  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => dataApi.updateProject(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board"] });
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
  const pinView = useMutation({
    mutationFn: () =>
      dataApi.createView({
        name: viewName.trim() || "未命名视图",
        project_id: id,
        filters: viewFilter,
      }),
    onSuccess: () => {
      setViewName("");
      qc.invalidateQueries({ queryKey: ["views", id] });
    },
  });
  const dropView = useMutation({
    mutationFn: (viewId: string) => dataApi.deleteView(viewId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["views", id] }),
  });

  const project = projectQ.data ?? board.data?.project;
  if (projectQ.isLoading && !project) {
    return <div className="px-6 py-16 text-[13px] text-[#6d7280]">加载项目…</div>;
  }
  if (!project) {
    return <div className="px-6 py-16 text-[13px] text-rose-400">项目不存在或无法加载</div>;
  }

  const columns = board.data?.columns ?? [];
  const counts = board.data?.counts ?? { open: 0, total: 0 };
  const workflow = board.data?.workflow;
  const lanes = board.data?.lanes ?? [];
  const listItems = columns.flatMap((c) => c.items);
  const wfFull: Workflow | undefined = workflow
    ? (workflows.data?.find((w) => w.key === workflow.key) ?? workflows.data?.find((w) => w.is_default))
    : undefined;

  function changeView(next: MainView) {
    setView(next);
    router.replace(`/projects/${id}?tab=${next}`, { scroll: false });
  }

  const showTypeBar = view !== "settings" && view !== "cycles" && view !== "docs";
  const activeSprint = (sprints.data ?? []).find((s) => s.status === "active");

  function applyFilter(items: WorkItem[]) {
    const open = Boolean(viewFilter.open);
    const overdue = Boolean(viewFilter.overdue);
    const mine = viewFilter.assignee === "me";
    const sprint = viewFilter.sprint === "active" ? activeSprint?.id : (viewFilter.sprint_id as string | undefined);
    return items.filter((item) => {
      if (open && ["done", "cancelled", "launch", "wontfix"].includes(item.status)) return false;
      if (overdue && !isOverdue(item)) return false;
      if (mine && item.assignee_id !== me.data?.user.id) return false;
      if (sprint && item.sprint_id !== sprint) return false;
      return true;
    });
  }

  const filteredColumns = columns.map((col) => ({ ...col, items: applyFilter(col.items) }));
  const filteredList = applyFilter(listItems);
  const filteredLanes = lanes.map((laneRow) => ({
    ...laneRow,
    items_by_status: Object.fromEntries(
      Object.entries(laneRow.items_by_status).map(([k, items]) => [k, applyFilter(items)]),
    ),
  }));

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[#232633] px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: project.color }} />
              <h1 className="text-[16px] font-semibold">{project.name}</h1>
              {showTypeBar && (
                <span className="text-[12px] text-[#6d7280]">
                  {counts.open} 未完成 · {counts.total} 全部
                  {workflow ? ` · ${workflow.name}` : ""}
                </span>
              )}
            </div>
            {project.description && <p className="mt-1 text-[12px] text-[#8b90a0]">{project.description}</p>}
            {showTypeBar && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {(
                  [
                    ["全部", {}],
                    ["我的未完成", { assignee: "me", open: true }],
                    ["本迭代", { sprint: "active", open: true }],
                    ["逾期", { overdue: true, open: true }],
                  ] as Array<[string, Record<string, unknown>]>
                ).map(([label, filters]) => {
                  const active = JSON.stringify(viewFilter) === JSON.stringify(filters);
                  return (
                    <button
                      key={label}
                      onClick={() => setViewFilter(filters)}
                      className={`rounded-md px-2 py-0.5 text-[11px] ${active ? "bg-[#1a1d26] text-white" : "text-[#8b90a0] hover:text-white"}`}
                    >
                      {label}
                    </button>
                  );
                })}
                {(savedViews.data ?? []).map((sv) => {
                  const active = JSON.stringify(viewFilter) === JSON.stringify(sv.filters);
                  return (
                    <button
                      key={sv.id}
                      onClick={() => setViewFilter(sv.filters)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        dropView.mutate(sv.id);
                      }}
                      className={`rounded-md px-2 py-0.5 text-[11px] ${active ? "bg-[#1a1d26] text-white" : "text-[#8b90a0]"}`}
                      title="右键删除"
                    >
                      {sv.name}
                    </button>
                  );
                })}
                <input
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  placeholder="视图名"
                  className="h-6 w-20 rounded border border-[#232633] bg-[#0e1014] px-1.5 text-[11px]"
                />
                <button onClick={() => pinView.mutate()} className="text-[11px] text-[#ffb088]">
                  钉住
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {view === "swimlane" && (
              <select
                value={lane}
                onChange={(e) => setLane(e.target.value)}
                className="rounded-md border border-[#232633] bg-[#0e1014] px-2 py-1 text-[12px]"
              >
                <option value="assignee">按负责人</option>
                <option value="priority">按优先级</option>
              </select>
            )}
            {table && showTypeBar && (
              <button
                onClick={() => setCreateOpen(true)}
                className="rounded-md bg-[#ff6a2b] px-3 py-1.5 text-[12px] font-medium text-black"
              >
                新建{table.name.replace(/表$/, "")}
              </button>
            )}
            <div className="flex rounded-md border border-[#232633] text-[12px]">
              {TABS.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => changeView(key)}
                  className={`px-3 py-1.5 ${view === key ? "bg-[#1a1d26] text-white" : "text-[#8b90a0]"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {showTypeBar && grouped.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            {grouped.map((tpl) => (
              <div key={tpl.key} className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-[#6d7280]">{tpl.name}</span>
                {tpl.tables.map((row) => {
                  const active = table?.template === tpl.key && table.type === row.type_key;
                  return (
                    <button
                      key={`${tpl.key}:${row.type_key}`}
                      onClick={() => setTable({ template: tpl.key, type: row.type_key, name: row.name })}
                      className={`rounded-md px-2 py-1 text-[12px] ${
                        active ? "bg-[#1a1d26] text-white" : "text-[#8b90a0] hover:text-white"
                      }`}
                    >
                      {row.name}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-hidden pt-3">
        {view === "settings" && (
          <div className="h-full overflow-y-auto px-6 pb-10">
            <div className="max-w-lg">
              <h2 className="mb-1 text-[14px] font-medium">项目设置</h2>
              <p className="mb-5 text-[12px] text-[#8b90a0]">修改名称、颜色，并配置工作模板。</p>
              <ProjectForm
                key={`${project.id}-${(project.templates ?? []).join(",")}`}
                initial={project}
                catalog={templates.data ?? []}
                submitting={update.isPending}
                submitLabel={update.isPending ? "保存中…" : "保存"}
                onSubmit={(value) => update.mutate(value)}
              />
              {update.isSuccess && <p className="mt-3 text-[12px] text-emerald-400">已保存</p>}
              {update.isError && <p className="mt-3 text-[12px] text-rose-400">保存失败，请重试</p>}
              <p className="mt-8 text-[12px] text-[#8b90a0]">
                要改状态机，请到{" "}
                <a className="text-[#ffb088]" href="/settings">
                  设置 · 流程设计
                </a>
                。
              </p>
            </div>
          </div>
        )}
        {view === "cycles" && <ProjectCycles projectId={project.id} onOpen={setPeek} />}
        {view === "docs" && <ProjectDocs projectId={project.id} />}
        {showTypeBar && board.isLoading && (
          <div className="px-6 py-16 text-[13px] text-[#6d7280]">加载{table?.name ?? "看板"}…</div>
        )}
        {view === "board" && board.data && (
          <Kanban
            projectId={id}
            columns={filteredColumns}
            transitions={workflow?.transitions ?? []}
            onOpen={setPeek}
          />
        )}
        {view === "swimlane" && board.data && (
          <SwimlaneBoard
            projectId={id}
            columns={filteredColumns}
            lanes={filteredLanes}
            transitions={workflow?.transitions ?? []}
            onOpen={setPeek}
          />
        )}
        {view === "flow" && wfFull && (
          <div className="flex h-full flex-col">
            <p className="px-6 pb-2 text-[12px] text-[#8b90a0]">
              当前是「{table?.name ?? "工作项"}」的状态机（{wfFull.name}）。要改流转请打开{" "}
              <a className="text-[#ffb088]" href={`/workflows/${wfFull.id}`}>
                流程设计器
              </a>
              。不同类型不要共用一张看板。
            </p>
            <div className="min-h-0 flex-1">
              <WorkflowCanvas workflow={wfFull} readOnly />
            </div>
          </div>
        )}
        {view === "list" && board.data && (
          <div className="h-full overflow-y-auto">
            <WorkItemList
              items={filteredList}
              empty={`${table?.name ?? "工作表"}还是空的，可以新建一条`}
              onOpen={setPeek}
            />
          </div>
        )}
      </div>
      <CreateIssueDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultProjectId={project.id}
        defaultType={table?.type}
      />
      {peek && <IssuePeek issueKey={peek.key} onClose={() => setPeek(null)} />}
    </div>
  );
}
