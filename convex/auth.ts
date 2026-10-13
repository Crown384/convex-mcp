import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import type { DataModel } from "./_generated/dataModel";
import { components } from "./_generated/api";
import schema from "./betterAuth/schema";
import { authOptions } from "../src/lib/auth/options";
import { sendSignInCode } from "../src/lib/auth/mailjet";
export const authComponent = createClient<DataModel, typeof schema>(components.betterAuth, { local: { schema } });
export function createAuthOptions(ctx: GenericCtx<DataModel>, deliver = sendSignInCode): BetterAuthOptions {
  const factory = authComponent.adapter(ctx);
  return { ...authOptions(deliver), database: (options: Parameters<typeof factory>[0]) => {
    const adapter = factory(options);
    const create: typeof adapter.create = async (input) => {
      // OAuth rotation uses a CAS predicate revoked=null. Convex distinguishes
      // an absent optional field from null, so persist that initial state explicitly.
      if (input.model === "oauthRefreshToken") {
        input = { ...input, data: { ...input.data, revoked: input.data.revoked ?? null } };
      }
      return adapter.create(input);
    };
    return { ...adapter, create };
  } };
}
export function createAuth(ctx: GenericCtx<DataModel>, deliver = sendSignInCode) {
  return betterAuth(createAuthOptions(ctx, deliver));
}
