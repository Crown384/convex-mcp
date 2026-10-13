import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { authOptions } from "../src/lib/auth/options";
import { getAuthTables } from "better-auth/db";
async function main() {
const require=createRequire(import.meta.url);
process.env.AUTH_SITE_URL ||= "http://localhost:3000";
process.env.BETTER_AUTH_SECRET ||= "schema-generation-only-no-runtime-credentials";
const root=dirname(require.resolve("@convex-dev/better-auth/package.json"));
const {createSchema}=await import(pathToFileURL(resolve(root,"dist/client/create-schema.js")).href);
const generated=await createSchema({file:"convex/betterAuth/schema.generated.ts",tables:getAuthTables(authOptions())});
process.stdout.write(JSON.stringify({path:generated.path,content:generated.code}));

}
void main();
