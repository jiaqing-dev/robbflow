export function AuthFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rf-grid flex min-h-screen items-center justify-center bg-[#0b0c0e] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#232633] bg-[#12141a]/90 p-6 shadow-2xl backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ff6a2b] text-base font-semibold text-black">
            R
          </div>
          <div>
            <div className="text-[15px] font-semibold">RobbFlow</div>
            <div className="text-[11px] text-[#8b90a0]">研发操作系统</div>
          </div>
        </div>
        <h1 className="mb-4 text-[16px] font-medium">{title}</h1>
        {children}
      </div>
    </div>
  );
}
