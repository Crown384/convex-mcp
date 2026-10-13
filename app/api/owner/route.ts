import { getDeploymentStatus, listProjects, SafeError } from "@/src/lib/pama-env";
import { noStoreHeaders } from "@/src/lib/http-headers";
import { ownerSession, sameOrigin, boundedBody } from "@/src/lib/auth/proxy";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function fail(error:unknown) {
  const code=error instanceof SafeError?error.code:"UPSTREAM_FAILURE";
  return Response.json({error:code},{status:502,headers:noStoreHeaders});
}
export async function GET(request:Request) {
  try {await ownerSession(request);}catch{return Response.json({error:"UNAUTHORIZED"},{status:401,headers:noStoreHeaders});}
  try{return Response.json({projects:await listProjects()},{headers:noStoreHeaders});}catch(error){return fail(error);}
}
export async function POST(request:Request) {
  try {if(!sameOrigin(request))return Response.json({error:"FORBIDDEN"},{status:403,headers:noStoreHeaders});await ownerSession(request);}
  catch{return Response.json({error:"UNAUTHORIZED"},{status:401,headers:noStoreHeaders});}
  try {
    const body:unknown=JSON.parse(await boundedBody(request,2048));
    if(!body || typeof body!=="object" || Array.isArray(body) ||
       !("project" in body) || !("environment" in body) ||
       Object.keys(body).some(key=>key!=="project" && key!=="environment"))
      return Response.json({error:"INVALID_ARGUMENTS"},{status:400,headers:noStoreHeaders});
    const data=body as {project:unknown;environment:unknown};
    return Response.json(await getDeploymentStatus(data.project,data.environment),{headers:noStoreHeaders});
  }catch(error){return fail(error);}
}
