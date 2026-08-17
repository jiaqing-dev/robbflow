"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthFrame } from "@/components/auth-frame";
import { authApi, setToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@robbflow.dev");
  const [password, setPassword] = useState("robbflow");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const res = await authApi.login(email, password);
      setToken(res.access_token);
      router.replace("/inbox");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame title="登录 RobbFlow">
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-[#2a2e3a] bg-[#0b0c0e] px-3 py-2 text-[13px] outline-none focus:border-[#ff6a2b]"
          placeholder="邮箱"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-[#2a2e3a] bg-[#0b0c0e] px-3 py-2 text-[13px] outline-none focus:border-[#ff6a2b]"
          placeholder="密码"
        />
        {error && <div className="text-[12px] text-rose-400">{error}</div>}
        <button
          disabled={pending}
          className="w-full rounded-md bg-[#ff6a2b] py-2 text-[13px] font-medium text-black"
        >
          {pending ? "登录中…" : "进入工作区"}
        </button>
      </form>
      <p className="mt-4 text-center text-[12px] text-[#8b90a0]">
        演示账号已填好。没有账号？{" "}
        <Link href="/register" className="text-[#ffb088]">
          注册
        </Link>
      </p>
    </AuthFrame>
  );
}
