import { NextRequest, NextResponse } from "next/server";
import { getDeploymentStatus, listProjects, SafeError } from "@/src/lib/pama-env";
import { noStoreHeaders, unauthorized, validOwnerToken } from "@/src/lib/secure-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function fail(error: unknown) {
  const code = error instanceof SafeError ? error.code : "UPSTREAM_FAILURE";
  return NextResponse.json({ error: code }, { status: 502, headers: noStoreHeaders });
}
export async function GET(request: NextRequest) {
  if (!validOwnerToken(request.headers.get("authorization"))) return unauthorized();
  try { return NextResponse.json({ projects: await listProjects() }, { headers: noStoreHeaders }); }
  catch (error) { return fail(error); }
}
export async function POST(request: NextRequest) {
  if (!validOwnerToken(request.headers.get("authorization"))) return unauthorized();
  try {
    if (Number(request.headers.get("content-length")) > 2048) return NextResponse.json({ error: "INVALID_ARGUMENTS" }, { status: 400, headers: noStoreHeaders });
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        !("project" in body) || !("environment" in body) ||
        Object.keys(body).some(k => k !== "project" && k !== "environment"))
      return NextResponse.json({ error: "INVALID_ARGUMENTS" }, { status: 400, headers: noStoreHeaders });
    const data = body as { project: unknown; environment: unknown };
    return NextResponse.json(await getDeploymentStatus(data.project, data.environment), { headers: noStoreHeaders });
  } catch (error) { return fail(error); }
}
