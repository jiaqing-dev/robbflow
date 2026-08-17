"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  FolderKanban,
  Inbox,
  Map,
  Search,
  Settings,
  Sparkles,
  SquareUser,
} from "lucide-react";

import { CommandPalette } from "@/components/command-palette";
import { CreateIssueDialog } from "@/components/create-issue-dialog";
import { ApiError, authApi, getToken, setToken, type User, type Workspace } from "@/lib/api";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/inbox", label: "收件箱", icon: Inbox },
  { href: "/my-work", label: "我的工作", icon: SquareUser },
  { href: "/projects", label: "项目", icon: FolderKanban },
  { href: "/roadmap", label: "规划", icon: Map },
  { href: "/settings", label: "设置", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<{ user: User; workspace: Workspace } | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    authApi
      .me()
      .then(setMe)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          setToken(null);
          router.replace("/login");
        }
      });
  }, [router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setCreateOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-[#0b0c0e] text-[#eceef2]">
      <aside className="flex w-[232px] shrink-0 flex-col border-r border-[#232633] bg-[#0e1014]">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#ff6a2b] text-sm font-semibold text-black">
            R
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold tracking-tight">
              {me?.workspace.name ?? "RobbFlow"}
            </div>
            <div className="text-[11px] text-[#8b90a0]">研发协作操作系统</div>
          </div>
        </div>
        <button
          onClick={() => setPaletteOpen(true)}
          className="mx-3 mb-3 flex items-center gap-2 rounded-md border border-[#232633] bg-[#12141a] px-2.5 py-1.5 text-[12px] text-[#8b90a0] hover:border-[#3a3f52]"
        >
          <Search size={13} />
          <span className="flex-1 text-left">搜索或跳转…</span>
          <kbd className="rounded border border-[#2a2e3a] px-1 text-[10px]">⌘K</kbd>
        </button>
        <nav className="flex flex-1 flex-col gap-0.5 px-2">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px]",
                  active
                    ? "bg-[#1a1d26] text-white"
                    : "text-[#b4b8c5] hover:bg-[#161922] hover:text-white",
                )}
              >
                <Icon size={15} className={active ? "text-[#ff6a2b]" : "text-[#8b90a0]"} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[#232633] p-3">
          <button
            onClick={() => setCreateOpen(true)}
            className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-[#ff6a2b] px-3 py-1.5 text-[12px] font-medium text-black hover:bg-[#ff814d]"
          >
            新建工作项
            <kbd className="rounded bg-black/10 px-1 text-[10px]">⌘N</kbd>
          </button>
          <div className="flex items-center gap-2 text-[12px] text-[#8b90a0]">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1a1d26] text-[11px] text-[#ffb088]">
              {me?.user.name.slice(0, 1) ?? "R"}
            </div>
            <span className="truncate">{me?.user.name ?? "…"}</span>
            <Bell size={13} className="ml-auto" />
            <Sparkles size={13} />
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <CreateIssueDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
