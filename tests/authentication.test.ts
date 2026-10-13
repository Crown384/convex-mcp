import { createHash } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth/minimal";
import { memoryAdapter } from "better-auth/adapters/memory";
import { getAuthTables } from "better-auth/db";
import { authOptions } from "../src/lib/auth/options";
import { authorizeMcp } from "../src/lib/auth/authorize";
import { sendSignInCode } from "../src/lib/auth/mailjet";

const origin = "https://mcp.example.com";
const resource = origin + "/api/mcp";
let delivered: string;
function makeAuth(db: Record<string, object[]>) { return betterAuth({ ...authOptions(async (_email, otp) => { delivered=otp; }), database: memoryAdapter(db) }); }
let auth: ReturnType<typeof makeAuth>;
const env = { ...process.env };
function cookie(response: Response) {
  return response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
}
async function call(path: string, body?: object, cookies = "") {
  return auth.handler(new Request(origin + "/api/auth" + path, {
    method: body ? "POST" : "GET",
    headers: { "content-type": path==="/oauth2/token"?"application/x-www-form-urlencoded":"application/json", origin, cookie: cookies },
    ...(body ? { body: path==="/oauth2/token"?new URLSearchParams(body as Record<string,string>).toString():JSON.stringify(body) } : {}),
  }));
}
async function signIn() {
  expect((await call("/email-otp/send-verification-otp", {email:"owner@example.com",type:"sign-in"})).status).toBe(200);
  const response = await call("/sign-in/email-otp", {email:"owner@example.com",otp:delivered});
  expect(response.status).toBe(200);
  return cookie(response);
}
beforeEach(() => {
  process.env.AUTH_SITE_URL=origin;
  process.env.BETTER_AUTH_SECRET="s".repeat(48);
  process.env.AUTH_ALLOWED_EMAILS="owner@example.com";
  delivered="";
  const db: Record<string, object[]> = Object.fromEntries(Object.keys(getAuthTables(authOptions())).map(key=>[key,[]]));
  auth = makeAuth(db);
});
afterEach(() => { process.env={...env}; vi.restoreAllMocks(); });
describe("real Better Auth email code handlers", () => {
  it("sends a code, creates a verified owner session, and refuses code replay", async () => {
    const cookies=await signIn();
    expect(delivered).toMatch(/^\d{6}$/);
    const session=await (await call("/get-session",undefined,cookies)).json();
    expect(session.user.emailVerified).toBe(true);
    expect(session.user.email).toBe("owner@example.com");
    expect((await call("/sign-in/email-otp",{email:"owner@example.com",otp:delivered})).status).not.toBe(200);
    expect(cookies).toContain("session_token");
  });
  it("refuses an unlisted email before sending any code",async () => {
    const response=await call("/email-otp/send-verification-otp",{email:"stranger@example.com",type:"sign-in"});
    expect(response.status).toBe(403);
    expect(delivered).toBe("");
  });
  it("invalidates the code after three incorrect attempts",async () => {
    await call("/email-otp/send-verification-otp",{email:"owner@example.com",type:"sign-in"});
    const correct=delivered;
    for(let i=0;i<3;i++) expect((await call("/sign-in/email-otp",{email:"owner@example.com",otp:"000000"===correct?"111111":"000000"})).status).not.toBe(200);
    expect((await call("/sign-in/email-otp",{email:"owner@example.com",otp:correct})).status).not.toBe(200);
  });
  it("sign-out destroys the owner session",async () => {
    const cookies=await signIn();
    expect((await call("/sign-out",{},cookies)).status).toBe(200);
    expect(await (await call("/get-session",undefined,cookies)).json()).toBeNull();
  });
});
describe("OAuth and MCP resource boundary",() => {
  it("publishes OAuth metadata, requires S256 PKCE, and rejects unknown scopes",async () => {
    const metadata=await (await call("/.well-known/oauth-authorization-server")).json();
    expect(metadata.issuer).toBe(origin+"/api/auth");
    expect(metadata.code_challenge_methods_supported).toEqual(["S256"]);
    const response=await call("/oauth2/register",{client_name:"Test",redirect_uris:["https://chatgpt.com/connector_platform/oauth/callback"],token_endpoint_auth_method:"none",grant_types:["authorization_code","refresh_token"],scope:"mcp:read offline_access"});
    expect(response.status).toBe(200);
    const client=await response.json();
    const query=new URLSearchParams({client_id:client.client_id,redirect_uri:client.redirect_uris[0],response_type:"code",scope:"mcp:read",resource});
    const denied=await call("/oauth2/authorize?"+query);
    expect(denied.status).not.toBe(200);
    query.set("code_challenge","a".repeat(43));query.set("code_challenge_method","plain");
    expect((await call("/oauth2/authorize?"+query)).status).not.toBe(200);
  });
  it("does not treat an owner session token or the old bearer as an MCP access token",async () => {
    await expect(authorizeMcp(auth,"Bearer "+"a".repeat(48))).rejects.toThrow();
    await expect(authorizeMcp(auth,null)).rejects.toThrow();
  });
});
describe("Mailjet delivery",() => {
  it("uses Send API v3.1 and fails without exposing provider bodies",async () => {
    process.env.MAILJET_API_KEY="fake-public";
    process.env.MAILJET_SECRET_KEY="fake-secret";
    process.env.MAILJET_FROM_EMAIL="sender@example.com";
    const fetchMock=vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(JSON.stringify({Messages:[{Status:"success"}]}),{status:200}));
    await sendSignInCode("owner@example.com","123456");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.mailjet.com/v3.1/send");
    const request=fetchMock.mock.calls[0][1]!;
    expect(JSON.parse(String(request.body)).Messages[0].TextPart).toContain("123456");
    fetchMock.mockResolvedValue(new Response("fake-secret 123456",{status:500}));
    await expect(sendSignInCode("owner@example.com","123456")).rejects.toThrow("MAIL_DELIVERY_FAILED");
  });
});

