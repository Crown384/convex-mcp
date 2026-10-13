/* eslint-disable */
import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
import type { ComponentApi } from "@convex-dev/better-auth/_generated/component.js";
import type * as security from "../security.js";
declare const fullApi: ApiFromModules<{ security: typeof security }>;
export declare const components: { betterAuth: ComponentApi };
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;
