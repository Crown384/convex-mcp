import Link from "next/link";

const guardrails = [
  {
    number: "01",
    title: "Explicit deployment targeting",
    description: "Every future operation must name its project and environment. No implicit production access.",
  },
  {
    number: "02",
    title: "Credentials stay server-side",
    description: "Deployment keys will be encrypted, scoped, and unavailable to browsers or MCP responses.",
  },
  {
    number: "03",
    title: "Review before write",
    description: "Production mutations remain unavailable until authorization, preview, approval, and audit are verified.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f8fa] text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 sm:px-10 sm:py-9">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-slate-950 text-sm font-bold text-white">P</span>
            <div>
              <p className="text-sm font-semibold tracking-tight">Pama Convex</p>
              <p className="text-xs text-slate-500">Control plane</p>
            </div>
          </div>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900">
            Foundation · Not connected
          </span>
        </header>

        <section className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.2fr_0.8fr] lg:py-24">
          <div className="max-w-2xl">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Phase 0 / Security-first setup</p>
            <h1 className="text-5xl font-semibold leading-[1.08] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
              One place for every <span className="text-slate-400">Convex deployment.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
              A mobile-first control plane for inspecting and managing explicitly authorized Convex projects. This build is a foundation preview, not a working admin dashboard or MCP endpoint.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="https://github.com/Crown384/convex-mcp/blob/main/PROJECT_SPEC.md"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              >
                Read product specification <span aria-hidden="true" className="ml-2">↗</span>
              </Link>
              <Link
                href="https://github.com/Crown384/convex-mcp/blob/main/AGENTS.md"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              >
                Engineering rules
              </Link>
            </div>
          </div>
          <section aria-label="Release readiness" className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold tracking-tight">Release readiness</h2>
              <span className="text-xs font-medium text-slate-400">0 / 3 services enabled</span>
            </div>
            <div className="mt-7 divide-y divide-slate-100">
              {[
                ["Owner sign-in", "Not configured"],
                ["Managed deployments", "Not connected"],
                ["Remote MCP endpoint", "Not enabled"],
              ].map(([name, status]) => (
                <div key={name} className="flex items-center justify-between gap-3 py-5 first:pt-0 last:pb-0">
                  <span className="text-sm font-medium text-slate-800">{name}</span>
                  <span className="text-right text-xs text-slate-500">{status}</span>
                </div>
              ))}
            </div>
            <div className="mt-8 rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Default security posture</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                No deploy keys requested, no live project connected, and no administrative actions exposed.
              </p>
            </div>
          </section>
        </section>

        <section aria-label="Architecture principles" className="grid gap-3 border-t border-slate-200 py-8 md:grid-cols-3">
          {guardrails.map((item) => (
            <div key={item.number} className="rounded-2xl border border-slate-200 bg-white p-5">
              <span className="text-xs font-semibold text-slate-400">{item.number}</span>
              <h2 className="mt-3 text-sm font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
            </div>
          ))}
        </section>
        <footer className="py-5 text-xs text-slate-500">
          Pama Convex MCP · Foundation preview · No production access
        </footer>
      </div>
    </main>
  );
}
