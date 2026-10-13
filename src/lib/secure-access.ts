import { timingSafeEqual } from "node:crypto";

// Personal-use bootstrap credential. It is *not* a Convex deploy key.
// Replace with resource-scoped OAuth before supporting multiple MCP principals.
export function validOwnerToken(authorization: string | null, configured = process.env.MCP_ACCESS_TOKEN): boolean {
  if (!configured || configured.length < 32 || configured.length > 256 ||
      !/^[\x21-\x7e]+$/.test(configured)) return false;
  if (!authorization || !authorization.startsWith("Bearer ")) return false;
  const provided = authorization.slice(7);
  if (provided.length !== configured.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(configured));
}

export const noStoreHeaders = {
  "Cache-Control": "no-store, private, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export function unauthorized(): Response {
  return Response.json({ error: "UNAUTHORIZED" }, {
    status: 401,
    headers: { ...noStoreHeaders, "WWW-Authenticate": 'Bearer realm="pama-convex-mcp"' },
  });
}
