import type { BetterAuthOptions } from "better-auth/minimal";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { emailOTP, jwt } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import { authIssuer, mcpResource, MCP_SCOPE, ownerEmail, siteOrigin } from "./settings";
import { sendSignInCode } from "./mailjet";

export function authOptions(deliver = sendSignInCode) {
  const origin = siteOrigin();
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_NOT_CONFIGURED");
  return {
    appName: "Pama Convex MCP", baseURL: origin, basePath: "/api/auth", secret,
    trustedOrigins: [origin],
    user: { additionalFields: { userId: { type: "string", required: false, input: false } } },
    logger: { disabled: true },
    emailAndPassword: { enabled: false },
    session: { expiresIn: 6 * 60 * 60, updateAge: 60 * 60, cookieCache: { enabled: false } },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 60,
      customRules: {
        "/email-otp/send-verification-otp": { window: 60, max: 3 },
        "/sign-in/email-otp": { window: 60, max: 5 },
        "/oauth2/register": { window: 60, max: 5 },
      },
    },
    disabledPaths: ["/sign-up/email", "/sign-in/email", "/change-email", "/update-user", "/delete-user", "/token", "/sign-jwt", "/verify-jwt"],
    hooks: { before: createAuthMiddleware(async ctx => {
      if (ctx.path === "/email-otp/send-verification-otp" || ctx.path === "/sign-in/email-otp") {
        if (!ownerEmail(ctx.body?.email) || (ctx.path === "/email-otp/send-verification-otp" && ctx.body?.type !== "sign-in"))
          throw new APIError("FORBIDDEN", { message: "Access unavailable" });
      }
    }) },
    databaseHooks: {
      user: { create: { before: async user => {
        if (!ownerEmail(user.email)) throw new APIError("FORBIDDEN", { message: "Access unavailable" });
      } },
      },
    },
    plugins: [
      emailOTP({ otpLength: 6, expiresIn: 300, allowedAttempts: 3, storeOTP: "hashed",
        async sendVerificationOTP({email, otp, type}) {
          if (type !== "sign-in" || !ownerEmail(email)) throw new APIError("FORBIDDEN", { message: "Access unavailable" });
          try { await deliver(email, otp); } catch { throw new APIError("BAD_GATEWAY", { message: "Unable to send your code" }); }
        },
      }),
      jwt({ jwt: { issuer: authIssuer(), audience: mcpResource(), expirationTime: "5m" },
        jwks: { keyPairConfig: { alg: "RS256" } },
      }),
      oauthProvider({
        loginPage: "/sign-in", consentPage: "/consent",
        scopes: [MCP_SCOPE, "offline_access"], validAudiences: [mcpResource()],
        grantTypes: ["authorization_code", "refresh_token"],
        accessTokenExpiresIn: 300, refreshTokenExpiresIn: 7 * 24 * 60 * 60, codeExpiresIn: 60,
        allowDynamicClientRegistration: true, allowUnauthenticatedClientRegistration: true,
        clientRegistrationDefaultScopes: [MCP_SCOPE],
        clientRegistrationAllowedScopes: [MCP_SCOPE, "offline_access"],
        clientPrivileges: async ({user}) => Boolean(user && ownerEmail(user.email)),
      }),
    ],
  } satisfies BetterAuthOptions;
}
