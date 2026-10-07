## What

<!-- One or two sentences: what does this PR change and why. -->

## Checklist

- [ ] `pnpm verify` (lint, typecheck, test, build) passes locally
- [ ] Unit tests added/updated for the changed code
- [ ] No NetSuite access added outside `NetSuiteAdapter`
- [ ] No secrets, session tokens or real NetSuite data in code, fixtures or logs
- [ ] New/changed cross-context messages have a Zod schema in `protocol.ts`
- [ ] New user-facing strings go through `t()`, not hardcoded
- [ ] Updated `CHANGELOG.md` / PRD checklist if applicable

## Related issue

<!-- Closes #... -->
