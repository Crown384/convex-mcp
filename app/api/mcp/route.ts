import { NextRequest, NextResponse } from "next/server";
import { validOwnerToken, unauthorized, noStoreHeaders } from "@/src/lib/secure-access";
import { dispatchMcp } from "@/src/lib/mcp-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BYTES = 32_768;

export async function POST(request: NextRequest) {
  if (!validOwnerToken(request.headers.get("authorization"))) return unauthorized();
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return NextResponse.json({ error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415, headers: noStoreHeaders });
  try {
    if (Number(request.headers.get("content-length")) > MAX_BYTES) throw new Error("size");
    const source = await request.text();
    if (Buffer.byteLength(source, "utf8") > MAX_BYTES) throw new Error("size");
    const result = await dispatchMcp(JSON.parse(source));
    if (result.status === 202) return new Response(null, { status: 202, headers: noStoreHeaders });
    return NextResponse.json(result.body, { status: result.status, headers: noStoreHeaders });
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error or request too large" } },
      { status: 400, headers: noStoreHeaders });
  }
}

export function GET(request: NextRequest) {
  if (!validOwnerToken(request.headers.get("authorization"))) return unauthorized();
  return new Response(null, { status: 405, headers: { ...noStoreHeaders, Allow: "POST" } });
}
