/**
 * PamaENV is the source of registered projects AND deployment secrets.
 * Never expose values returned by the machine endpoint to the UI or MCP client.
 * Its machine token is a separate server-only credential.
 */
export type Environment = "staging" | "production";
export type Project = { slug: string; name: string; environments: Environment[] };
export type Deployment = { project: string; environment: Environment };
export class SafeError extends Error {
  constructor(public readonly code: string) { super(code); this.name = "SafeError"; }
}

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
type SecretKey = "CONVEX_URL" | "CONVEX_DEPLOY_KEY";

export function validSlug(value: unknown): value is string {
  return typeof value === "string" && value.length <= 64 && slugPattern.test(value);
}
export function validEnvironment(value: unknown): value is Environment {
  return value === "staging" || value === "production";
}

function envStoreOrigin(): string {
  const raw = process.env.PAMA_ENV_STORE_URL;
  if (!raw) throw new SafeError("NOT_CONFIGURED");
  let u: URL;
  try { u = new URL(raw); } catch { throw new SafeError("NOT_CONFIGURED"); }
  if (u.protocol !== "https:" || !u.hostname || u.username || u.password ||
      u.port || u.search || u.hash || u.pathname !== "/" || u.hostname === "localhost" ||
      !/^[a-z0-9.-]+$/.test(u.hostname) ||
      /(^|\.)(local|internal)$/.test(u.hostname) ||
      /^[0-9.]+$/.test(u.hostname)) throw new SafeError("NOT_CONFIGURED");
  return u.origin;
}

function machineToken(): string {
  const token = process.env.PAMA_ENV_MACHINE_TOKEN;
  if (!token || !/^pes_[A-Za-z0-9_-]{32,}$/.test(token)) throw new SafeError("NOT_CONFIGURED");
  return token;
}

/** Limits upstream body size even if content-length is missing or forged. */
export async function boundedJson(response: Response, maxBytes = 64_000): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new SafeError("UPSTREAM_FAILURE");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 64_000) throw new SafeError("UPSTREAM_FAILURE");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(length);
  let position = 0;
  for (const chunk of chunks) { bytes.set(chunk, position); position += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new SafeError("UPSTREAM_FAILURE"); }
}

