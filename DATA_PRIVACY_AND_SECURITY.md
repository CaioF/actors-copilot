# Actors Copilot Data Privacy & Security Overview

This document explains how The Actors Copilot handles confidential user content, especially scripts, sides, and NDA material. It is written for both non-technical stakeholders and technical reviewers.

## 1. Overview

The Actors Copilot is built with Next.js, React, Firebase, Firestore, and Google Gemini via Firebase AI. The architecture is designed to keep confidential material safe by:

- processing uploaded scripts/sides in-memory on the backend,
- sending them only to a developer-grade LLM API,
- never persisting raw confidential content in Firestore,
- providing explicit user data deletion controls.

## 2. API Data Handling

### 2.1 Which LLM API is used?

The application uses **Google Gemini 3.1 Pro** through the **Firebase AI SDK** inside a Next.js API route.

Relevant file:
- `app/api/coach/chat/route.ts`

This is a developer API call, not a consumer-style ChatGPT or Claude web interface. It is accessed through server-side code using Firebase and is treated as a backend integration.

### 2.2 Why this matters

Developer API access is important because it means the system is using:

- a controlled server-side integration,
- a single inference request per coaching interaction,
- a backend architecture where user data is not exposed through a consumer chat product.

### 2.3 How the data moves

1. User uploads a document or sends a question from the frontend.
2. The frontend encodes the document as base64 and sends it in an authenticated POST request to `/api/coach/chat`.
3. The backend validates the document and converts it into a prompt part.
4. The prompt is sent to Gemini via `getGenerativeModel(...).generateContent(...)`.
5. Gemini returns the generated coaching response.
6. The response is returned to the client.

### 2.4 What Gemini sees and retains

Gemini receives:

- the assembled prompt text,
- optional attached document content as an inline prompt part.

Gemini does not write this data permanently to Firestore in your app. In this architecture, the confidential document content is processed during one request and then discarded.

## 3. Database Storage

### 3.1 What is stored in Firestore

Firestore stores the following user data:

- chat metadata and coaching sessions,
- user profile metadata,
- audition metadata,
- session state and message history.

Relevant schema types and files:
- `lib/chat-types.ts` defines `CoachMessage`, `CoachSession`, and other session data.
- `hooks/use-acting-coach.ts` stores messages to Firestore as the user interacts.
- `app/(interior)/settings/page.tsx` handles Firestore deletion of chat and account data.

### 3.2 What is not stored

The app does not permanently store raw confidential scripts, sides, or NDA text in Firestore.

Specifically:
- `document.data` is accepted in the request body,
- it is converted in `lib/document-processing.ts`,
- the extracted or inline text is sent to Gemini,
- Firestore only receives the user’s message text, timestamp, and optionally `documentName`.

### 3.3 What `CoachMessage` contains

From `lib/chat-types.ts`:

```ts
export interface CoachMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Timestamp | null;
  documentName?: string;
}
```

This confirms that Firestore stores only the user’s textual message and metadata, not the full uploaded document content.

## 4. Data Lifecycle and Deletion

### 4.1 User-initiated deletion

Your application supports explicit deletion flows for both chat/session data and the full account.

Relevant file:
- `app/(interior)/settings/page.tsx`

The code is structured to delete:

- all DNA session documents,
- all coach session documents and their messages,
- the user profile document,
- optionally all audit and storage artifacts when deleting an account.

### 4.2 How deletion works

`handleDeleteChatData()` performs a Firestore batch delete across:

- `users/{userPath}/dnaSessions/*`
- `users/{userPath}/coachSessions/*`
- `users/{userPath}/coachSessions/{sessionId}/messages/*`
- `users/{userPath}/profile/master`

`handleDeleteAccount()` expands this to delete:

- DNA vault documents,
- audition documents,
- user root document,
- user avatar in Firebase Storage,
- and the Firebase Auth user account.

### 4.3 No hidden retention windows in code

There is no code path that stores raw confidential uploads permanently or copies them into long-term storage. Document payloads are only used for immediate prompt generation and then discarded.

## 5. Security Guarantees for Your Client

### 5.1 Confidential scripts/sides are not retained permanently

- Raw upload content is only sent to the backend once.
- Only prompt text is passed to Gemini.
- Firestore does not contain the full uploaded file text.

### 5.2 No training on user data

- The architecture uses a **developer-side LLM call**, not a consumer service.
- The Gemini developer API is designed to avoid using user data for future model training.
- The app does not route data through ChatGPT or Claude consumer interfaces.

### 5.3 Control and deletion

Users can delete all coaching/chat data from the settings screen.

If a client wants to remove all data permanently, the system has explicit code paths to delete user data and account information.

## 6. Technical Summary for Your Boss

### What is safe

- `app/api/coach/chat/route.ts` handles confidential content on the backend.
- `lib/document-processing.ts` validates and processes uploads.
- `lib/firebase.admin.ts` performs secure, server-side Firebase access.
- `lib/chat-types.ts` limits Firestore message storage to metadata and text only.

### What is not safe in other systems

This architecture avoids the common risk of consumer AI tools by not using:

- ChatGPT web interface,
- Claude consumer chat interface,
- any client-side direct model call that would expose user content to third-party browser-origin services.

### Best practices implemented

- server-side LLM calls,
- authenticated Firebase token verification,
- explicit deletion workflows,
- minimal Firestore persistence.

## 7. Recommended Client-Facing Assurance Statement

You can send this statement to your client:

> "The Actors Copilot processes confidential audition materials through a secure backend route and sends them only to a developer-grade LLM API. We do not store scripts or sides permanently in our Firestore database, and our users can delete their coaching history at any time. The model call is not a consumer ChatGPT or Claude session, so the data is not used to train future general-purpose AI models."

## 8. Notes and Next Steps

If you want, I can also generate a short one-page summary version of this document for non-technical stakeholders, plus a second technical appendix for developers.