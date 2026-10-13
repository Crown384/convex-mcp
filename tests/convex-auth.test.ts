declare global { interface ImportMeta { glob(pattern:string):Record<string,()=>Promise<unknown>>; } }
import { createHash } from "node:crypto";
import { beforeEach,afterEach,expect,it,vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import authSchema from "../convex/betterAuth/schema";
const env={...process.env};
beforeEach(()=>{
  process.env.AUTH_SITE_URL="https://mcp.example.com";
  process.env.BETTER_AUTH_SECRET="s".repeat(48);
  process.env.AUTH_ALLOWED_EMAILS="owner@example.com";
  process.env.MAILJET_API_KEY="fake-key";process.env.MAILJET_SECRET_KEY="fake-secret";
  process.env.MAILJET_FROM_EMAIL="sender@example.com";
});
afterEach(()=>{process.env={...env};vi.restoreAllMocks();});
it("persists email-code login in the real local Convex auth component",async()=>{
  const t=convexTest(schema,import.meta.glob("../convex/**/*.ts"));
  t.registerComponent("betterAuth",authSchema,{
    ...import.meta.glob("../convex/betterAuth/**/*.ts"),
    "../convex/betterAuth/_generated/server.ts":()=>import("../convex/_generated/server"),
  });
  let otp="";
  vi.spyOn(globalThis,"fetch").mockImplementation(async (_url,options)=>{
    const message=JSON.parse(String(options?.body)).Messages[0];
    otp=message.TextPart.match(/is (\d{6})/)[1];
    return Response.json({Messages:[{Status:"success"}]});
  });
  const headers={"content-type":"application/json",origin:"https://mcp.example.com"};
  const sent=await t.fetch("/api/auth/email-otp/send-verification-otp",{method:"POST",headers,body:JSON.stringify({email:"owner@example.com",type:"sign-in"})});
  expect(sent.status).toBe(200);
  expect(otp).toMatch(/^\d{6}$/);
  const signedIn=await t.fetch("/api/auth/sign-in/email-otp",{method:"POST",headers,body:JSON.stringify({email:"owner@example.com",otp})});
  expect(signedIn.status).toBe(200);
  const cookie=signedIn.headers.getSetCookie().map(value=>value.split(";")[0]).join("; ");
  const current=await t.fetch("/api/auth/get-session",{headers:{cookie}});
  expect((await current.json()).user.email).toBe("owner@example.com");

  const registration=await t.fetch("/api/auth/oauth2/register",{method:"POST",headers,body:JSON.stringify({
    client_name:"Convex QA",redirect_uris:["https://chatgpt.com/connector_platform/oauth/callback"],token_endpoint_auth_method:"none",scope:"mcp:read offline_access"
  })});
  expect(registration.status).toBe(200);
  const client=await registration.json();
  const verifier="v".repeat(64);
  const query=new URLSearchParams({client_id:client.client_id,redirect_uri:client.redirect_uris[0],response_type:"code",
    scope:"mcp:read offline_access",resource:"https://mcp.example.com/api/mcp",state:"qa-state",
    code_challenge:createHash("sha256").update(verifier).digest("base64url"),code_challenge_method:"S256"});
  const pending=await t.fetch("/api/auth/oauth2/authorize?"+query,{headers:{cookie}});
  expect(pending.headers.get("location")).toContain("/consent");
  const oauthQuery=new URL(pending.headers.get("location")!,"https://mcp.example.com").searchParams.toString();
  const accepted=await t.fetch("/api/auth/oauth2/consent",{method:"POST",headers:{...headers,cookie},body:JSON.stringify({accept:true,oauth_query:oauthQuery})});
  expect(accepted.status).toBe(200);
  const redirect=await accepted.json();
  const code=new URL(redirect.url).searchParams.get("code")!;
  const token=await t.fetch("/api/auth/oauth2/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({client_id:client.client_id,grant_type:"authorization_code",redirect_uri:client.redirect_uris[0],code,
      code_verifier:verifier,resource:"https://mcp.example.com/api/mcp"}).toString()});
  expect(token.status).toBe(200);
  const tokens=await token.json();
  const refreshed=await t.fetch("/api/auth/oauth2/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({client_id:client.client_id,grant_type:"refresh_token",refresh_token:tokens.refresh_token,
      resource:"https://mcp.example.com/api/mcp"}).toString()});
  expect(refreshed.status).toBe(200);
  const rotated=await refreshed.json();
  expect(rotated.refresh_token).not.toBe(tokens.refresh_token);
  const replay=await t.fetch("/api/auth/oauth2/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({client_id:client.client_id,grant_type:"refresh_token",refresh_token:tokens.refresh_token,
      resource:"https://mcp.example.com/api/mcp"}).toString()});
  expect(replay.status).not.toBe(200);
  const allowed=await t.fetch("/api/mcp/check",{method:"POST",headers:{authorization:"Bearer "+tokens.access_token}});
  expect(allowed.status).toBe(200);
  expect((await allowed.json()).clientId).toBe(client.client_id);
  await t.fetch("/api/auth/sign-out",{method:"POST",headers:{...headers,cookie},body:"{}"});
  expect((await t.fetch("/api/mcp/check",{method:"POST",headers:{authorization:"Bearer "+tokens.access_token}})).status).toBe(401);
  const denied=await t.fetch("/api/mcp/check",{method:"POST",headers:{authorization:"Bearer "+"x".repeat(48)}});
  expect(denied.status).toBe(401);
});

