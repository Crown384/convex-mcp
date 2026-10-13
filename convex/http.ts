import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { createAuth } from "./auth";
import { authorizeMcp } from "../src/lib/auth/authorize";
import { noStoreHeaders } from "../src/lib/http-headers";

const http=httpRouter();
const authHandler=httpAction(async (ctx,request) => {
  try {
    const response=await createAuth(ctx).handler(request);
    const headers=new Headers(response.headers);
    for(const [key,value] of Object.entries(noStoreHeaders)) headers.set(key,value);
    return new Response(response.body,{status:response.status,headers});
  } catch {
    return Response.json({error:"AUTH_UNAVAILABLE"},{status:503,headers:noStoreHeaders});
  }
});
http.route({pathPrefix:"/api/auth/",method:"GET",handler:authHandler});
http.route({pathPrefix:"/api/auth/",method:"POST",handler:authHandler});
http.route({path:"/api/mcp/check",method:"POST",handler:httpAction(async (ctx,request) => {
  try {
    const principal=await authorizeMcp(createAuth(ctx),request.headers.get("authorization"));
    return Response.json(principal,{headers:noStoreHeaders});
  } catch {
    return Response.json({error:"UNAUTHORIZED"},{status:401,headers:noStoreHeaders});
  }
})});
export default http;
