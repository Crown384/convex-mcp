import { createApi } from "@convex-dev/better-auth";
import schema from "./schema";
import { authOptions } from "../../src/lib/auth/options";
export const {create,findOne,findMany,updateOne,updateMany,deleteOne,deleteMany}
  =createApi(schema,()=>authOptions(undefined,{origin:"https://schema.invalid",secret:"schema-definition-only-not-a-runtime-auth-secret"}));
