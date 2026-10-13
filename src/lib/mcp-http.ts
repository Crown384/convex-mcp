import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { runTool, toolDefinitions } from "./mcp-tools";
import { SafeError } from "./pama-env";
import { boundedBody } from "./auth/proxy";
import { siteOrigin } from "./auth/settings";
import { noStoreHeaders } from "./http-headers";
export async function serveMcp(request:Request) {
  const server=new Server({name:"pama-convex-mcp",version:"0.3.0"},{capabilities:{tools:{}}});
  server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:toolDefinitions}));
  server.setRequestHandler(CallToolRequestSchema,async ({params})=>{
    try {return {content:[{type:"text",text:JSON.stringify(await runTool(params.name,params.arguments??{}))}]};}
    catch(error) {
      const code=error instanceof SafeError?error.code:"UPSTREAM_FAILURE";
      return {content:[{type:"text",text:JSON.stringify({error:code})}],isError:true};
    }
  });
  const transport=new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator:undefined,enableJsonResponse:true,
    allowedHosts:[new URL(siteOrigin()).host],allowedOrigins:[siteOrigin()],enableDnsRebindingProtection:true,
  });
  try {
    await server.connect(transport);
    const parsedBody=request.method==="POST"?JSON.parse(await boundedBody(request,32768)):undefined;
    const response=await transport.handleRequest(request,{parsedBody});
    const headers=new Headers(response.headers);
    for(const [key,value] of Object.entries(noStoreHeaders))headers.set(key,value);
    return new Response(response.body,{status:response.status,headers});
  } catch {
    return Response.json({jsonrpc:"2.0",id:null,error:{code:-32700,message:"Invalid request"}},{status:400,headers:noStoreHeaders});
  } finally {await server.close();}
}
