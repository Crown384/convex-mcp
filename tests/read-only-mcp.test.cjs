"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const ts = require("typescript");

// Read-only test loader transpiles repository TS through the installed TS compiler.
// Source files are never rewritten locally; this exercises the actual exported functions.
require.extensions[".ts"] = (module, filename) => {
  const input = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(input, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    esModuleInterop: true, moduleResolution: ts.ModuleResolutionKind.Node10,
  } }).outputText;
  module._compile(output, filename);
};
const lib = require("../src/lib/pama-env.ts");
const access = require("../src/lib/secure-access.ts");
const mcp = require("../src/lib/mcp-tools.ts");
const original = { ...process.env };
const originalFetch = global.fetch;
const token = "pes_" + "a".repeat(48);
function setup() {
  process.env.PAMA_ENV_MACHINE_TOKEN = token;
  process.env.PAMA_ENV_STORE_URL = "https://vault.example.com/";
  process.env.MCP_ACCESS_TOKEN = "m".repeat(48);
  delete process.env.MCP_ENABLE_PRODUCTION_READS;
}
function restore() { process.env = { ...original }; global.fetch = originalFetch; }
const json = value => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
const projects = { projects: [{ slug: "pamastore", name: "Pamastore", environments: ["staging", "production"] }] };
test.afterEach(restore);

test("credentials are not authorization and bearer token is timing-safe equality", () => {
  setup();
  assert.equal(access.validOwnerToken("Bearer " + "m".repeat(48)), true);
  assert.equal(access.validOwnerToken("Bearer " + "x".repeat(48)), false);
  assert.equal(access.validOwnerToken("Bearer " + "m".repeat(47)), false);
  assert.equal(access.validOwnerToken(null), false);
  assert.equal(access.validOwnerToken("Bearer " + "a".repeat(48), ""), false);
});

