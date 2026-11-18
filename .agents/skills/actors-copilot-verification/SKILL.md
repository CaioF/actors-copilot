---
name: actors-copilot-verification
description: Map and verify Actors Copilot app behavior, user journeys, regressions, and browser or automated test coverage. Use when exploring or testing this repository or updating its feature map; not for unrelated apps or deployment operations alone.
---

# Actors Copilot verification

Use the repository containing this skill as the application under test. Read its current `AGENTS.md`, inspect `git status --short --branch`, and identify the exact commit and environment before testing. The maps are a starting point, not a substitute for current code or observed behavior. They were mapped from main at `8ab8fe2afde8591b88c983ecbac0432e8933d249` on 2026-11-17; recheck affected paths when the code changes.

1. Pick the affected feature files in [feature map](references/features/README.md), plus [journeys](references/features/journeys.md) when crossing areas. Read the corresponding source and tests before drawing conclusions.
2. Define the user-visible outcome, affected roles/tiers, entry points, persistence and error paths. Choose focused Jest tests and the smallest useful browser journey. Read [verification](references/verification.md) and [Chrome and Puppeteer](references/browser-automation.md) for setup, executable commands, evidence and limitations.
3. Exercise the actual app where safe and feasible. Use semantic browser controls and wait for observable state. A mock proves only the boundary it replaces. Never claim an unrun journey passed; say exactly what was observed, mocked, skipped or blocked.
4. For a regression, compare the expected and actual user-visible outcome and record reproducible steps, environment, relevant failures and evidence without credentials or personal data. Fix only within the user's requested scope.
5. When features, routes or test setup change, update the relevant map and its evidence status in the same change. Verify links and commands. Prefer small, durable facts with source pointers over duplicating the implementation.

Billing access belongs to Stripe and its webhook, not manual Firestore writes. Use only explicitly authorized test identities and synthetic data for production exploration; account deletion, billing changes and external AI calls have distinct effects and require the appropriate scope. Follow the repository's release and production rules; a verification request does not itself authorize a merge.