export async function machineGet(path: string): Promise<unknown> {
  const origin = envStoreOrigin();
  const token = machineToken();
  try {
    const response = await fetch(origin + path, {
      method: "GET",
      headers: { Authorization: "Bearer " + token, Accept: "application/json" },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    // Do not reflect opaque authentication/authorization failures or endpoint bodies.
    if (!response.ok) throw new SafeError(response.status === 404 || response.status === 401 ? "ACCESS_DENIED" : "UPSTREAM_FAILURE");
    return await boundedJson(response);
  } catch (error) {
    if (error instanceof SafeError) throw error;
    throw new SafeError("UPSTREAM_FAILURE");
  }
}

export async function listProjects(): Promise<Project[]> {
  const payload = await machineGet("/api/projects");
  if (!payload || typeof payload !== "object" || !("projects" in payload) ||
      !Array.isArray(payload.projects) || payload.projects.length > 100) throw new SafeError("UPSTREAM_FAILURE");
  const projects: Project[] = [];
  for (const row of payload.projects) {
    if (!row || typeof row !== "object" || !validSlug(row.slug) ||
        typeof row.name !== "string" || row.name.length > 100 ||
        !Array.isArray(row.environments) || !row.environments.every(validEnvironment)) throw new SafeError("UPSTREAM_FAILURE");
    const environments: Environment[] = (row.environments as unknown[]).filter(validEnvironment);
    projects.push({ slug: row.slug, name: row.name, environments: [...new Set(environments)] });
  }
  return projects;
}

export async function findDeployment(project: unknown, environment: unknown): Promise<Deployment> {
  if (!validSlug(project) || !validEnvironment(environment)) throw new SafeError("INVALID_ARGUMENTS");
  const projects = await listProjects();
  const entry = projects.find((row) => row.slug === project && row.environments.includes(environment));
  if (!entry) throw new SafeError("DEPLOYMENT_NOT_FOUND");
  if (environment === "production" && process.env.MCP_ENABLE_PRODUCTION_READS !== "true") {
    throw new SafeError("PRODUCTION_DISABLED");
  }
  return { project, environment };
}

export async function machineVariable(deployment: Deployment, key: SecretKey): Promise<string> {
  const path = "/api/projects/" + deployment.project + "/env/" + deployment.environment + "/" + key;
  const payload = await machineGet(path);
  if (!payload || typeof payload !== "object" ||
      !("key" in payload) || payload.key !== key ||
      !("value" in payload) || typeof payload.value !== "string" || payload.value.length > 8192) {
    throw new SafeError("CREDENTIAL_UNAVAILABLE");
  }
  return payload.value;
}

export function validateConvexTarget(url: string, key: string, environment: Environment): URL {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new SafeError("CREDENTIAL_MISMATCH"); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password ||
      parsed.port || parsed.pathname !== "/" || parsed.search || parsed.hash ||
      !/^[a-z0-9-]+(?:\.(?:eu-west-1|ca-central-1|ap-southeast-2|us-east-1))?\.convex\.cloud$/.test(parsed.hostname)) throw new SafeError("CREDENTIAL_MISMATCH");
  const match = /^(dev|prod):([a-z0-9-]+)\|([^\s]{16,})$/.exec(key);
  if (!match || (environment === "production" && match[1] !== "prod") ||
      !parsed.hostname.startsWith(match[2] + ".")) throw new SafeError("CREDENTIAL_MISMATCH");
  return parsed;
}

export async function withDeploymentCredential<T>(
  project: unknown,
  environment: unknown,
  callback: (url: URL, key: string) => Promise<T>,
): Promise<T> {
  const deployment = await findDeployment(project, environment);
  // Revocation applies on every tool call: no persistent secret cache.
  const [url, key] = await Promise.all([
    machineVariable(deployment, "CONVEX_URL"),
    machineVariable(deployment, "CONVEX_DEPLOY_KEY"),
  ]);
  return callback(validateConvexTarget(url, key, deployment.environment), key);
}

/** Admin Deployment API, never the public user-authenticated Functions API. */
export async function convexGet(url: URL, key: string, path: string): Promise<unknown> {
  if (!["/api/v1/deployment_info", "/api/v1/list_environment_variables", "/api/v1/list_usage_limits"].includes(path))
    throw new SafeError("CAPABILITY_UNAVAILABLE");
  try {
    const response = await fetch(url.origin + path, {
      headers: { Authorization: "Convex " + key, Accept: "application/json" },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new SafeError(response.status === 401 || response.status === 403
      ? "CAPABILITY_UNAVAILABLE" : "UPSTREAM_FAILURE");
    return await boundedJson(response);
  } catch (error) {
    if (error instanceof SafeError) throw error;
    throw new SafeError("UPSTREAM_FAILURE");
  }
}

export async function getDeploymentStatus(project: unknown, environment: unknown) {
  return withDeploymentCredential(project, environment, async (url, key) => {
    const payload = await convexGet(url, key, "/api/v1/deployment_info");
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      throw new SafeError("UPSTREAM_FAILURE");
    return { project, environment, deployment: url.hostname.replace(".convex.cloud", ""), reachable: true, mode: "read-only" };
  });
}

export async function getEnvironmentNames(project: unknown, environment: unknown) {
  if (environment === "production") throw new SafeError("PRODUCTION_PII_DISABLED");
  return withDeploymentCredential(project, environment, async (url, key) => {
    const payload = await convexGet(url, key, "/api/v1/list_environment_variables");
    // The upstream response contains secret values. We extract names only.
    if (!Array.isArray(payload) || payload.length > 250) throw new SafeError("CAPABILITY_UNAVAILABLE");
    const names = payload.map((row: unknown) => {
      if (!row || typeof row !== "object" || !("name" in row) ||
          typeof row.name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(row.name))
        throw new SafeError("CAPABILITY_UNAVAILABLE");
      return row.name;
    });
    return { project, environment, names: [...new Set(names)].sort().slice(0, 50), truncated: names.length > 50 };
  });
}
