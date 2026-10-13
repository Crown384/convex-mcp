/// <reference types="vite/client" />
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
  const denied=await t.fetch("/api/mcp/check",{method:"POST",headers:{authorization:"Bearer "+"x".repeat(48)}});
  expect(denied.status).toBe(401);
});
