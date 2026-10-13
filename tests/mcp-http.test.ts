import { afterEach,beforeEach,expect,it,vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { POST as mcpPost } from "../app/api/mcp/route";
import { GET as ownerGet,POST as ownerPost } from "../app/api/owner/route";
import { resourceMetadata } from "../src/lib/auth/discovery";
const env={...process.env};
beforeEach(()=>{process.env.AUTH_SITE_URL="https://mcp.example.com";process.env.CONVEX_AUTH_SITE_URL="https://test-auth.convex.site";});
afterEach(()=>{process.env={...env};vi.restoreAllMocks();});
it("returns discoverable auth challenge and rejects old bearer before tool execution",async()=>{
  process.env.MCP_ACCESS_TOKEN="a".repeat(48);
  const fetchMock=vi.spyOn(globalThis,"fetch").mockResolvedValue(Response.json({error:"UNAUTHORIZED"},{status:401}));
  const denied=await mcpPost(new Request("https://mcp.example.com/api/mcp",{method:"POST",headers:{authorization:"Bearer "+"a".repeat(48)}}));
  expect(denied.status).toBe(401);
  expect(denied.headers.get("www-authenticate")).toContain("/.well-known/oauth-protected-resource/api/mcp");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const metadata=await resourceMetadata().json();
  expect(metadata.resource).toBe("https://mcp.example.com/api/mcp");
});
it("official MCP client initializes and discovers all nine tools through the real route",async()=>{
  const originalFetch=globalThis.fetch;
  vi.spyOn(globalThis,"fetch").mockImplementation(async(input,options)=>{
    const url=String(input);
    if(url==="https://test-auth.convex.site/api/mcp/check")return Response.json({subject:"owner",clientId:"client",scopes:["mcp:read"]});
    return originalFetch(input,options);
  });
  const client=new Client({name:"qa-client",version:"1"});
  const transport=new StreamableHTTPClientTransport(new URL("https://mcp.example.com/api/mcp"),{
    requestInit:{headers:{authorization:"Bearer fake-oauth-token"}},
    fetch:async(input,init)=>{const request=new Request(input,init);request.headers.set("host",new URL(request.url).host);return mcpPost(request);},
  });
  await client.connect(transport);
  expect((await client.listTools()).tools).toHaveLength(9);
  const result=await client.callTool({name:"documents_list",arguments:{project:"test",environment:"production",table:"users"}});
  expect(result.isError).toBe(true);
  await client.close();
});
it("owner API ignores bearer and demands a verified allowed session",async()=>{
  vi.spyOn(globalThis,"fetch").mockResolvedValue(Response.json(null));
  expect((await ownerGet(new Request("https://mcp.example.com/api/owner",{headers:{authorization:"Bearer "+"a".repeat(48)}}))).status).toBe(401);
  expect((await ownerPost(new Request("https://mcp.example.com/api/owner",{method:"POST",headers:{origin:"https://evil.example.com"}}))).status).toBe(403);
});
