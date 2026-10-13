import { NextResponse } from "next/server";
import { noStoreHeaders } from "@/src/lib/secure-access";

export function GET() {
  // Configuration checks only, NOT proof of a working PamaENV/Convex connection.
  const configured = Boolean(
    process.env.MCP_ACCESS_TOKEN && process.env.MCP_ACCESS_TOKEN.length >= 32 &&
    process.env.PAMA_ENV_MACHINE_TOKEN?.startsWith("pes_") && process.env.PAMA_ENV_STORE_URL,
  );
  return NextResponse.json({ service: "pama-convex-mcp", phase: "read-only-mvp",
    mcpConfigured: configured, mcpReady: configured, upstreamVerified: false }, { headers: noStoreHeaders });
}
