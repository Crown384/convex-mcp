import { test,expect } from "@playwright/test";
import { createHash } from "node:crypto";
test("email-code login, session dashboard, and logout on phone viewport",async({page,request})=>{
  await page.route("**/api/owner",route=>route.fulfill({json:{projects:[]}}));
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill("owner@example.com");
  await page.getByRole("button",{name:"Send code",exact:true}).click();
  await expect(page.getByLabel("Sign-in code")).toBeFocused();
  const fixture=await (await request.get("http://127.0.0.1:3198/__qa/code")).json();
  await page.getByLabel("Sign-in code").fill(fixture.code);
  await page.getByRole("button",{name:"Verify code",exact:true}).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading",{name:"Managed projects"})).toBeVisible();
  await page.getByRole("button",{name:"Sign out",exact:true}).click();
  await expect(page).toHaveURL(/\/sign-in/);
});
test("ChatGPT OAuth login continues to consent and registered callback",async({page,request})=>{
  const registered=await request.post("/api/auth/oauth2/register",{data:{
    client_name:"QA MCP",redirect_uris:["https://chatgpt.com/connector_platform/oauth/callback"],
    token_endpoint_auth_method:"none",scope:"mcp:read offline_access"
  }});
  expect(registered.ok()).toBeTruthy();
  const client=await registered.json();
  const verifier="v".repeat(64);
  const query=new URLSearchParams({client_id:client.client_id,redirect_uri:client.redirect_uris[0],response_type:"code",
    scope:"mcp:read offline_access",resource:"http://127.0.0.1:3199/api/mcp",state:"browser-state",
    code_challenge:createHash("sha256").update(verifier).digest("base64url"),code_challenge_method:"S256"});
  await page.route("https://chatgpt.com/connector_platform/oauth/callback**",route=>route.fulfill({contentType:"text/html",body:"<p>Connected</p>"}));
  await page.goto("/api/auth/oauth2/authorize?"+query);
  await expect(page).toHaveURL(/\/sign-in\?/);
  await page.getByLabel("Email address").fill("owner@example.com");
  await page.getByRole("button",{name:"Send code",exact:true}).click();
  const fixture=await (await request.get("http://127.0.0.1:3198/__qa/code")).json();
  await page.getByLabel("Sign-in code").fill(fixture.code);
  await page.getByRole("button",{name:"Verify code",exact:true}).click();
  await expect(page).toHaveURL(/\/consent\?/);
  await expect(page.getByRole("heading",{name:"Connect QA MCP"})).toBeVisible();
  await page.getByRole("button",{name:"Allow access",exact:true}).click();
  await expect(page).toHaveURL(/chatgpt.com\/connector_platform\/oauth\/callback/);
  const callback=new URL(page.url());
  expect(callback.searchParams.get("state")).toBe("browser-state");
  expect(callback.searchParams.get("code")).toBeTruthy();
});
