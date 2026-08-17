"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { dataApi } from "@/lib/api";
import { PRIORITY_LABEL } from "@/lib/labels";
import { projectTypeKeys } from "@/lib/work-templates";

const PRIORITIES = ["urgent", "high", "medium", "low", "none"];

export function CreateIssueDialog({
  open,
  onClose,
  defaultProjectId,
  defaultType,
}: {
  open: boolean;
  onClose: () => void;
  defaultProjectId?: string;
  defaultType?: string;
}) {
  const qc = useQueryClient();
  const projects = useQuery({ queryKey: ["projects"], queryFn: dataApi.projects, enabled: open });
  const types = useQuery({ queryKey: ["work-item-types"], queryFn: dataApi.workItemTypes, enabled: open });
  const members = useQuery({ queryKey: ["members"], queryFn: dataApi.members, enabled: open });
  const templates = useQuery({ queryKey: ["work-templates"], queryFn: dataApi.workTemplates, enabled: open });
  const [title, setTitle] = useState("");
  const [type, setType] = useState(defaultType ?? "task");
  const [priority, setPriority] = useState("medium");
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [assigneeId, setAssigneeId] = useState("");

  useEffect(() => {
    if (!open) return;
    setProjectId(defaultProjectId ?? "");
    setType(defaultType ?? "task");
  }, [open, defaultProjectId, defaultType]);

  const selectedProject =
    (projects.data ?? []).find((p) => p.id === (projectId || defaultProjectId)) ?? projects.data?.[0];
  const allowedKeys = useMemo(
    () => projectTypeKeys(selectedProject, templates.data ?? []),
    [selectedProject, templates.data],
  );
  const visibleTypes = useMemo(() => {
    const all = types.data ?? [];
    if (!allowedKeys.length) return all;
    const filtered = all.filter((t) => allowedKeys.includes(t.key));
    if (defaultType && !filtered.some((t) => t.key === defaultType)) {
      const extra = all.find((t) => t.key === defaultType);
      return extra ? [...filtered, extra] : filtered;
    }
    return filtered;
  }, [types.data, allowedKeys, defaultType]);

  useEffect(() => {
    if (!open || !visibleTypes.length) return;
    if (!visibleTypes.some((t) => t.key === type)) {
      setType(defaultType && visibleTypes.some((t) => t.key === defaultType) ? defaultType : visibleTypes[0].key);
    }
  }, [open, visibleTypes, type, defaultType]);

  const create = useMutation({
    mutationFn: () =>
      dataApi.createWorkItem({
        project_id: projectId || selectedProject?.id,
        title,
        type,
        priority,
        assignee_id: assigneeId || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries();
      setTitle("");
      onClose();
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-[#2a2e3a] bg-[#12141a] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 text-[15px] font-medium">新建工作项</div>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="标题"
          className="mb-3 w-full rounded-md border border-[#2a2e3a] bg-[#0b0c0e] px-3 py-2 text-[13px] outline-none focus:border-[#ff6a2b]"
        />
        <div className="mb-4 grid grid-cols-2 gap-2">
          <select
            value={projectId || selectedProject?.id || ""}
            onChange={(e) => setProjectId(e.target.value)}
            className="rounded-md border border-[#2a2e3a] bg-[#0b0c0e] px-2 py-2 text-[12px]"
          >
            {(projects.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-md border border-[#2a2e3a] bg-[#0b0c0e] px-2 py-2 text-[12px]"
          >
            {visibleTypes.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="rounded-md border border-[#2a2e3a] bg-[#0b0c0e] px-2 py-2 text-[12px]"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p] ?? p}
              </option>
            ))}
          </select>
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="rounded-md border border-[#2a2e3a] bg-[#0b0c0e] px-2 py-2 text-[12px]"
          >
            <option value="">未指派</option>
            {(members.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-[12px] text-[#8b90a0]">
            取消
          </button>
          <button
            disabled={!title.trim() || create.isPending}
            onClick={() => create.mutate()}
            className="rounded-md bg-[#ff6a2b] px-3 py-1.5 text-[12px] font-medium text-black disabled:opacity-40"
          >
            创建
          </button>
        </div>
      </div>
    </div>
  );
}
