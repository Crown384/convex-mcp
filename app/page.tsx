import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-slate-50 px-5 py-8 text-slate-950 sm:px-10">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between border-b border-slate-200 pb-6">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-slate-950 font-bold text-white">P</div>
          <div><p className="text-sm font-semibold">Pama Convex</p><p className="text-xs text-slate-500">Control plane</p></div>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium">Read-only MVP</span>
      </header>
      <section className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-12 py-16 lg:grid-cols-2">
        <div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Secure project operations</p>
          <h1 className="text-5xl font-semibold tracking-[-0.06em] sm:text-6xl">Your Convex deployments. <span className="text-slate-400">One control plane.</span></h1>
          <p className="mt-7 max-w-lg text-base leading-7 text-slate-600">Inspect registered Convex projects from your phone or a trusted MCP client. Production access is explicitly gated. Secrets are resolved server-to-server through PamaENV.</p>
          <Link href="/dashboard" className="mt-9 inline-flex min-h-12 items-center rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800">Open control plane →</Link>
        </div>
        <aside className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <p className="text-sm font-semibold">Current capabilities</p>
          <div className="mt-6 space-y-5 text-sm text-slate-700">
            <p>✓ Authorized project and environment discovery</p>
            <p>✓ Scoped PamaENV secret resolution</p>
            <p>✓ Read-only deployment connection diagnostics</p>
            <p>✓ Staging environment variable names only</p>
            <p className="border-t border-slate-100 pt-5 text-slate-500">Not enabled: mutation tools, secret values, direct document browsing, OAuth, and deployment changes.</p>
          </div>
        </aside>
      </section>
      <footer className="mx-auto w-full max-w-5xl border-t border-slate-200 py-6 text-xs text-slate-500">MCP path: /api/mcp · Pama Technologies</footer>
    </main>
  );
}
