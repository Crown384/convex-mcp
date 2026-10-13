import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { createAuth } from "./auth";
import { AUTH_ENDPOINTS, ownerEmail } from "../src/lib/auth/settings";
import { sendSignInCode } from "../src/lib/auth/mailjet";
import { authorizeMcp } from "../src/lib/auth/authorize";
import { noStoreHeaders } from "../src/lib/http-headers";

const http = httpRouter();
const authHandler = httpAction(async (ctx, request) => {
  let guard: { key: string; token: string } | undefined;
  let resetAttempts = false;
  try {
    const rawPath = new URL(request.url).pathname;
    const path = rawPath.replace(/\/+$/, "");
    if (rawPath !== path || !AUTH_ENDPOINTS.has(path.slice("/api/auth/".length)))
      return Response.json({ error: "NOT_FOUND" }, { status: 404, headers: noStoreHeaders });
    const kind = request.method !== "POST" ? undefined
      : path === "/api/auth/email-otp/send-verification-otp" ? "send"
      : path === "/api/auth/sign-in/email-otp" ? "verify"
      : path === "/api/auth/oauth2/register" ? "register" : undefined;
    let email: string | undefined;
    if (kind) {
      const reader = request.clone().body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 16_384) {
            await reader.cancel();
            return Response.json({ error: "INVALID_REQUEST" }, { status: 413, headers: noStoreHeaders });
          }
          chunks.push(value);
        }
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      let body: Record<string, unknown>;
      try { body = JSON.parse(new TextDecoder().decode(bytes)); }
      catch { return Response.json({ error: "INVALID_REQUEST" }, { status: 400, headers: noStoreHeaders }); }
      if (!body || typeof body !== "object") return Response.json({ error: "INVALID_REQUEST" }, { status: 400, headers: noStoreHeaders });
      if (kind !== "register") {
        email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        if (!ownerEmail(email)) return Response.json({ error: "UNAUTHORIZED" }, { status: 403, headers: noStoreHeaders });
        if (kind === "send" && body.type !== "sign-in") return Response.json({ error: "INVALID_REQUEST" }, { status: 400, headers: noStoreHeaders });
        if (kind === "verify" && (typeof body.otp !== "string" || !/^\d{6}$/.test(body.otp)))
          return Response.json({ error: "INVALID_REQUEST" }, { status: 400, headers: noStoreHeaders });
      }
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(
        process.env.BETTER_AUTH_SECRET + ":" + (email ?? "public-client-registration")));
      guard = { key: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join(""), token: crypto.randomUUID() };
      if (!await ctx.runMutation(internal.security.beginAuth, { ...guard, kind })) {
        guard = undefined;
        return Response.json({ error: "RATE_LIMITED" }, { status: 429, headers: { ...noStoreHeaders, "Retry-After": "60" } });
      }
    }
    let deliveryFailed = false;
    const auth = createAuth(ctx, async (recipient, code) => {
      try { await sendSignInCode(recipient, code); }
      catch (error) { deliveryFailed = true; throw error; }
    });
    if (kind === "send") {
      const context = await auth.$context;
      await context.adapter.deleteMany({ model: "verification", where: [{ field: "identifier", value: "sign-in-otp-" + email }] });
    }
    const response = await auth.handler(request);
    // Better Auth awaits email delivery but deliberately swallows callback errors.
    // Surface provider failure safely and invalidate the undelivered challenge.
    if (kind === "send" && deliveryFailed) {
      const context = await auth.$context;
      await context.adapter.deleteMany({ model: "verification", where: [{ field: "identifier", value: "sign-in-otp-" + email }] });
      return Response.json({ error: "MAIL_DELIVERY_FAILED" }, { status: 503, headers: noStoreHeaders });
    }
    resetAttempts = kind === "send" && response.ok;
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(noStoreHeaders)) headers.set(key, value);
    return new Response(response.body, { status: response.status, headers });
  } catch {
    return Response.json({ error: "AUTH_UNAVAILABLE" }, { status: 503, headers: noStoreHeaders });
  } finally {
    if (guard) await ctx.runMutation(internal.security.finishAuth, { ...guard, resetAttempts });
  }
});
http.route({ pathPrefix: "/api/auth/", method: "GET", handler: authHandler });
http.route({ pathPrefix: "/api/auth/", method: "POST", handler: authHandler });
http.route({ path: "/api/mcp/check", method: "POST", handler: httpAction(async (ctx, request) => {
  try {
    const principal = await authorizeMcp(createAuth(ctx), request.headers.get("authorization"));
    return Response.json(principal, { headers: noStoreHeaders });
  } catch {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401, headers: noStoreHeaders });
  }
}) });
export default http;
