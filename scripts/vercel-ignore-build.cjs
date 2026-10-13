"use strict";

// Vercel ignores a build when this script exits 0.
// Fail closed for preview, staging, unknown, and missing environment metadata.
function shouldSkipBuild({ VERCEL_ENV, VERCEL_GIT_COMMIT_REF }) {
  return !(VERCEL_ENV === "production" && VERCEL_GIT_COMMIT_REF === "main");
}

if (require.main === module) {
  process.exitCode = shouldSkipBuild(process.env) ? 0 : 1;
}

module.exports = { shouldSkipBuild };
