# Firebase App Check + Gemini TTS (Reader Copilot)

This document explains why the Reader Copilot voice was failing with
`500` responses coming from `/api/actor-copilot/tts`, what was changed in the
code, and which steps are still required in the Firebase console.

## 1. What was happening

Every voice line of the Reader Copilot is synthesized by
`POST /api/actor-copilot/tts`, which calls Gemini through **Firebase AI
Logic** (`firebase/ai` + `VertexAIBackend`).

Reproduced directly against the project (`actors-copilot-app`):

```
POST https://firebasevertexai.googleapis.com/v1beta/projects/actors-copilot-app/
     locations/global/publishers/google/models/gemini-2.5-flash-tts:generateContent

→ 403 PERMISSION_DENIED
   "To access this model, you must enforce Firebase App Check."
```

The same project, same API key and same endpoint answered `200 OK` for the text
models (`gemini-2.5-flash`, `gemini-3-flash-preview`), so the failure was
specific to the Gemini **TTS** models.

Two more problems were found while fixing this one:

| Problem | Impact |
| --- | --- |
| `"Orpheus"` is **not** a Gemini prebuilt voice (the real one is `Orus`) | Gemini answers `400 INVALID_ARGUMENT` for every character mapped to it, which the route turned into a `500` |
| The voice shown in the “Partner Voices” modal was resolved without the scene index | The preview played a different voice than the rehearsal |

## 2. Why Firebase requires App Check

Firebase is rolling out mandatory App Check enforcement for Firebase AI Logic:

> Starting **November 2, 2026**, Firebase App Check enforcement will be required
> to use Firebase AI Logic.

Projects created before July 2026 were not migrated automatically, so the
console still shows **Firebase AI Logic → Unenforced**. While the API is
unenforced, the TTS models are refused (403) and the endpoint surfaced the
failure as a generic `500`.

## 3. What the code does now

| File | Purpose |
| --- | --- |
| `lib/app-check.server.ts` | Mints an App Check token with the Firebase Admin SDK (`appCheck().createToken()`) and caches it until it expires |
| `lib/firebase-ai.ts` | `getAiApp()` returns a **Firebase Server App** carrying `settings.appCheckToken`, so `firebase/ai` sends the `X-Firebase-AppCheck` header automatically |
| `app/api/actor-copilot/tts/route.ts` | Uses `getAiApp()`, validates the requested voice, tries several TTS models and returns the real upstream error instead of a generic `500` |
| `lib/actor-copilot/script-parser.ts` | Voice allowlist (`GEMINI_TTS_VOICE_IDS`) + `resolveGeminiVoice()`; `Orpheus` → `Orus` |
| every AI route (`/api/**`) | Migrated to `getAiApp()` so enabling enforcement does not break the rest of the app |

Because all Gemini traffic of this application is issued from the server
(Next.js route handlers), the token is minted server side and no browser
change is required.

## 4. Steps required in the Firebase console

These steps are **not** covered by the code and must be done once by a project
owner:

1. Open **Firebase console → Build → App Check**.
2. Open the **APIs** tab and find the **Firebase AI Logic** row.
3. Click the row → **Set up** → **Enforced** → *Continue* → *Continue* →
   *Continue*.
4. For a production web app, register a real attestation provider
   (reCAPTCHA v3 or reCAPTCHA Enterprise) in the **Apps** tab so the browser
   can also prove its identity.

While the API row still says *Unenforced*, the TTS models keep answering
`403` and the endpoint now returns `503` with the message
`APP_CHECK_REQUIRED` instead of an opaque `500`.

## 5. Model lifecycle

Google is retiring the Gemini 2.5 models on the Agent Platform (Vertex AI)
API during **October 2026**. The TTS route therefore tries the models in this
order:

1. `gemini-3.1-flash-tts-preview`
2. `gemini-2.5-flash-tts`
3. `gemini-2.5-pro-tts`

The first one that answers with audio is used, and the response reports which
one in `modelUsed`.

## 6. How to verify

1. Deploy the branch.
2. Open **Reader Copilot → a scene → Partner Voices → Test**.
3. The request `POST /api/actor-copilot/tts` must answer `200` with
   `{"success": true, "audioUrl": "data:audio/wav;base64,...", "voiceName": "..."}`.
4. If it answers `503` with `code: "APP_CHECK_REQUIRED"`, enforcement is still
   missing in the console (step 4 above).
