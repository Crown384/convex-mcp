import type { betterAuth } from "better-auth/minimal";
import { AuthFailure, authIssuer, mcpResource, MCP_SCOPE, ownerEmail } from "./settings";

// Full backend validation on every call. No cached session or old personal-token fallback.
export async function authorizeMcp(auth: ReturnType<typeof betterAuth>, authorization: string | null) {
  if (!authorization?.startsWith("Bearer ") || authorization.length > 8192) throw new AuthFailure();
  const token = authorization.slice(7);
  if (token.split(".").length !== 3 || /\s/.test(token)) throw new AuthFailure();
  const api = auth.api as unknown as { verifyJWT: (input: {body:{token:string}}) => Promise<{payload:Record<string,unknown>|null}> };
  const {payload} = await api.verifyJWT({body:{token}});
  if (!payload || payload.iss !== authIssuer() || payload.aud !== mcpResource() ||
      typeof payload.exp !== "number" || payload.exp <= Date.now()/1000 ||
      typeof payload.sub !== "string" || typeof payload.sid !== "string" ||
      typeof payload.azp !== "string" || typeof payload.scope !== "string" ||
      !payload.scope.split(" ").includes(MCP_SCOPE)) throw new AuthFailure();
  const context = await auth.$context;
  const adapter = context.adapter;
  const session = await adapter.findOne<{userId:string;expiresAt:Date}>({model:"session",where:[{field:"id",value:payload.sid}]});
  const user = await adapter.findOne<{email:string;emailVerified:boolean}>({model:"user",where:[{field:"id",value:payload.sub}]});
  const client = await adapter.findOne<{disabled?:boolean}>({model:"oauthClient",where:[{field:"clientId",value:payload.azp}]});
  const consent = await adapter.findOne<{scopes:string[]}>({model:"oauthConsent",where:[
    {field:"clientId",value:payload.azp},{field:"userId",value:payload.sub},
  ]});
  if (!session || session.userId !== payload.sub || new Date(session.expiresAt).getTime() <= Date.now() ||
      !user?.emailVerified || !ownerEmail(user.email) || !client || client.disabled ||
      !consent?.scopes.includes(MCP_SCOPE)) throw new AuthFailure();
  return { subject:payload.sub, clientId:payload.azp, scopes:[MCP_SCOPE] };
}
