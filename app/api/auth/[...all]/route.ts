import { proxyAuth } from "@/src/lib/auth/proxy";
export const dynamic="force-dynamic";
export const runtime="nodejs";
type Context={params:Promise<{all:string[]}>};
async function handle(request:Request,context:Context) {
  const {all}=await context.params;
  return proxyAuth(request,all.join("/"));
}
export {handle as GET,handle as POST};
