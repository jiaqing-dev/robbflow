"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ProjectForm } from "@/components/project-form";
import { dataApi } from "@/lib/api";

export default function ProjectsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const projects = useQuery({ queryKey: ["projects"], queryFn: dataApi.projects });
  const templates = useQuery({ queryKey: ["work-templates"], queryFn: dataApi.workTemplates });

  const create = useMutation({
    mutationFn: dataApi.createProject,
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setCreating(false);
      router.push(`/projects/${project.slug}`);
    },
  });

  return (
    <div className="h-full overflow-y-auto">
      <header className="flex items-center justify-between border-b border-[#232633] px-6 py-4">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">项目</h1>
          <p className="text-[12px] text-[#8b90a0]">可编辑，并按工作模板挂载不同工作表</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="rounded-md bg-[#ff6a2b] px-3 py-1.5 text-[12px] font-medium text-black"
        >
          新建项目
        </button>
      </header>
      <div className="grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {(projects.data ?? []).map((p) => (
          <Link
            key={p.id}
            href={`/projects/${p.slug}`}
            className="rounded-xl border border-[#232633] bg-[#12141a] p-4 hover:border-[#3a3f52]"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
              <span className="text-[14px] font-medium">{p.name}</span>
              <span className="ml-auto font-mono text-[11px] text-[#6d7280]">{p.key_prefix}</span>
            </div>
            <p className="line-clamp-2 text-[12px] text-[#8b90a0]">{p.description ?? "暂无描述"}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {(p.templates ?? []).map((key) => {
                const name = templates.data?.find((t) => t.key === key)?.name ?? key;
                return (
                  <span
                    key={key}
                    className="rounded-md border border-[#2a2e3a] px-1.5 py-0.5 text-[11px] text-[#8b90a0]"
                  >
                    {name}
                  </span>
                );
              })}
            </div>
          </Link>
        ))}
      </div>
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setCreating(false)}>
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#2a2e3a] bg-[#12141a] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 text-[15px] font-medium">新建项目</div>
            <ProjectForm
              catalog={templates.data ?? []}
              submitting={create.isPending}
              submitLabel={create.isPending ? "创建中…" : "创建"}
              showStatus={false}
              onSubmit={(value) => create.mutate(value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
