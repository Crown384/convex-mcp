import { noStoreHeaders } from "@/src/lib/http-headers";
export function GET() {
  const configured=Boolean(process.env.AUTH_SITE_URL&&process.env.CONVEX_AUTH_SITE_URL);
  return Response.json({service:"pama-convex-mcp",phase:"email-otp-oauth",
    authConfigured:configured,mcpReady:false,upstreamVerified:false},{headers:noStoreHeaders});
}
