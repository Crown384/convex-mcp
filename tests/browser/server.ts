import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { betterAuth } from "better-auth/minimal";
import { memoryAdapter } from "better-auth/adapters/memory";
import { getAuthTables } from "better-auth/db";
import { authOptions } from "../../src/lib/auth/options";
import { authorizeMcp } from "../../src/lib/auth/authorize";
process.env={...process.env,NODE_ENV:"development"};
process.env.AUTH_SITE_URL="http://127.0.0.1:3199";
process.env.CONVEX_AUTH_SITE_URL="http://127.0.0.1:3198";
process.env.AUTH_ALLOWED_EMAILS="owner@example.com";
process.env.BETTER_AUTH_SECRET="browser-fixture-only-not-a-real-runtime-secret";
let lastCode="";
const options=authOptions(async (_email,otp)=>{lastCode=otp;});
const db:Record<string,object[]>=Object.fromEntries(Object.keys(getAuthTables(options)).map(key=>[key,[]]));
const auth=betterAuth({...options,database:memoryAdapter(db)});
const backend=createServer(async(req,res)=>{
  try {
    const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
    const request=new Request("http://127.0.0.1:3198"+req.url,{
      method:req.method,headers:req.headers as Record<string,string>,
      ...(req.method==="POST"?{body:Buffer.concat(chunks)}:{}),
    });
    const response=req.url==="/__qa/code"?Response.json({code:lastCode}):req.url==="/api/mcp/check"
      ?Response.json(await authorizeMcp(auth,request.headers.get("authorization")))
      :await auth.handler(request);
    res.statusCode=response.status;
    response.headers.forEach((value,key)=>{if(key!=="set-cookie")res.setHeader(key,value);});
    res.setHeader("set-cookie",response.headers.getSetCookie());
    res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.statusCode=401;res.end('{"error":"UNAUTHORIZED"}');}
});
backend.listen(3198,"127.0.0.1");
const web=spawn("corepack",["pnpm","exec","next","dev","--hostname","127.0.0.1","--port","3199"],{stdio:"inherit",env:process.env});
function stop(){web.kill("SIGTERM");backend.close();process.exit(0);}
process.on("SIGINT",stop);process.on("SIGTERM",stop);
web.on("exit",code=>{backend.close();process.exit(code??1);});
