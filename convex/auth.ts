import { betterAuth } from "better-auth/minimal";
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import type { DataModel } from "./_generated/dataModel";
import { components } from "./_generated/api";
import schema from "./betterAuth/schema";
import { authOptions } from "../src/lib/auth/options";
export const authComponent = createClient<DataModel, typeof schema>(components.betterAuth, { local: { schema } });
export function createAuthOptions(ctx: GenericCtx<DataModel>) {
  const factory = authComponent.adapter(ctx);
  return { ...authOptions(), database: (options: Parameters<typeof factory>[0]) => {
    const adapter = factory(options);
    return { ...adapter, create: async <T extends Record<string, unknown>>(input: Parameters<typeof adapter.create<T>>[0]) => {
      // OAuth rotation uses a CAS predicate revoked=null. Convex distinguishes
      // an absent optional field from null, so persist that initial state explicitly.
      if (input.model === "oauthRefreshToken") {
        input = { ...input, data: { ...input.data, revoked: input.data.revoked ?? null } };
      }
      return adapter.create<T>(input);
    } };
  } };
}
export function createAuth(ctx: GenericCtx<DataModel>) {
  return betterAuth(createAuthOptions(ctx));
}
