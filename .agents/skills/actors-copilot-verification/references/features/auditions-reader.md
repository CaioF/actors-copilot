# Auditions and Reader Copilot

## Entry and behavior

- Sidebar Auditions opens `/auditions`; quick actions start `/auditions/new/brief` (Audition Breakdown) and `/auditions/new/sides` (Scene Study). Use synthetic casting text and PDF/DOCX fixtures. Check invalid input, back/next, generation, failure/retry and result. Save once and check the list and `/auditions/[id]` after reload.
- From a saved audition, attach the other analysis using `enrichAuditionId`; test both brief → sides and sides → brief. Confirm the existing analysis survives and the same audition is updated. Duplicate project/role handling offers an existing audition or creation; rapid save and retry should not create accidental duplicates.
- Detail links to Reader Copilot and acting coach. `/reader-copilot` can select an audition or parse a script; `/reader-copilot/[id]` loads a saved audition. Verify script parsing, role/line selection, rehearsal progression, exit and return. For audio, use synthetic media and a disposable context; check denied mic and unavailable TTS/transcription separately. Browser capture and playback cannot be proven by jsdom alone.

## Boundaries and checks

`components/auditions/audition-wizard.tsx`, `lib/auditions/audition-repository.ts`, `app/api/auditions/analyzeBrief/`, `app/api/auditions/analyzeSides/`, `app/(interior)/auditions/`, `app/(interior)/reader-copilot/`, `components/actor-copilot/` and `app/api/actor-copilot/` are entry points. Auditions persist beneath `users/{userPath}/auditions`. AI and media are external boundaries. Existing coverage includes `components/auditions/audition-wizard.test.tsx`, `components/auditions/scene-study-entry.test.tsx`, `__tests__/integration/audition-enrichment.test.tsx`, `__tests__/integration/audition-detail-page.test.tsx`, `lib/auditions/audition-repository.test.ts`, `lib/actor-copilot/script-parser.test.ts`, and `components/actor-copilot/actor-copilot-rehearsal.test.tsx`. Integration test names alone do not prove a browser/provider journey.
