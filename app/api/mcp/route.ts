import { mcpPrincipal } from "@/src/lib/auth/proxy";
import { mcpChallenge } from "@/src/lib/auth/discovery";
import { serveMcp } from "@/src/lib/mcp-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function handle(request:Request) {
  try {await mcpPrincipal(request);}catch{return mcpChallenge();}
  return serveMcp(request);
}
export {handle as POST,handle as GET,handle as DELETE};
