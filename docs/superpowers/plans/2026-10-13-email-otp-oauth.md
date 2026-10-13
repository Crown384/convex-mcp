# Implementation plan
1. Commit regression tests for OTP, owner boundary, OAuth S256/consent/audience, logout/revoke and Mailjet redaction; observe missing-feature failures.
2. Implement shared validated configuration, Mailjet sender and Better Auth options; mount local Convex component and HTTP routes; generate the provider schema.
3. Replace owner and MCP authentication; add fixed-origin proxy, discovery routes, SDK transport and session/consent checks.
4. Add Tailwind sign-in, consent, dashboard logout/revoke. Document private setup, rollout and inherited read-only limits.
5. Run Daytona checks at exact source head; review complete PR against staging and post COMMENT report. Fix findings, run only affected checks, re-review, merge only when 5/5 supports staging.
All authored repository changes use GitHub API. Dependency/schema generation in Daytona is returned as content and committed through GitHub API. No production changes.
