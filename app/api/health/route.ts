import { NextResponse } from "next/server";

// This route reports build phase only. It does not claim Convex or MCP connectivity.
export function GET() {
  return NextResponse.json(
    { service: "pama-convex-mcp", phase: "foundation", mcpReady: false },
    { headers: { "Cache-Control": "no-store" } },
  );
}
