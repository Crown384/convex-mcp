"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/src/lib/auth-client";
export default function Consent() {
  const params=useSearchParams();
  const clientId=params.get("client_id")??"";
  const scopes=(params.get("scope")??"").split(" ").filter(Boolean);
  const valid=scopes.includes("mcp:read")&&scopes.every(scope=>["mcp:read","offline_access"].includes(scope))&&params.has("sig");
  const [name,setName]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    let active=true;
    if(!valid||!clientId)return;
    void authClient.oauth2.publicClient({query:{client_id:clientId}}).then(response=>{
      if(!active)return;
      if(response.error){setError("This authorization request is unavailable.");return;}
      setName(response.data?.client_name??"MCP client");
    }).catch(()=>{if(active)setError("This authorization request is unavailable.");});
    return ()=>{active=false;};
  },[clientId,valid]);
  async function decide(accept:boolean) {
    if(busy)return;setBusy(true);setError("");
    try {
      const response=await authClient.oauth2.consent({accept});
      if(response.error||!response.data?.url)throw new Error();
      window.location.assign(response.data.url);
    }catch{setError("Authorization failed. Restart the connection from your MCP client.");setBusy(false);}
  }
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 text-slate-950">
    <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Pama Convex MCP</p>
      <h1 className="mt-4 text-2xl font-semibold">Connect {name||"your MCP client"}</h1>
      {!valid?<p role="alert" className="mt-5 text-sm text-red-700">Invalid authorization request. Restart the connection from your MCP client.</p>:<>
        <p className="mt-4 text-sm leading-6 text-slate-600">Allow this client to read your authorized Convex projects and staging diagnostics.</p>
        {scopes.includes("offline_access")&&<p className="mt-3 text-sm leading-6 text-slate-600">The connection can refresh while your sign-in session is active. You can revoke it from the dashboard.</p>}
        <p className="mt-3 text-sm text-slate-600">This connection cannot change your data.</p>
        {error&&<p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        <div className="mt-7 flex gap-3">
          <button disabled={busy||!name} onClick={()=>void decide(false)} className="flex-1 rounded-xl border border-slate-300 px-4 py-3 font-medium disabled:opacity-50">Cancel</button>
          <button disabled={busy||!name} onClick={()=>void decide(true)} className="flex-1 rounded-xl bg-slate-950 px-4 py-3 font-medium text-white disabled:opacity-50">{busy?"Please wait…":"Allow access"}</button>
        </div>
      </>}
    </section>
  </main>;
}
