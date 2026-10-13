"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/src/lib/auth-client";
export default function SignIn() {
  const router=useRouter();
  const [email,setEmail]=useState("");
  const [otp,setOtp]=useState("");
  const [sent,setSent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [cooldown,setCooldown]=useState(0);
  const codeInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(sent)codeInput.current?.focus();},[sent]);
  useEffect(()=>{
    if(!cooldown)return;
    const timer=setTimeout(()=>setCooldown(value=>value-1),1000);
    return ()=>clearTimeout(timer);
  },[cooldown]);
  async function send(event?:FormEvent) {
    event?.preventDefault();if(busy)return;
    setBusy(true);setError("");
    try {
      const response=await authClient.emailOtp.sendVerificationOtp({email:email.trim(),type:"sign-in"});
      if(response.error)throw new Error();
      setSent(true);setOtp("");setCooldown(60);
    }catch{setError("We couldn’t send your code. Check your email address and try again.");}
    finally{setBusy(false);}
  }
  async function verify(event:FormEvent) {
    event.preventDefault();if(busy)return;
    setBusy(true);setError("");
    try {
      const response=await authClient.signIn.emailOtp({email:email.trim(),otp});
      if(response.error)throw new Error();
      const data=response.data as {redirect?:boolean;url?:string}|null;
      if(data?.redirect && data.url){window.location.assign(data.url);return;}
      router.replace("/dashboard");router.refresh();
    }catch{setError("That code is invalid or expired. Try again or request a new code.");}
    finally{setBusy(false);}
  }
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 text-slate-950">
    <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Pama Convex MCP</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{sent?"Check your email":"Sign in"}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">{sent?"Enter the six-digit code sent to "+email+". It expires in five minutes.":"Enter your email and we’ll send you a sign-in code."}</p>
      <form onSubmit={sent?verify:send} className="mt-7 space-y-4">
        {!sent?<><label htmlFor="email" className="block text-sm font-medium">Email address</label>
          <input id="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event=>setEmail(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-slate-600"/>
        </>:<><label htmlFor="code" className="block text-sm font-medium">Sign-in code</label>
          <input id="code" ref={codeInput} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={otp} onChange={event=>setOtp(event.target.value.replace(/\D/g,""))}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl tracking-[0.3em] outline-none focus:ring-2 focus:ring-slate-600"/>
        </>}
        {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
        <button disabled={busy||(sent&&otp.length!==6)} className="w-full rounded-xl bg-slate-950 px-4 py-3 font-medium text-white disabled:opacity-50">{busy?"Please wait…":sent?"Verify code":"Send code"}</button>
      </form>
      {sent&&<div className="mt-5 flex flex-wrap justify-between gap-3 text-sm">
        <button disabled={busy} onClick={()=>{setSent(false);setOtp("");setError("");}} className="underline underline-offset-4 disabled:opacity-50">Change email</button>
        <button disabled={busy||cooldown>0} onClick={()=>void send()} className="underline underline-offset-4 disabled:opacity-50">{cooldown>0?"Resend in "+cooldown+"s":"Send a new code"}</button>
      </div>}
    </section>
  </main>;
}