test("fail-closed when the machine secret is not configured", async () => {
  setup();
  delete process.env.PAMA_ENV_MACHINE_TOKEN;
  await assert.rejects(lib.listProjects(), { code: "NOT_CONFIGURED" });
});
test("regional Convex deployment hosts match exactly and spoofing is rejected",()=>{
  setup();
  const key="dev:happy-capybara-123|"+"a".repeat(32);
  for(const region of ["eu-west-1","ca-central-1","ap-southeast-2","us-east-1"]){
    const url="https://happy-capybara-123."+region+".convex.cloud";
    assert.equal(lib.validateConvexTarget(url,key,"staging").origin,url);
  }
  for(const url of ["https://other-happy-capybara-123.convex.cloud",
    "https://happy-capybara-123.evil.convex.cloud",
    "https://happy-capybara-123.eu-west-1.convex.cloud.evil.com"]){
    assert.throws(()=>lib.validateConvexTarget(url,key,"staging"),{code:"CREDENTIAL_MISMATCH"});
  }
});
test("URL cannot route deployment operations to attacker-controlled host", () => {
  setup();
  assert.equal(lib.validateConvexTarget("https://happy-capybara-123.convex.cloud", "dev:happy-capybara-123|" + "a".repeat(32), "staging").hostname, "happy-capybara-123.convex.cloud");
  for (const url of [
    "http://happy-capybara-123.convex.cloud/", "https://happy-capybara-123.convex.cloud.evil.com",
    "https://127.0.0.1/", "https://happy-capybara-123.convex.cloud/path",
    "https://happy-capybara-123.convex.cloud/?x=1",
  ]) assert.throws(() => lib.validateConvexTarget(url, "dev:happy-capybara-123|" + "a".repeat(32), "staging"), { code: "CREDENTIAL_MISMATCH" });
  assert.throws(() => lib.validateConvexTarget("https://another.convex.cloud/", "dev:happy-capybara-123|" + "a".repeat(32), "staging"), { code: "CREDENTIAL_MISMATCH" });
  assert.throws(() => lib.validateConvexTarget("https://happy-capybara-123.convex.cloud/", "dev:happy-capybara-123|" + "a".repeat(32), "production"), { code: "CREDENTIAL_MISMATCH" });
});
test("read-only MCP discovers delegated projects and never reveals secrets", async () => {
  setup();
  global.fetch = async (_url, options) => {
    assert.equal(options.headers.Authorization, "Bearer " + token);
    return json(projects);
  };
  assert.deepEqual(await mcp.runTool("projects_list", {}), projects);
  assert.deepEqual(await mcp.runTool("deployments_list", { project: "pamastore" }), {
    project: "pamastore", deployments: [
      { environment: "staging", productionEnabled: true },
      { environment: "production", productionEnabled: false },
    ],
  });
});
test("stale or revoked PamaENV machine token cannot access a deployment", async () => {
  setup();
  global.fetch = async () => new Response("Denied", { status: 404 });
  await assert.rejects(mcp.runTool("projects_list", {}), { code: "ACCESS_DENIED" });
});
test("production metadata is denied before any deploy key is fetched", async () => {
  setup();
  const requests = [];
  global.fetch = async url => { requests.push(String(url)); return json(projects); };
  await assert.rejects(mcp.runTool("deployment_status", { project: "pamastore", environment: "production" }), { code: "PRODUCTION_DISABLED" });
  assert.equal(requests.length, 1);
  assert.equal(requests[0], "https://vault.example.com/api/projects");
});
test("deployment API verifies host and never returns deploy key", async () => {
  setup();
  const key = "dev:happy-capybara-123|" + "x".repeat(32);
  const urls = [];
  global.fetch = async (url, options) => {
    urls.push(String(url));
    if (String(url).endsWith("/api/projects")) return json(projects);
    if (String(url).endsWith("/CONVEX_URL")) return json({ key: "CONVEX_URL", value: "https://happy-capybara-123.convex.cloud" });
    if (String(url).endsWith("/CONVEX_DEPLOY_KEY")) return json({ key: "CONVEX_DEPLOY_KEY", value: key });
    assert.equal(options.headers.Authorization, "Convex " + key);
    return json({ deploymentType: "dev" });
  };
  const result = await mcp.runTool("deployment_status", { project: "pamastore", environment: "staging" });
  assert.deepEqual(result, { project: "pamastore", environment: "staging", deployment: "happy-capybara-123", reachable: true, mode: "read-only" });
  assert.equal(JSON.stringify(result).includes(key), false);
  assert.equal(urls.length, 4);
});
test("environment names are strictly redacted and production names always denied", async () => {
  setup();
  const key = "dev:happy-capybara-123|" + "x".repeat(32);
  global.fetch = async (url) => {
    if (String(url).endsWith("/api/projects")) return json(projects);
    if (String(url).endsWith("/CONVEX_URL")) return json({ key: "CONVEX_URL", value: "https://happy-capybara-123.convex.cloud" });
    if (String(url).endsWith("/CONVEX_DEPLOY_KEY")) return json({ key: "CONVEX_DEPLOY_KEY", value: key });
    return json([{ name: "API_KEY", value: "do-not-expose" }, { name: "OTHER", value: "private" }]);
  };
  const result = await mcp.runTool("environment_names_list", { project: "pamastore", environment: "staging" });
  assert.deepEqual(result.names, ["API_KEY", "OTHER"]);
  assert.equal(JSON.stringify(result).includes("do-not-expose"), false);
  await assert.rejects(mcp.runTool("environment_names_list", { project: "pamastore", environment: "production" }), { code: "PRODUCTION_PII_DISABLED" });
});
test("MCP dispatch implements initialization, list, error hygiene, and notification acknowledgement", async () => {
  setup();
  const init = await mcp.dispatchMcp({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  assert.equal(init.body.result.protocolVersion, "2025-06-18");
  const list = await mcp.dispatchMcp({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  assert.equal(list.body.result.tools.length, 9);
  const denied = await mcp.dispatchMcp({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "unknown", arguments: {} } });
  assert.equal(denied.body.result.isError, true);
  assert.equal(denied.body.result.content[0].text, '{"error":"UNKNOWN_TOOL"}');
  const acknowledged = await mcp.dispatchMcp({ jsonrpc: "2.0", method: "notifications/initialized" });
  assert.equal(acknowledged.status, 202);
  assert.equal((await mcp.dispatchMcp([])).status, 400);
});
