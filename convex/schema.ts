import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  authGuards: defineTable({
    key: v.string(),
    leaseToken: v.optional(v.string()),
    leaseUntil: v.number(),
    windowStart: v.number(),
    sends: v.number(),
    attempts: v.number(),
  }).index("by_key", ["key"]),
});
