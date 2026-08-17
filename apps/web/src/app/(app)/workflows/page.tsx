"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { type ReactNode, useState } from "react";

import { MiniFlow } from "@/components/mini-flow";
import { TypeRelationPreview } from "@/components/type-relation-preview";
import { dataApi } from "@/lib/api";
import { groupedTypes, groupedWorkflows } from "@/lib/flow-catalog";

export default function WorkflowsCatalogPage() {
  const qc = useQueryClient();
  const types = useQuery({ queryKey: ["work-item-types"], queryFn: dataApi.workItemTypes });
  const list = useQuery({ queryKey: ["workflows"], queryFn: dataApi.workflows });
  const [name, setName] = useState("自定义流程");
  const [preset, setPreset] = useState("engineering");
  const create = useMutation({
    mutationFn: () => dataApi.createWorkflow({ name, preset }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflows"] });
      setName("自定义流程");
    },
  });

  const typeGroups = groupedTypes(types.data ?? []);
  const flowGroups = groupedWorkflows(list.data ?? []);
  const loading = types.isLoading || list.isLoading;
  const failed = types.isError || list.isError;

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">流程设计</h1>
          <p className="mt-1 max-w-2xl text-[12px] leading-5 text-[#8b90a0]">
            按分类查看工作区里的全部流程。类型关系决定「谁可以关联谁」，状态流转按工作项类型绑定——缺陷、需求、用例、测试任务各走各的生命周期，不要塞进同一张看板。
          </p>
        </div>
        <Link
          href="/workflows/types"
          className="rounded-md bg-[#ff6a2b] px-3 py-1.5 text-[12px] font-medium text-black"
        >
          编辑类型关系
        </Link>
      </header>

      {loading && <div className="py-16 text-center text-[13px] text-[#6d7280]">加载流程目录…</div>}
      {failed && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-300">
          流程数据加载失败。请确认 API 已启动（http://localhost:8000），然后刷新本页。
        </div>
      )}

      {!loading && !failed && (
        <div className="space-y-10">
          <section>
            <SectionTitle
              kicker="类型关系"
              title="工作项如何互相连接"
              extra={
                <Link href="/workflows/types" className="text-[12px] text-[#ffb088]">
                  打开关系图 →
                </Link>
              }
            />
            <div className="rounded-xl border border-[#232633] bg-[#12141a] p-4">
              <p className="mb-3 text-[12px] text-[#8b90a0]">
                需求归属项目，功能点挂需求，测试任务可关联需求 / 功能点 / 缺陷。事项可标记为缺陷、需求或任务。
              </p>
              <TypeRelationPreview />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {typeGroups.map((g) => (
                <div key={g.id} className="rounded-xl border border-[#232633] bg-[#12141a] p-4">
                  <div className="mb-1 text-[14px] font-medium">{g.title}</div>
                  <p className="mb-3 text-[12px] text-[#8b90a0]">{g.hint}</p>
                  <div className="flex flex-wrap gap-2">
                    {g.items.map((t) => (
                      <span
                        key={t.id}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[#2a2e3a] px-2 py-1 text-[12px]"
                      >
                        <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
                        {t.name}
                        <span className="font-mono text-[10px] text-[#6d7280]">{t.key}</span>
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 text-[11px] text-[#6d7280]">
                    {g.items.reduce((n, t) => n + (t.fields?.length ?? 0), 0)} 个自定义字段 ·{" "}
                    {g.items.reduce((n, t) => n + (t.outputs?.length ?? 0), 0)} 条输出连接
                  </div>
                </div>
              ))}
            </div>
          </section>

          {flowGroups.map((g) => (
            <section key={g.id}>
              <SectionTitle kicker="状态流转" title={g.title} />
              <p className="-mt-2 mb-3 text-[12px] text-[#8b90a0]">{g.hint}</p>
              <div className="grid gap-3 lg:grid-cols-2">
                {g.items.map((wf) => (
                  <Link
                    key={wf.id}
                    href={`/workflows/${wf.id}`}
                    className="rounded-xl border border-[#232633] bg-[#12141a] p-4 hover:border-[#3a3f52]"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[14px] font-medium">{wf.name}</span>
                      {wf.is_default && (
                        <span className="rounded-full bg-[#ff6a2b]/20 px-2 py-0.5 text-[10px] text-[#ffb088]">
                          默认
                        </span>
                      )}
                    </div>
                    <p className="mb-3 text-[12px] text-[#8b90a0]">{wf.description ?? "可视化状态流"}</p>
                    <MiniFlow states={wf.states} />
                    <div className="mt-3 text-[11px] text-[#6d7280]">
                      {wf.states.length} 个状态 · {wf.transitions.length} 条流转 · 点击编辑
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}

          <section className="rounded-xl border border-dashed border-[#2a2e3a] p-4">
            <div className="mb-2 text-[13px] font-medium">从模板新建状态流</div>
            <p className="mb-3 text-[12px] text-[#8b90a0]">
              从缺陷 / 需求 / 用例等模板复制节点与流转，再按团队习惯改名、增删状态。
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-md border border-[#232633] bg-[#0e1014] px-2 py-1.5 text-[12px]"
              />
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
                className="rounded-md border border-[#232633] bg-[#0e1014] px-2 py-1.5 text-[12px]"
              >
                <option value="engineering">任务流程</option>
                <option value="product">需求流程</option>
                <option value="bug">缺陷流程</option>
                <option value="test_case">用例流程</option>
                <option value="test_task">测试任务流程</option>
              </select>
              <button
                onClick={() => create.mutate()}
                disabled={create.isPending || !name.trim()}
                className="rounded-md bg-[#ff6a2b] px-3 py-1.5 text-[12px] font-medium text-black disabled:opacity-40"
              >
                {create.isPending ? "创建中…" : "新建"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function SectionTitle({
  kicker,
  title,
  extra,
}: {
  kicker: string;
  title: string;
  extra?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <div className="text-[11px] tracking-wide text-[#6d7280]">{kicker}</div>
        <h2 className="text-[15px] font-medium">{title}</h2>
      </div>
      {extra}
    </div>
  );
}
