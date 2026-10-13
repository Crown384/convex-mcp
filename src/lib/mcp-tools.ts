import { getDeploymentStatus, getEnvironmentNames, listProjects, SafeError, validEnvironment, validSlug } from "./pama-env";
import { listTables, listFunctions, listUsageLimits, listDocuments, recentLogMetadata } from "./convex-inspect";

export const toolDefinitions = [
  {
    name: "projects_list",
    description: "List only projects delegated to the configured PamaENV machine client. Never returns secrets.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "deployments_list",
    description: "List explicit staging/production environments registered for a project. Does not connect to Convex.",
    inputSchema: { type: "object", properties: { project: { type: "string" } }, required: ["project"], additionalProperties: false },
  },
  {
    name: "deployment_status",
    description: "Read-only connection test against the deployment's Convex admin API. Production must be explicitly enabled by the server owner.",
    inputSchema: { type: "object", properties: { project: { type: "string" }, environment: { type: "string", enum: ["staging", "production"] } }, required: ["project", "environment"], additionalProperties: false },
  },
  {
    name: "tables_list",
    description: "List Convex table names and declared-schema presence (no data or PII).",
    inputSchema: { type: "object", properties: { project: { type: "string" }, environment: { type: "string", enum: ["staging", "production"] } }, required: ["project", "environment"], additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "functions_list",
    description: "Read bounded metadata for deployed functions. Does not execute functions.",
    inputSchema: { type: "object", properties: { project: { type: "string" }, environment: { type: "string", enum: ["staging", "production"] } }, required: ["project", "environment"], additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "usage_limits_list",
    description: "Read existing usage-limit settings; never changes them.",
    inputSchema: { type: "object", properties: { project: { type: "string" }, environment: { type: "string", enum: ["staging", "production"] } }, required: ["project", "environment"], additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "documents_list",
    description: "Read a small page of staging-only Convex documents, projecting explicitly allowlisted fields for a specific project and table. Requires server document-access policy; disabled by default. No production documents or writes.",
    inputSchema: { type: "object", properties: {
      project: {type:"string"}, environment: {type:"string", enum:["staging"]},
      table: {type:"string"}, order:{type:"string",enum:["asc","desc"]},
      limit:{type:"integer",minimum:1,maximum:20}, cursor:{type:"string"}
    }, required:["project","environment","table"],additionalProperties:false },
    annotations: {readOnlyHint:true},
  },
  {
    name: "logs_recent",
    description: "Read recent staging-only Convex function-execution metadata, with failure filtering. Never returns raw logs, exception text, stack traces or argument values; production is denied.",
    inputSchema: { type:"object", properties: {
      project:{type:"string"},environment:{type:"string",enum:["staging"]},
      cursor:{type:"integer",minimum:0},limit:{type:"integer",minimum:1,maximum:30},
      status:{type:"string",enum:["all","success","failure"]},
    },required:["project","environment"],additionalProperties:false },
    annotations: {readOnlyHint:true},
  },
  {
    name: "environment_names_list",
    description: "Staging only. Return names (never values) of Convex environment variables if the scoped key grants access. Production is denied.",
    inputSchema: { type: "object", properties: { project: { type: "string" }, environment: { type: "string", enum: ["staging"] } }, required: ["project", "environment"], additionalProperties: false },
  },
] as const;

function exactArguments(input: unknown, keys: string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).some(k => !keys.includes(k))) throw new SafeError("INVALID_ARGUMENTS");
  return input as Record<string, unknown>;
}

export async function runTool(name: unknown, argumentsInput: unknown): Promise<unknown> {
  switch (name) {
    case "projects_list": {
      exactArguments(argumentsInput ?? {}, []);
      return { projects: await listProjects() };
    }
    case "deployments_list": {
      const args = exactArguments(argumentsInput, ["project"]);
      if (!validSlug(args.project)) throw new SafeError("INVALID_ARGUMENTS");
      const projects = await listProjects();
      const project = projects.find(p => p.slug === args.project);
      if (!project) throw new SafeError("DEPLOYMENT_NOT_FOUND");
      return { project: project.slug, deployments: project.environments.map(environment => ({
        environment, productionEnabled: environment !== "production" || process.env.MCP_ENABLE_PRODUCTION_READS === "true",
      })) };
    }
    case "deployment_status": {
      const args = exactArguments(argumentsInput, ["project", "environment"]);
      if (!validSlug(args.project) || !validEnvironment(args.environment)) throw new SafeError("INVALID_ARGUMENTS");
      return getDeploymentStatus(args.project, args.environment);
    }
    case "tables_list":
    case "functions_list":
    case "usage_limits_list": {
      const args = exactArguments(argumentsInput, ["project", "environment"]);
      if (!validSlug(args.project) || !validEnvironment(args.environment)) throw new SafeError("INVALID_ARGUMENTS");
      if (name === "tables_list") return listTables(args.project,args.environment);
      if (name === "functions_list") return listFunctions(args.project,args.environment);
      return listUsageLimits(args.project,args.environment);
    }
    case "documents_list": {
      const args = exactArguments(argumentsInput, ["project", "environment", "table", "order", "cursor", "limit"]);
      if (!validSlug(args.project) || args.environment !== "staging") throw new SafeError("DOCUMENT_PRODUCTION_DISABLED");
      return listDocuments(args.project,args.environment,args.table,{
        order:args.order,cursor:args.cursor,limit:args.limit,
      });
    }
    case "logs_recent": {
      const args = exactArguments(argumentsInput,["project","environment","cursor","limit","status"]);
      if (!validSlug(args.project) || args.environment!=="staging")
        throw new SafeError("LOG_PRODUCTION_DISABLED");
      return recentLogMetadata(args.project,args.environment,{
        cursor:args.cursor,limit:args.limit,status:args.status,
      });
    }
    case "environment_names_list": {
      const args = exactArguments(argumentsInput, ["project", "environment"]);
      if (!validSlug(args.project) || !validEnvironment(args.environment)) throw new SafeError("INVALID_ARGUMENTS");
      return getEnvironmentNames(args.project, args.environment);
    }
    default: throw new SafeError("UNKNOWN_TOOL");
  }
}

type RpcRequest = { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };
export async function dispatchMcp(input: unknown): Promise<{ status: number; body?: unknown }> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return { status: 400, body: { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } } };
  const request = input as RpcRequest;
  if (request.jsonrpc !== "2.0" || typeof request.method !== "string" ||
      (request.id !== undefined && (typeof request.id !== "string" && typeof request.id !== "number")))
    return { status: 400, body: { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } } };
  if (request.id === undefined) return { status: 202 };
  const id = request.id;
  if (request.method === "initialize") return { status: 200, body: { jsonrpc: "2.0", id, result: {
    protocolVersion: request.params && typeof request.params === "object" && !Array.isArray(request.params) &&
      "protocolVersion" in request.params && request.params.protocolVersion === "2025-11-25"
      ? "2025-11-25" : "2025-06-18", capabilities: { tools: { listChanged: false } },
    serverInfo: { name: "pama-convex-mcp", version: "0.2.0" },
    instructions: "Choose an explicit project and environment. All tools are read-only. Production is disabled unless the owner enables it.",
  } } };
  if (request.method === "ping") return { status: 200, body: { jsonrpc: "2.0", id, result: {} } };
  if (request.method === "tools/list") return { status: 200, body: { jsonrpc: "2.0", id, result: { tools: toolDefinitions } } };
  if (request.method === "tools/call") {
    const params = request.params;
    if (!params || typeof params !== "object" || Array.isArray(params) || !("name" in params))
      return { status: 200, body: { jsonrpc: "2.0", id, error: { code: -32602, message: "Invalid params" } } };
    try {
      const result = await runTool(params.name, "arguments" in params ? params.arguments : {});
      return { status: 200, body: { jsonrpc: "2.0", id, result: {
        content: [{ type: "text", text: JSON.stringify(result) }], isError: false,
      } } };
    } catch (error) {
      const code = error instanceof SafeError ? error.code : "INTERNAL_ERROR";
      return { status: 200, body: { jsonrpc: "2.0", id, result: {
        content: [{ type: "text", text: JSON.stringify({ error: code }) }], isError: true,
      } } };
    }
  }
  return { status: 200, body: { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } } };
}
