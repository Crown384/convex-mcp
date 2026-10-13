import { authIssuer, mcpResource, MCP_SCOPE, siteOrigin } from "./settings";
import { noStoreHeaders } from "../http-headers";
import { proxyAuth } from "./proxy";
export function resourceMetadata() {
  try {
    return Response.json({resource:mcpResource(),authorization_servers:[authIssuer()],
      scopes_supported:[MCP_SCOPE,"offline_access"],bearer_methods_supported:["header"],
      resource_name:"Pama Convex MCP"},{headers:{...noStoreHeaders,"Access-Control-Allow-Origin":"*"}});
  } catch {return Response.json({error:"AUTH_NOT_CONFIGURED"},{status:503,headers:noStoreHeaders});}
}
export async function serverMetadata() {
  try {
    return await proxyAuth(new Request(siteOrigin()+"/api/auth/.well-known/oauth-authorization-server"),".well-known/oauth-authorization-server");
  } catch {return Response.json({error:"AUTH_NOT_CONFIGURED"},{status:503,headers:noStoreHeaders});}
}
export function mcpChallenge(status=401) {
  let challenge='Bearer error="invalid_token"';
  try {challenge='Bearer resource_metadata="'+siteOrigin()+'/.well-known/oauth-protected-resource/api/mcp", scope="'+MCP_SCOPE+'"';}catch{}
  return Response.json({error:"UNAUTHORIZED"},{status,headers:{...noStoreHeaders,"WWW-Authenticate":challenge}});
}
