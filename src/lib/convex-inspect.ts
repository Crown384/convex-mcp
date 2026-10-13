/**
 * Authenticated read-only metadata inspection. Convex's own CLI implements
 * _system/frontend/getSchemas and _system/cli/modules:apiSpec as queries.
 * No mutation, action, arbitrary function path, or PII inspection here.
 */
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { withDeploymentCredential, convexGet, SafeError, boundedJson } from "./pama-env";

const getSchemas = makeFunctionReference<"query">("_system/frontend/getSchemas");
const getFunctions = makeFunctionReference<"query">("_system/cli/modules:apiSpec");
const validName = (name: unknown): name is string =>
  typeof name === "string" && /^[A-Za-z_][\w./:-]{0,199}$/.test(name);

function admin(url: URL, key: string): ConvexHttpClient {
  // Pin SDK traffic to the exact known read-only query route. Fetch a bounded
  // response, with timeout and redirects disabled, before the SDK can parse it.
  const readOnlyFetch: typeof globalThis.fetch = async (resource, init) => {
    const target = resource instanceof URL ? resource.href
      : typeof resource === "string" ? resource : resource.url;
    if (target !== url.origin + "/api/query" || init?.method !== "POST")
      throw new SafeError("CAPABILITY_UNAVAILABLE");
    const response = await globalThis.fetch(resource, {
      ...init, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new SafeError("CAPABILITY_UNAVAILABLE");
    return Response.json(await boundedJson(response, 256_000));
  };
  const client = new ConvexHttpClient(url.origin, { logger: false, fetch: readOnlyFetch });
  // This internal API is used by Convex CLI; its runtime method predates public typings.
  (client as unknown as { setAdminAuth(value: string): void }).setAdminAuth(key);
  return client;
}

export async function listTables(project: unknown, environment: unknown) {
  return withDeploymentCredential(project, environment, async (url, key) => {
    try {
      const reply: unknown = await admin(url, key).query(getSchemas, {});
      if (!reply || typeof reply !== "object" || !("active" in reply))
        throw new SafeError("CAPABILITY_UNAVAILABLE");
      const active = (reply as {active: unknown}).active;
      let declared: unknown = null;
      if (typeof active === "string") declared = JSON.parse(active);
      if (active !== null && active !== undefined && typeof active !== "string")
        throw new SafeError("CAPABILITY_UNAVAILABLE");
      const schemas = declared && typeof declared === "object" && "tables" in declared
        ? (declared as {tables: unknown}).tables : [];
      if (!Array.isArray(schemas) || schemas.length > 500) throw new SafeError("CAPABILITY_UNAVAILABLE");
      const declaredNames = schemas.map((s: unknown) => {
        if (!s || typeof s !== "object" || !("tableName" in s) || !validName(s.tableName))
          throw new SafeError("CAPABILITY_UNAVAILABLE");
        return s.tableName as string;
      });
      // Convex's CLI uses /api/shapes2 to discover schema-less tables.
      const response = await fetch(url.origin + "/api/shapes2", {
        method: "GET", headers: {Authorization:"Convex " + key,Accept:"application/json"},
        redirect:"error",cache:"no-store",signal:AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new SafeError("CAPABILITY_UNAVAILABLE");
      const shapes: unknown = await boundedJson(response, 256_000);
      if (!shapes || typeof shapes !== "object" || Array.isArray(shapes) ||
          Object.keys(shapes).length > 500 || !Object.keys(shapes).every(validName))
        throw new SafeError("CAPABILITY_UNAVAILABLE");
      const names = [...new Set([...declaredNames,...Object.keys(shapes)])].sort();
      return {project,environment,tables:names.slice(0,50).map(name=>({
        name,hasDeclaredSchema:declaredNames.includes(name),
      })),truncated:names.length>50};
    } catch (e) {
      if (e instanceof SafeError) throw e;
      throw new SafeError("CAPABILITY_UNAVAILABLE");
    }
  });
}

export async function listFunctions(project: unknown, environment: unknown) {
  return withDeploymentCredential(project, environment, async (url, key) => {
    try {
      const raw: unknown = await admin(url, key).query(getFunctions, {});
      const entries: unknown = Array.isArray(raw) ? raw :
        raw && typeof raw === "object" && "functions" in raw ? raw.functions : null;
      if (!Array.isArray(entries) || entries.length > 500) throw new SafeError("CAPABILITY_UNAVAILABLE");
      const functions = entries.map((f: unknown) => {
        if (!f || typeof f !== "object") throw new SafeError("CAPABILITY_UNAVAILABLE");
        const row = f as Record<string,unknown>;
        const identifier = row.identifier ?? row.name ?? row.path;
        if (!validName(identifier)) throw new SafeError("CAPABILITY_UNAVAILABLE");
        const type = row.functionType ?? row.type;
        const visibility = row.visibility;
        return {identifier,type: typeof type==="string"?type.slice(0,30):"unknown",
          visibility:typeof visibility==="string"?visibility.slice(0,30):"unknown"};
      });
      return {project,environment,functions:functions.slice(0,50),truncated:functions.length>50};
    } catch (e) {
      if (e instanceof SafeError) throw e;
      throw new SafeError("CAPABILITY_UNAVAILABLE");
    }
  });
}

export async function listUsageLimits(project: unknown, environment: unknown) {
  return withDeploymentCredential(project, environment, async (url, key) => {
    const payload = await convexGet(url,key,"/api/v1/list_usage_limits");
    if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
        !("usageLimits" in payload) || !Array.isArray(payload.usageLimits) ||
        payload.usageLimits.length>100) throw new SafeError("CAPABILITY_UNAVAILABLE");
    const limits = payload.usageLimits.map((item:unknown)=>{
      if (!item || typeof item !== "object") throw new SafeError("CAPABILITY_UNAVAILABLE");
      const row = item as Record<string,unknown>;
      if (typeof row.metric !== "string" || !/^[A-Za-z0-9]{1,64}$/.test(row.metric) ||
          (row.window !== "day" && row.window !== "month") ||
          (row.limitType !== "warning" && row.limitType !== "disable") ||
          typeof row.limit !== "number" || !Number.isSafeInteger(row.limit) ||
          typeof row.enabled !== "boolean") throw new SafeError("CAPABILITY_UNAVAILABLE");
      return {metric:row.metric,window:row.window,limitType:row.limitType,
        limit:row.limit,enabled:row.enabled};
    });
    return {project,environment,limits:limits.slice(0,50),truncated:limits.length>50};
  });
}
