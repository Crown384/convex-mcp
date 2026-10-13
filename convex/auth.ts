import { betterAuth } from "better-auth/minimal";
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import type { DataModel } from "./_generated/dataModel";
import { components } from "./_generated/api";
import schema from "./betterAuth/schema";
import { authOptions } from "../src/lib/auth/options";
export const authComponent=createClient<DataModel,typeof schema>(components.betterAuth,{local:{schema}});
export function createAuthOptions(ctx:GenericCtx<DataModel>) {
  return { ...authOptions(), database:authComponent.adapter(ctx) };
}
export function createAuth(ctx:GenericCtx<DataModel>) {
  return betterAuth(createAuthOptions(ctx));
}
