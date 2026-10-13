import { SafeError, validSlug } from "./pama-env";

const tablePattern = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const fieldPattern = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const banned = new Set(["__proto__", "prototype", "constructor"]);

export function allowedDocumentFields(project: unknown, table: unknown): string[] {
  if (!validSlug(project) || typeof table !== "string" || !tablePattern.test(table) || banned.has(table))
    throw new SafeError("INVALID_ARGUMENTS");
  const raw = process.env.MCP_DOCUMENT_READ_POLICY;
  if (!raw || raw.length > 16_384) throw new SafeError("DOCUMENT_ACCESS_DISABLED");
  let input: unknown;
  try { input = JSON.parse(raw); } catch { throw new SafeError("DOCUMENT_ACCESS_DISABLED"); }
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new SafeError("DOCUMENT_ACCESS_DISABLED");
  const policy = input as Record<string,unknown>;
  if (!Object.hasOwn(policy,project)) throw new SafeError("DOCUMENT_ACCESS_DENIED");
  const tables = policy[project];
  if (!tables || typeof tables !== "object" || Array.isArray(tables) ||
      !Object.hasOwn(tables,table)) throw new SafeError("DOCUMENT_ACCESS_DENIED");
  const fields = (tables as Record<string,unknown>)[table];
  if (!Array.isArray(fields) || fields.length===0 || fields.length>32 ||
      !fields.every(x=>typeof x==="string" && fieldPattern.test(x) && !banned.has(x)) ||
      new Set(fields).size !== fields.length) throw new SafeError("DOCUMENT_ACCESS_DISABLED");
  return fields as string[];
}
