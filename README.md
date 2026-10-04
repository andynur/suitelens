# Loupe for NetSuite — Starter Kit (Master Prompt + PRDs)

**Loupe for NetSuite** (`netsuite-loupe`) is a free, open-source, context-aware developer workbench
for NetSuite developers, admins and consultants, delivered as a Manifest V3 Chrome extension.

> **Naming convention**
> - Display name (Chrome Web Store, UI, website): **Loupe for NetSuite**
> - Technical slug (repo, npm packages, folders): **`netsuite-loupe`**
> - Avoid putting "NetSuite" first in the display name: it is an Oracle trademark, and names that
>   start with a third-party brand are more likely to be flagged during store review.
> - Before going public, check availability on the Chrome Web Store, GitHub, npm, domains and
>   trademark databases (USPTO, WIPO Global Brand Database).

This kit contains everything needed to start building the extension with a coding agent
(Claude Code, Codex, Cline, etc.).

## Contents

```
netsuite-loupe-kit/
├── README.md                     ← this file
├── 00-MASTER-PROMPT.md           ← paste into your coding agent to scaffold the project
├── CLAUDE.md                     ← repository rules for agents (copy to repo root)
├── docs/
│   ├── architecture.md           ← technical architecture and design decisions
│   ├── security-privacy.md       ← security, privacy and Chrome Web Store compliance
│   └── glossary.md               ← NetSuite and technical terms
├── prd/
│   ├── PRD-00-overview.md        ← vision, personas, principles, business model, metrics
│   ├── PRD-01-v0.1-mvp-foundation.md
│   ├── PRD-02-v0.2-suiteql-console.md
│   ├── PRD-03-v0.3-dev-toolbox.md
│   ├── PRD-04-v0.4-impact-analysis.md
│   ├── PRD-05-v0.5-ai-assist.md
│   ├── PRD-06-v1.0-public-launch-mcp.md
│   ├── PRD-07-v1.1-pro-health-docs.md
│   ├── PRD-08-v1.2-pro-envdiff-cutover.md
│   ├── PRD-09-v1.3-team-partner.md
│   └── PRD-10-backlog-ideas.md   ← future ideas with scoring
└── prompts/
    └── phase-prompts.md          ← ready-to-use prompts per version/phase
```

## How to use

1. Create an empty repository named `netsuite-loupe`, then copy `CLAUDE.md`, `docs/` and `prd/` into it.
2. Open your coding agent at the repo root and paste the contents of **`00-MASTER-PROMPT.md`**.
   The agent reads the PRDs and scaffolds v0.1.
3. When v0.1 is done, use the prompts in **`prompts/phase-prompts.md`** for each following phase, one at a time.
4. Keep the PRDs updated when decisions change. The PRDs, not the chat history, are the source of truth.

## Roadmap at a glance

| Version | Theme | Target window | Tier |
| --- | --- | --- | --- |
| v0.1 | MVP Foundation: context, Field Explorer, Automation Map, Environment Guard | Oct–Nov 2026 | Free |
| v0.2 | SuiteQL Console + metadata cache | Nov–Dec 2026 | Free |
| v0.3 | Dev Toolbox: Record Inspector, RESTlet Tester, Log Viewer | Dec 2026–Jan 2027 | Free |
| v0.4 | Impact Analysis ("where used") | Jan–Feb 2027 | Free (per object) |
| v0.5 | AI Assist (BYOK) + AI Context export | Feb–Mar 2027 | Free |
| v1.0 | Public launch + local MCP bridge | Mar 2027 | Free |
| v1.1 | Pro: Health Scan + Documentation Generator + licensing | Apr–Jun 2027 | Pro |
| v1.2 | Pro: Environment Diff + Cutover/SDF Builder | Jul–Aug 2027 | Pro |
| v1.3 | Team/Partner: sharing, branding, seat licensing | Sep 2027 | Team |

## Disclaimer

NetSuite, SuiteScript, SuiteQL, SuiteCloud and SuiteApp are trademarks of Oracle Corporation.
This project is not affiliated with, sponsored by or endorsed by Oracle.
