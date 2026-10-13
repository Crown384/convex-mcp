import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Send and verify share one transactional lease per owner. Never store the email or code.
// The lease outlives an HTTP action; cleanup is fenced against a stale action.
export const beginAuth = internalMutation({
  args: { key: v.string(), token: v.string(), kind: v.union(v.literal("send"), v.literal("verify"), v.literal("register")) },
  returns: v.boolean(),
  handler: async (ctx, { key, token, kind }) => {
    const now = Date.now();
    const row = await ctx.db.query("authGuards").withIndex("by_key", q => q.eq("key", key)).unique();
    if (row && row.leaseUntil > now) return false;
    const windowStart = row && now - row.windowStart < 60_000 ? row.windowStart : now;
    const sends = windowStart === row?.windowStart ? row.sends : 0;
    const attempts = row?.attempts ?? 0;
    if (kind === "verify" ? attempts >= 3 : sends >= (kind === "register" ? 5 : 3)) return false;
    const value = {
      key, leaseToken: token, leaseUntil: now + 35 * 60_000, windowStart,
      sends: sends + (kind === "verify" ? 0 : 1),
      attempts: attempts + (kind === "verify" ? 1 : 0),
    };
    if (row) await ctx.db.patch(row._id, value);
    else await ctx.db.insert("authGuards", value);
    return true;
  },
});
export const finishAuth = internalMutation({
  args: { key: v.string(), token: v.string(), resetAttempts: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { key, token, resetAttempts }) => {
    const row = await ctx.db.query("authGuards").withIndex("by_key", q => q.eq("key", key)).unique();
    if (row?.leaseToken === token) await ctx.db.patch(row._id, {
      leaseToken: undefined, leaseUntil: 0, ...(resetAttempts ? { attempts: 0 } : {}),
    });
    return null;
  },
});
