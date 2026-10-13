import { defineSchema } from "convex/server";
import { tables } from "./schema.generated";

// Keep the generated validators separate from application-specific query indexes.
export default defineSchema({
  ...tables,
  oauthRefreshToken: tables.oauthRefreshToken.index("clientId_userId", ["clientId", "userId"]),
});