async function oauthAccess() {
  const cookies=await signIn();
  const registration=await call("/oauth2/register",{client_name:"Test MCP",redirect_uris:["https://chatgpt.com/connector_platform/oauth/callback"],token_endpoint_auth_method:"none",grant_types:["authorization_code","refresh_token"],scope:"mcp:read offline_access"});
  expect(registration.status).toBe(200);
  const client=await registration.json();
  const verifier="v".repeat(64);
  const challenge=createHash("sha256").update(verifier).digest("base64url");
  const query=new URLSearchParams({client_id:client.client_id,redirect_uri:client.redirect_uris[0],response_type:"code",scope:"mcp:read offline_access",resource,code_challenge:challenge,code_challenge_method:"S256",state:"test-state"});
  const pending=await call("/oauth2/authorize?"+query,undefined,cookies);
  const location=pending.headers.get("location");
  expect(location).toContain("/consent");
  const signedQuery=new URL(location!,origin).searchParams.toString();
  const consent=await call("/oauth2/consent",{accept:true,oauth_query:signedQuery},cookies);
  expect(consent.status).toBe(200);
  const redirect=await consent.json();
  const callback=new URL(redirect.url);
  expect(callback.searchParams.get("state")).toBe("test-state");
  const code=callback.searchParams.get("code")!;
  const tokenRequest={client_id:client.client_id,grant_type:"authorization_code",redirect_uri:client.redirect_uris[0],code,code_verifier:verifier,resource};
  const issued=await call("/oauth2/token",tokenRequest);
  expect(issued.status).toBe(200);
  return {cookies,client,tokens:await issued.json(),tokenRequest,signedQuery};
}
describe("complete OAuth code flow",()=>{
  it("issues a resource-bound token after consent and refuses code replay",async()=>{
    const result=await oauthAccess();
    expect(await authorizeMcp(auth,"Bearer "+result.tokens.access_token)).toMatchObject({clientId:result.client.client_id,scopes:["mcp:read"]});
    expect((await call("/oauth2/token",result.tokenRequest)).status).not.toBe(200);
    expect((await call("/oauth2/token",{...result.tokenRequest,resource:"https://evil.example.com"})).status).not.toBe(200);
  });
  it("blocks the issued token immediately after logout",async()=>{
    const result=await oauthAccess();
    await call("/sign-out",{},result.cookies);
    await expect(authorizeMcp(auth,"Bearer "+result.tokens.access_token)).rejects.toThrow();
  });
  it("blocks the issued token immediately after consent revocation",async()=>{
    const result=await oauthAccess();
    const grants=await (await call("/oauth2/get-consents",undefined,result.cookies)).json();
    expect(grants.length).toBe(1);
    expect((await call("/oauth2/delete-consent",{id:grants[0].id},result.cookies)).status).toBe(200);
    await expect(authorizeMcp(auth,"Bearer "+result.tokens.access_token)).rejects.toThrow();
  });
  it("rejects a token after removing owner authorization",async()=>{
    const result=await oauthAccess();
    process.env.AUTH_ALLOWED_EMAILS="different@example.com";
    await expect(authorizeMcp(auth,"Bearer "+result.tokens.access_token)).rejects.toThrow();
  });
});

