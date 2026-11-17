# Personal DNA and acting coach

## Entry and behavior

- Sidebar Personal DNA opens `/chat`; `/personal-dna` is another route to inspect directly. With a disposable authenticated user, start/resume a session, send synthetic text, wait for the response, navigate away and return. Check empty/loading/error states and that the right session and messages reappear. The tracker uses localStorage as well as Firestore; test reload and a fresh browser context separately.
- `/dna-vault` presents extracted material and links to `/chat`; compare empty and populated states. Do not assume a chat response immediately guarantees an extraction or synthesized profile.
- `/acting-coach` has new sessions, history, quick prompts, messages and loading states. Test a synthetic prompt, reopening a session and the linked audition entry when affected. Economy gating applies on the proxy's matched route; verify business access with an actual test entitlement. AI output varies: check a usable response and associated session, not fixed wording.
- Audio input and transcription require browser permissions and a suitable test backend. Exercise permission denial and capture separately from text chat; do not send real personal recordings.

## Boundaries and checks

DNA: `app/chat/page.tsx`, `hooks/use-chat.ts`, `app/api/dna/` and `users/{userPath}/dnaSessions/{sessionId}/messages`; tracker state also uses localStorage. Coach: `app/(interior)/acting-coach/page.tsx`, `hooks/use-acting-coach.ts`, `app/api/coach/chat/route.ts`, `lib/acting-coach/` and `coachSessions/{sessionId}/messages`. Model calls and Firestore are external boundaries. Check relevant tests including `hooks/use-acting-coach.test.tsx`, `app/(interior)/acting-coach/page.test.tsx`, `app/api/coach/chat/route.test.ts`, `components/chat-input.test.tsx`, `components/chat-messages.test.tsx`, and `lib/acting-coach/` tests. These do not establish end-to-end provider availability.
