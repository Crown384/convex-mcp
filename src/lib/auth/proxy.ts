import { AuthFailure, ownerEmail, siteOrigin } from "./settings";
import { noStoreHeaders } from "../http-headers";

export function backendOrigin() {
  const input=process.env.CONVEX_AUTH_SITE_URL;
  if (!input) throw new AuthFailure("AUTH_NOT_CONFIGURED");
  const url=new URL(input);
  const local=process.env.NODE_ENV !== "production" && url.protocol==="http:" && ["localhost","127.0.0.1"].includes(url.hostname);
  if ((!local && (url.protocol!=="https:" || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)?\.convex\.site$/.test(url.hostname))) ||
      url.username || url.password || url.pathname!=="/" || url.search || url.hash) throw new AuthFailure("AUTH_NOT_CONFIGURED");
  return url.origin;
}
export async function boundedBody(request:Request, maximum:number) {
  const reader=request.body?.getReader();
  if (!reader) return "";
  const chunks:Uint8Array[]=[];let size=0;
  try {
    while(true) {
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;
      if(size>maximum) {await reader.cancel();throw new AuthFailure("REQUEST_TOO_LARGE");}
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const joined=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.byteLength;}
  return new TextDecoder("utf-8",{fatal:true}).decode(joined);
}
export function sameOrigin(request:Request) {
  return request.headers.get("origin")===siteOrigin();
}
const exposed = new Set(["get-session","sign-out","sign-in/email-otp","email-otp/send-verification-otp",
  "oauth2/authorize","oauth2/consent","oauth2/token","oauth2/register","oauth2/public-client",
  "oauth2/get-consents","oauth2/delete-consent","jwks",".well-known/oauth-authorization-server",".well-known/openid-configuration"]);
const browserPosts = new Set(["sign-out","sign-in/email-otp","email-otp/send-verification-otp","oauth2/consent","oauth2/delete-consent"]);

export async function proxyAuth(request:Request, path:string) {
  try {
    if(!exposed.has(path)) return Response.json({error:"NOT_FOUND"},{status:404,headers:noStoreHeaders});
    if(request.method==="POST" && browserPosts.has(path) && !sameOrigin(request))
      return Response.json({error:"FORBIDDEN"},{status:403,headers:noStoreHeaders});
    const url=new URL(request.url);
    const headers=new Headers();
    for(const key of ["content-type","cookie","origin","authorization","user-agent"])
      {const value=request.headers.get(key);if(value)headers.set(key,value);}
    const response=await fetch(backendOrigin()+"/api/auth/"+path+url.search,{
      method:request.method,headers,redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(15000),
      ...(request.method==="POST"?{body:await boundedBody(request,16384)}:{}),
    });
    const output=new Headers(noStoreHeaders);
    for(const key of ["content-type","location"]) {const value=response.headers.get(key);if(value)output.set(key,value);}
    for(const value of response.headers.getSetCookie()) output.append("set-cookie",value);
    if(response.status>=500) return Response.json({error:"AUTH_UNAVAILABLE"},{status:503,headers:noStoreHeaders});
    return new Response(await boundedBody(new Request("https://response.invalid",{method:"POST",body:response.body,duplex:"half"} as RequestInit),131072),{status:response.status,headers:output});
  } catch { return Response.json({error:"AUTH_UNAVAILABLE"},{status:503,headers:noStoreHeaders}); }
}
export async function ownerSession(request:Request) {
  const response=await fetch(backendOrigin()+"/api/auth/get-session",{
    headers:{cookie:request.headers.get("cookie")??""},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(10000),
  });
  if(!response.ok) throw new AuthFailure();
  const data=await response.json() as {user?:{id?:unknown;email?:unknown;emailVerified?:unknown};session?:{expiresAt?:string}};
  if(typeof data?.user?.id!=="string" || data.user.emailVerified!==true || !ownerEmail(data.user.email) ||
      !data.session?.expiresAt || new Date(data.session.expiresAt).getTime()<=Date.now()) throw new AuthFailure();
  return {subject:data.user.id};
}
export async function mcpPrincipal(request:Request) {
  const authorization=request.headers.get("authorization");
  if(!authorization?.startsWith("Bearer ") || authorization.length>8192) throw new AuthFailure();
  const response=await fetch(backendOrigin()+"/api/mcp/check",{
    method:"POST",headers:{authorization},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(10000),
  });
  if(!response.ok)throw new AuthFailure();
  const data=await response.json() as {subject?:unknown;clientId?:unknown;scopes?:unknown};
  if(typeof data.subject!=="string" || typeof data.clientId!=="string" ||
      !Array.isArray(data.scopes) || !data.scopes.includes("mcp:read")) throw new AuthFailure();
  return {subject:data.subject,clientId:data.clientId,scopes:["mcp:read"]};
}