describe("additional authentication negatives",()=>{
  it("denies altered signatures, expired tokens, and incorrect audience",async()=>{
    const result=await oauthAccess();
    const parts=result.tokens.access_token.split(".");
    parts[2]=(parts[2][0]==="a"?"b":"a")+parts[2].slice(1);
    await expect(authorizeMcp(auth,"Bearer "+parts.join("."))).rejects.toThrow();
    const payload=JSON.parse(Buffer.from(result.tokens.access_token.split(".")[1],"base64url").toString());
    const signed=await auth.api.signJWT({body:{payload:{...payload,aud:"https://evil.example.com"}}});
    await expect(authorizeMcp(auth,"Bearer "+signed.token)).rejects.toThrow();
    const expired=await auth.api.signJWT({body:{payload:{...payload,exp:1}}});
    await expect(authorizeMcp(auth,"Bearer "+expired.token)).rejects.toThrow();
  });
  it("refreshes with rotation and rejects refresh-token replay",async()=>{
    const result=await oauthAccess();
    const response=await call("/oauth2/token",{client_id:result.client.client_id,grant_type:"refresh_token",refresh_token:result.tokens.refresh_token,resource});
    expect(response.status).toBe(200);
    const rotated=await response.json();
    expect(await authorizeMcp(auth,"Bearer "+rotated.access_token)).toMatchObject({clientId:result.client.client_id});
    expect((await call("/oauth2/token",{client_id:result.client.client_id,grant_type:"refresh_token",refresh_token:result.tokens.refresh_token,resource})).status).not.toBe(200);
  });
  it("rejects tampered consent request parameters",async()=>{
    const result=await oauthAccess();
    const tampered=new URLSearchParams(result.signedQuery);
    tampered.set("scope","mcp:write");
    expect((await call("/oauth2/consent",{accept:true,oauth_query:tampered.toString()},result.cookies)).status).not.toBe(200);
  });
  it("hashes OTP records and expires them after five minutes",async()=>{
    await call("/email-otp/send-verification-otp",{email:"owner@example.com",type:"sign-in"});
    const context=await auth.$context;
    const record=await context.adapter.findOne<{value:string}>({model:"verification",where:[{field:"identifier",value:"sign-in-otp-owner@example.com"}]});
    expect(record).not.toBeNull();
    expect(record!.value).not.toContain(delivered);
    vi.useFakeTimers({toFake:["Date"]});
    vi.setSystemTime(Date.now()+301000);
    try {expect((await call("/sign-in/email-otp",{email:"owner@example.com",otp:delivered})).status).not.toBe(200);}
    finally {vi.useRealTimers();}
  });
});

it("allows email login after ninety seconds and rejects expired signed OAuth requests",async()=>{
  const registration=await call("/oauth2/register",{redirect_uris:["https://chatgpt.com/connector_platform/oauth/callback"],token_endpoint_auth_method:"none",scope:"mcp:read"});
  const client=await registration.json();
  const query=new URLSearchParams({client_id:client.client_id,redirect_uri:client.redirect_uris[0],response_type:"code",scope:"mcp:read",resource,code_challenge:"a".repeat(43),code_challenge_method:"S256"});
  const pending=await call("/oauth2/authorize?"+query);
  const result=await pending.json();
  const signedQuery=new URL(result.url,origin).searchParams.toString();
  await call("/email-otp/send-verification-otp",{email:"owner@example.com",type:"sign-in",oauth_query:signedQuery});
  const code=delivered;
  const now=Date.now();
  vi.useFakeTimers({toFake:["Date"]});
  try {
    vi.setSystemTime(now+90000);
    const signedIn=await call("/sign-in/email-otp",{email:"owner@example.com",otp:code,oauth_query:signedQuery});
    expect(signedIn.status).toBe(200);
    expect((await signedIn.json()).url).toContain("/consent");
    vi.setSystemTime(now+601000);
    expect((await call("/oauth2/consent",{accept:true,oauth_query:signedQuery},cookie(signedIn))).status).not.toBe(200);
  }finally{vi.useRealTimers();}
});