it("allows only one concurrent use of a valid email code",async()=>{
  const t=convexTest(schema,import.meta.glob("../convex/**/*.ts"));
  t.registerComponent("betterAuth",authSchema,{...import.meta.glob("../convex/betterAuth/**/*.ts"),
    "../convex/betterAuth/_generated/server.ts":()=>import("../convex/_generated/server")});
  let otp="";
  vi.spyOn(globalThis,"fetch").mockImplementation(async(_url,options)=>{
    otp=JSON.parse(String(options?.body)).Messages[0].TextPart.match(/is (\d{6})/)[1];
    return Response.json({Messages:[{Status:"success"}]});
  });
  const headers={"content-type":"application/json",origin:"https://mcp.example.com"};
  const send=()=>t.fetch("/api/auth/email-otp/send-verification-otp",{method:"POST",headers,
    body:JSON.stringify({email:"owner@example.com",type:"sign-in"})});
  const verify=()=>t.fetch("/api/auth/sign-in/email-otp",{method:"POST",headers,
    body:JSON.stringify({email:"owner@example.com",otp})});
  await send();expect((await verify()).status).toBe(200);
  await send();
  const responses=await Promise.all([verify(),verify(),verify()]);
  expect(responses.filter(response=>response.status===200)).toHaveLength(1);
});
it("limits OTP requests in production even when no client IP header exists",async()=>{
  process.env={...process.env,NODE_ENV:"production"};
  const t=convexTest(schema,import.meta.glob("../convex/**/*.ts"));
  t.registerComponent("betterAuth",authSchema,{...import.meta.glob("../convex/betterAuth/**/*.ts"),
    "../convex/betterAuth/_generated/server.ts":()=>import("../convex/_generated/server")});
  vi.spyOn(globalThis,"fetch").mockResolvedValue(Response.json({Messages:[{Status:"success"}]}));
  const statuses=[];
  for(let i=0;i<4;i++){
    const response=await t.fetch("/api/auth/email-otp/send-verification-otp",{method:"POST",
      headers:{"content-type":"application/json",origin:"https://mcp.example.com"},
      body:JSON.stringify({email:"owner@example.com",type:"sign-in"})});
    statuses.push(response.status);
  }
  expect(statuses).toEqual([200,200,200,429]);
});

it("rotates resends without leaving the latest code reusable",async()=>{
  const t=convexTest(schema,import.meta.glob("../convex/**/*.ts"));
  t.registerComponent("betterAuth",authSchema,{...import.meta.glob("../convex/betterAuth/**/*.ts"),
    "../convex/betterAuth/_generated/server.ts":()=>import("../convex/_generated/server")});
  let otp="";
  vi.spyOn(globalThis,"fetch").mockImplementation(async(_url,options)=>{
    otp=JSON.parse(String(options?.body)).Messages[0].TextPart.match(/is (\d{6})/)[1];
    return Response.json({Messages:[{Status:"success"}]});
  });
  const headers={"content-type":"application/json",origin:"https://mcp.example.com"};
  const send=()=>t.fetch("/api/auth/email-otp/send-verification-otp",{method:"POST",headers,body:JSON.stringify({email:"owner@example.com",type:"sign-in"})});
  const verify=()=>t.fetch("/api/auth/sign-in/email-otp",{method:"POST",headers,body:JSON.stringify({email:"owner@example.com",otp})});
  await send();await verify();
  await send();await send();
  expect((await verify()).status).toBe(200);
  expect((await verify()).status).not.toBe(200);
});
