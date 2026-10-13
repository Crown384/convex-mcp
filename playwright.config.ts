import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir:"tests/browser",workers:1,
  use:{baseURL:"http://127.0.0.1:3199",viewport:{width:390,height:844},trace:"off"},
  webServer:{command:"corepack pnpm exec tsx tests/browser/server.ts",url:"http://127.0.0.1:3199/sign-in",reuseExistingServer:false,timeout:120000},
});
