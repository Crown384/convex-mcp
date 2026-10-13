"use client";
import { useEffect, useState } from "react";
import { authClient } from "@/src/lib/auth-client";
import { useRouter } from "next/navigation";

type Environment = "staging" | "production";
type Project = { slug: string; name: string; environments: Environment[] };
type Status = { project: string; environment: Environment; deployment: string; reachable: boolean };
export default function Dashboard() {
  const router=useRouter();
  const {data:session,isPending}=authClient.useSession();
  const connected=Boolean(session);
  const [grants,setGrants]=useState<{id:string;clientId:string}[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState("");
  const [checks, setChecks] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(()=>{
    if(!isPending&&!session){router.replace("/sign-in");return;}
    if(!session)return;
    let active=true;
    setBusy(true);
    void fetch("/api/owner",{cache:"no-store"}).then(async response=>{
      if(response.status===401){router.replace("/sign-in");return;}
      const data=await response.json();
      if(!response.ok||!Array.isArray(data.projects))throw new Error();
      if(active)setProjects(data.projects);
    }).catch(()=>{if(active)setError("Unable to load your projects.");}).finally(()=>{if(active)setBusy(false);});
    void authClient.oauth2.getConsents().then(result=>{
      if(active&&result.data)setGrants(result.data.map(grant=>({id:grant.id,clientId:grant.clientId})));
    });
    return ()=>{active=false;};
  },[session,isPending,router]);
  async function revoke(id:string) {
    setError("");
    const response=await authClient.oauth2.deleteConsent({id});
    if(response.error){setError("Unable to revoke this connection.");return;}
    setGrants(previous=>previous.filter(grant=>grant.id!==id));
  }
  async function check(project: string, environment: Environment) {
    const key = project + ":" + environment;
    setChecking(key);
    setChecks(previous => ({ ...previous, [key]: "Checking..." }));
    try {
      const response = await fetch("/api/owner", {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, environment }),
      });
      const data: Status & { error?: string } = await response.json();
      setChecks(previous => ({ ...previous, [key]: response.ok && data.reachable
        ? "Connected to " + data.deployment : (data.error ?? "Unavailable") }));
    } catch { setChecks(previous => ({ ...previous, [key]: "Connection failed" })); }
    finally { setChecking(""); }
  }

  async function disconnect() {
    const response=await authClient.signOut();
    if(response.error){setError("Unable to sign out. Try again.");return;}
    setProjects([]);setChecks({});setGrants([]);
    router.replace("/sign-in");router.refresh();
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
          {connected && <button type="button" onClick={disconnect} className="shrink-0 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100">Sign out</button>}
        </header>
        {error&&<p role="alert" className="mb-5 text-sm text-red-700">{error}</p>}
        {!connected||busy ? <p role="status" className="text-sm text-slate-600">Loading your dashboard…</p> : (
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
        {connected&&<section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Connected MCP clients</h2>
          {grants.length===0&&<p className="mt-3 text-sm text-slate-600">No clients connected.</p>}
          {grants.map(grant=><div key={grant.id} className="mt-4 flex items-center justify-between gap-3">
            <span className="min-w-0 break-all text-xs text-slate-600">{grant.clientId}</span>
            <button onClick={()=>void revoke(grant.id)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium">Revoke</button>
          </div>)}
        </section>}
        <footer className="mt-10 border-t border-slate-200 py-6 text-xs leading-6 text-slate-500">
          Personal-use read-only MVP. No arbitrary queries, database mutation, environment values, or production writes are exposed. MCP clients connect through email sign-in and OAuth approval. Sign out or revoke a connection to stop its access.
        </footer>
      </div>
    </main>
  );
}
