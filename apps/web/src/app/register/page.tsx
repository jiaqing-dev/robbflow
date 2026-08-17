"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthFrame } from "@/components/auth-frame";
import { authApi, setToken } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspace, setWorkspace] = useState("我的工作区");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const res = await authApi.register({ name, email, password, workspace_name: workspace });
      setToken(res.access_token);
      router.replace("/inbox");
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame title="创建工作区">
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="姓名"
          className="w-full rounded-md border border-[#2a2e3a] bg-[#0b0c0e] px-3 py-2 text-[13px] outline-none focus:border-[#ff6a2b]"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          type="email"
          placeholder="邮箱"
          className="w-full rounded-md border border-[#2a2e3a] bg-[#0b0c0e] px-3 py-2 text-[13px] outline-none focus:border-[#ff6a2b]"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          type="password"
          placeholder="密码（至少 6 位）"
          className="w-full rounded-md border border-[#2a2e3a] bg-[#0b0c0e] px-3 py-2 text-[13px] outline-none focus:border-[#ff6a2b]"
        />
        <input
          value={workspace}
          onChange={(e) => setWorkspace(e.target.value)}
          placeholder="工作区名称"
          className="w-full rounded-md border border-[#2a2e3a] bg-[#0b0c0e] px-3 py-2 text-[13px] outline-none focus:border-[#ff6a2b]"
        />
        {error && <div className="text-[12px] text-rose-400">{error}</div>}
        <button
          disabled={pending}
          className="w-full rounded-md bg-[#ff6a2b] py-2 text-[13px] font-medium text-black"
        >
          {pending ? "创建中…" : "开始使用"}
        </button>
      </form>
      <p className="mt-4 text-center text-[12px] text-[#8b90a0]">
        已有账号？{" "}
        <Link href="/login" className="text-[#ffb088]">
          登录
        </Link>
      </p>
    </AuthFrame>
  );
}
