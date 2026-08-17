"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { dataApi } from "@/lib/api";

export default function CyclesPage() {
  const projects = useQuery({ queryKey: ["projects"], queryFn: dataApi.projects });

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <header className="mb-5">
        <h1 className="text-[18px] font-semibold">迭代</h1>
        <p className="text-[12px] text-[#8b90a0]">迭代已收入项目中心。选一个项目继续。</p>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        {(projects.data ?? []).map((p) => (
          <Link
            key={p.id}
            href={`/projects/${p.slug}?tab=cycles`}
            className="rounded-xl border border-[#232633] bg-[#12141a] px-4 py-3 hover:border-[#3a3f52]"
          >
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
              <span className="text-[14px]">{p.name}</span>
            </div>
            <p className="mt-1 text-[12px] text-[#8b90a0]">打开迭代与里程碑</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
