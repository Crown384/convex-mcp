"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),ts=require("typescript");
require.extensions[".ts"]=(module,file)=>{
 const js=ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
  esModuleInterop:true,moduleResolution:ts.ModuleResolutionKind.Node10,
 }}).outputText;
 module._compile(js,file);
};
const inspect=require("../src/lib/convex-inspect.ts");
const original={...process.env},fetchOriginal=global.fetch;
const key="dev:happy-capybara-123|"+"a".repeat(32);
const json=v=>new Response(JSON.stringify(v),{headers:{"content-type":"application/json"}});
function setup(handler){
 process.env.PAMA_ENV_STORE_URL="https://vault.example.com/";
 process.env.PAMA_ENV_MACHINE_TOKEN="pes_"+"m".repeat(48);
 global.fetch=async(u,opts)=>{
  const url=String(u);
  if(url==="https://vault.example.com/api/projects")return json({projects:[{slug:"sample",name:"Sample",environments:["staging"]}]});
  if(url.endsWith("/CONVEX_URL"))return json({key:"CONVEX_URL",value:"https://happy-capybara-123.convex.cloud"});
  if(url.endsWith("/CONVEX_DEPLOY_KEY"))return json({key:"CONVEX_DEPLOY_KEY",value:key});
  assert.equal(opts.headers.Authorization,"Convex "+key);
  return handler(url,opts);
 };
}
test.afterEach(()=>{process.env={...original};global.fetch=fetchOriginal});
test("table discovery includes schema-less tables without exposing document shapes",async()=>{
 setup(url=>{
  if(url.endsWith("/api/query"))return json({status:"success",value:{active:JSON.stringify({tables:[{tableName:"orders"}]})}});
  if(url.endsWith("/api/shapes2"))return json({orders:{secret:"DO_NOT_SHOW"},drafts:{personal:"DO_NOT_SHOW"}});
  throw Error("Unexpected endpoint");
 });
 const output=await inspect.listTables("sample","staging");
 assert.deepEqual(output.tables,[{name:"drafts",hasDeclaredSchema:false},{name:"orders",hasDeclaredSchema:true}]);
 assert.equal(JSON.stringify(output).includes("DO_NOT_SHOW"),false);
});
test("usage-limit projection never returns unauthorized upstream fields",async()=>{
 setup(url=>{
  assert.ok(url.endsWith("/api/v1/list_usage_limits"));
  return json({usageLimits:[{id:"not-public",metric:"functionCalls",window:"month",limitType:"warning",limit:5000,enabled:true,secret:"hidden"}]});
 });
 const output=await inspect.listUsageLimits("sample","staging");
 assert.deepEqual(output.limits,[{metric:"functionCalls",window:"month",limitType:"warning",limit:5000,enabled:true}]);
 assert.equal(JSON.stringify(output).includes("hidden"),false);
});
test("Convex query authorization failure is not mistaken for an empty table list",async()=>{
 setup(url=>url.endsWith("/api/query")?new Response("No",{status:403}):json({}));
 await assert.rejects(inspect.listTables("sample","staging"),{code:"CAPABILITY_UNAVAILABLE"});
});

test("function metadata excludes arbitrary upstream fields and never executes functions",async()=>{
 setup(url=>{
  assert.ok(url.endsWith("/api/query"),"unexpected API call");
  return json({status:"success",value:[{identifier:"orders:list",functionType:"query",visibility:"public",
    source:"not-exposed",secret:"SENSITIVE"}, {identifier:"orders:approve",functionType:"mutation",visibility:"internal"}]});
 });
 const output=await inspect.listFunctions("sample","staging");
 assert.deepEqual(output.functions,[
  {identifier:"orders:list",type:"query",visibility:"public"},
  {identifier:"orders:approve",type:"mutation",visibility:"internal"}
 ]);
 assert.equal(JSON.stringify(output).includes("SENSITIVE"),false);
});
