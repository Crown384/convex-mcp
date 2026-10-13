"use client";
import { FormEvent, useState } from "react";

type Environment = "staging" | "production";
type Project = { slug: string; name: string; environments: Environment[] };
type Status = { project: string; environment: Environment; deployment: string; reachable: boolean };
export default function Dashboard() {
  // Deliberately kept only in tab memory: no cookie, localStorage or URL token.
  const [token, setToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState("");
  const [checks, setChecks] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setConnected(false); setProjects([]);
    try {
      const response = await fetch("/api/owner", { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
      const data: { projects?: Project[]; error?: string } = await response.json();
      if (!response.ok || !Array.isArray(data.projects)) throw new Error(data.error ?? "Connection failed");
      setProjects(data.projects);
      setConnected(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Connection failed"); }
    finally { setBusy(false); }
  }

  async function check(project: string, environment: Environment) {
    const key = project + ":" + environment;
    setChecking(key);
    setChecks(previous => ({ ...previous, [key]: "Checking..." }));
    try {
      const response = await fetch("/api/owner", {
        method: "POST", cache: "no-store",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ project, environment }),
      });
      const data: Status & { error?: string } = await response.json();
      setChecks(previous => ({ ...previous, [key]: response.ok && data.reachable
        ? "Connected to " + data.deployment : (data.error ?? "Unavailable") }));
    } catch { setChecks(previous => ({ ...previous, [key]: "Connection failed" })); }
    finally { setChecking(""); }
  }

  function disconnect() {
    setToken(""); setConnected(false); setProjects([]); setChecks({}); setError("");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-7">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Pama / Developer tools</div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Convex control plane</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">View the deployments authorized by PamaENV. No deploy key is sent to your browser or the MCP client.</p>
          </div>
          {connected && <button type="button" onClick={disconnect} className="shrink-0 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100">Disconnect</button>}
        </header>
        {!connected ? (
          <section className="max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold">Owner access</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Enter the personal control-plane access token configured on the server. It stays in memory and is cleared when this tab closes.</p>
            <form onSubmit={connect} className="mt-6 space-y-4">
              <label htmlFor="access-token" className="block text-sm font-semibold">Access token</label>
              <input id="access-token" type="password" autoComplete="off" spellCheck={false} required minLength={32} value={token} onChange={event => setToken(event.target.value)} placeholder="Paste your server access token" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-500" />
              {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
              <button type="submit" disabled={busy || token.length < 32} className="w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Connecting..." : "Open dashboard"}</button>
            </form>
          </section>
        ) : (
          <section aria-live="polite" className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Managed projects</h2>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">{projects.length} available</span>
            </div>
            {projects.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">No projects have been granted to this PamaENV machine client. Add a scoped project grant in PamaENV.</p>}
            {projects.map(project => <article key={project.slug} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold">{project.name}</h3>
              <p className="mt-1 text-xs text-slate-500">{project.slug}</p>
              <div className="mt-4 space-y-3">
                {project.environments.map(environment => {
                  const key = project.slug + ":" + environment;
                  return <div key={key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold capitalize">{environment}</div>
                      <div role="status" className="mt-1 text-xs text-slate-600">{checks[key] ?? (environment === "production" ? "Explicit server opt-in required" : "Not checked")}</div>
                    </div>
                    <button type="button" disabled={checking === key} onClick={() => check(project.slug, environment)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">Check access</button>
                  </div>;
                })}
              </div>
            </article>)}
          </section>
        )}
        <footer className="mt-10 border-t border-slate-200 py-6 text-xs leading-6 text-slate-500">
          Personal-use read-only MVP. No arbitrary queries, database mutation, environment values, or production writes are exposed. MCP clients must supply the same configured bearer token; OAuth is not yet implemented.
        </footer>
      </div>
    </main>
  );
}
