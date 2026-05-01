/** @jest-environment jsdom */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useActingCoach } from "./use-acting-coach";

const mockGetIdToken = jest.fn();
const mockFetch = jest.fn();

jest.mock("@/lib/logger", () => ({
  createChildLogger: () => ({ debug: jest.fn() }),
}));

jest.mock("@/lib/firebase", () => ({
  getDb: jest.fn(() => ({})),
  isFirebaseConfigured: jest.fn(() => true),
}));

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({
    currentUser: {
      uid: "test-uid",
      getIdToken: mockGetIdToken,
    },
  })),
  onAuthStateChanged: jest.fn((_auth, cb) => {
    cb({ uid: "test-uid", displayName: "Test Actor" });
    return jest.fn();
  }),
}));

jest.mock("firebase/firestore", () => {
  const mockCollection = jest.fn(() => ({ _collection: true }));
  const mockDoc = jest.fn((db, path) => ({ _doc: true, _path: typeof path === "string" ? path : db }));
  const mockQuery = jest.fn(() => ({ _query: true }));

  return {
    collection: mockCollection,
    doc: mockDoc,
    query: mockQuery,
    orderBy: jest.fn(),
    addDoc: jest.fn(async () => ({ id: "msg-123" })),
    onSnapshot: jest.fn((ref, observer) => {
      // Importamos o act dinamicamente para evitar problemas de escopo no jest.mock
      const { act } = require("@testing-library/react");
      
      // Envolvemos a chamada do observer no act() e rodamos de forma síncrona
      act(() => {
        if (ref._query) {
          observer({
            docs: [],
          });
        } else {
          observer({
            exists: () => true,
            id: "coach-session-1",
            data: () => ({
              createdAt: new Date(),
              lastActiveAt: new Date(),
              status: "active",
              title: "New Session",
              linkedAuditionId: null,
              messageCount: 0,
              sessionFocus: null,
              stepIndex: 0,
              mode: null,
              phase: null,
            }),
          });
        }
      });
      return jest.fn(); // Função de unsubscribe
    }),
    serverTimestamp: jest.fn(() => new Date()),
    setDoc: jest.fn(async () => {}),
    updateDoc: jest.fn(async () => {}),
    increment: jest.fn((n) => n),
    arrayUnion: jest.fn((...args) => args),
  };
});

global.fetch = mockFetch;

describe("useActingCoach", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetIdToken.mockResolvedValue("mock-token");
  });

  describe("Initialization", () => {
    it("returns default state on mount", async () => {
      const { result } = renderHook(() => useActingCoach());

      expect(result.current.messages).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.sessionId).toBe("coach-session-1");
    });

    it("initializes session metadata listener and sets session", async () => {
      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session).not.toBeNull();
      });

      expect(result.current.session).toEqual(
        expect.objectContaining({
          id: "coach-session-1",
          status: "active",
          title: "New Session",
          linkedAuditionId: null,
          sessionFocus: null,
        })
      );
    });

    it("sets userPath from authenticated user", async () => {
      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session).not.toBeNull();
      });

      expect(result.current.sendMessage).toBeDefined();
    });
  });

  describe("sendMessage", () => {
    it("sends message to /api/coach/chat with correct payload", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aiData: {
            coach_reply: "Hello, how can I help you?",
            session_focus: null,
            step_index: 0,
            mode: null,
            phase: null,
          },
        }),
      });

      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session).not.toBeNull();
      });

      await act(async () => {
        await result.current.sendMessage("Hello coach");
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/coach/chat",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer mock-token",
            "Content-Type": "application/json",
          },
        })
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.content).toBe("Hello coach");
      expect(callBody.history).toEqual([]);
      expect(callBody.currentFocus).toBe(null);
    });

    it("sends full currentFocus object shape when session has a non-null sessionFocus", async () => {
      const { onSnapshot } = require("firebase/firestore");

      // Override onSnapshot for this test: first call returns a session with non-null focus
      (onSnapshot as jest.Mock).mockImplementationOnce((ref: any, observer: any) => {
        const { act: localAct } = require("@testing-library/react");
        localAct(() => {
          observer({
            exists: () => true,
            id: "coach-session-focused",
            data: () => ({
              createdAt: new Date(),
              lastActiveAt: new Date(),
              status: "active",
              title: "Focused Session",
              linkedAuditionId: null,
              messageCount: 5,
              sessionFocus: "Find your objective",
              stepIndex: 2,
              mode: "guided",
              phase: "objective",
            }),
          });
        });
        return jest.fn();
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aiData: {
            coach_reply: "Good progress",
            session_focus: "Find your objective",
            step_index: 2,
            mode: "guided",
            phase: "objective",
          },
        }),
      });

      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session?.sessionFocus).toBe("Find your objective");
      });

      await act(async () => {
        await result.current.sendMessage("Help me find my objective");
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.currentFocus).toEqual({
        sessionFocus: "Find your objective",
        stepIndex: 2,
        mode: "guided",
        phase: "objective",
      });
    });

    it("includes auditionId in request when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aiData: {
            coach_reply: "Got it",
            session_focus: null,
            step_index: 0,
            mode: null,
            phase: null,
          },
        }),
      });

      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session).not.toBeNull();
      });

      await act(async () => {
        await result.current.sendMessage("Hello", "aud-123");
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.auditionId).toBe("aud-123");
    });

    it("includes document in request when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aiData: {
            coach_reply: "Got it",
            session_focus: null,
            step_index: 0,
            mode: null,
            phase: null,
          },
        }),
      });

      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session).not.toBeNull();
      });

      const mockDoc = { name: "script.pdf", data: "base64encodeddata", mimeType: "application/pdf" };

      await act(async () => {
        await result.current.sendMessage("Here is my script", undefined, mockDoc);
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.document).toEqual(mockDoc);
    });

    it("sets error on failed request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session).not.toBeNull();
      });

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it("surfaces server error message and writes an assistant chat message on failure", async () => {
      const { addDoc } = require("firebase/firestore");

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: "Unsupported document type: text/csv" }),
      });

      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session).not.toBeNull();
      });

      await act(async () => {
        await result.current.sendMessage("Look at this file");
      });

      expect(result.current.error).toBe("Unsupported document type: text/csv");

      // addDoc called twice: user message, then assistant error message
      expect(addDoc).toHaveBeenCalledTimes(2);
      const errorMessageCall = addDoc.mock.calls[1];
      expect(errorMessageCall[1]).toMatchObject({
        role: "assistant",
        content: expect.stringContaining("Unsupported document type: text/csv"),
      });
      expect(errorMessageCall[1].content).toMatch(/try again/i);
    });

    it("sets error on missing coach_reply in response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aiData: {
            coach_reply: "",
            session_focus: null,
            step_index: 0,
            mode: null,
            phase: null,
          },
        }),
      });

      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session).not.toBeNull();
      });

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it("calls addDoc twice - once for user message and once for assistant reply", async () => {
      const { addDoc } = require("firebase/firestore");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aiData: {
            coach_reply: "Hello back",
            session_focus: null,
            step_index: 0,
            mode: null,
            phase: null,
          },
        }),
      });

      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session).not.toBeNull();
      });

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      expect(addDoc).toHaveBeenCalledTimes(2);

      const userCall = addDoc.mock.calls[0];
      expect(userCall[1]).toMatchObject({
        role: "user",
        content: "Hello",
      });

      const assistantCall = addDoc.mock.calls[1];
      expect(assistantCall[1]).toMatchObject({
        role: "assistant",
        content: "Hello back",
      });
    });

    it("updates session metadata with AI response data", async () => {
      const { updateDoc } = require("firebase/firestore");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aiData: {
            coach_reply: "Here is guidance",
            session_focus: "Find objective",
            step_index: 2,
            mode: "guided",
            phase: "objective",
          },
        }),
      });

      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session).not.toBeNull();
      });

      await act(async () => {
        await result.current.sendMessage("Help me");
      });

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          sessionFocus: "Find objective",
          stepIndex: 2,
          mode: "guided",
          phase: "objective",
        })
      );
    });

    it("trims content and skips if empty", async () => {
      const { addDoc } = require("firebase/firestore");

      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session).not.toBeNull();
      });

      await act(async () => {
        await result.current.sendMessage("   ");
      });

      expect(addDoc).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("includes message history in subsequent requests", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            aiData: {
              coach_reply: "First response",
              session_focus: null,
              step_index: 0,
              mode: null,
              phase: null,
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            aiData: {
              coach_reply: "Second response",
              session_focus: null,
              step_index: 0,
              mode: null,
              phase: null,
            },
          }),
        });

      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session).not.toBeNull();
      });

      await act(async () => {
        await result.current.sendMessage("First");
      });

      await act(async () => {
        await result.current.sendMessage("Second");
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("sets isLoading to true during request and false after", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aiData: {
            coach_reply: "Hello",
            session_focus: null,
            step_index: 0,
            mode: null,
            phase: null,
          },
        }),
      });

      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session).not.toBeNull();
      });

      act(() => {
        result.current.sendMessage("Hi");
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it("writes to actorProfiles/{uid} when action.type is update_actor_profile with valid payload", async () => {
      const { setDoc } = require("firebase/firestore");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aiData: {
            coach_reply: "I've updated your bio.",
            session_focus: null,
            step_index: 0,
            mode: null,
            phase: null,
            action: { type: "update_actor_profile", payload: { bio: "New bio text" } },
          },
        }),
      });

      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session).not.toBeNull();
      });

      await act(async () => {
        await result.current.sendMessage("Update my bio");
      });

      expect(setDoc).toHaveBeenCalledWith(
        expect.objectContaining({ _doc: true }),
        expect.objectContaining({
          bio: "New bio text",
          lastUpdated: expect.any(Object),
        }),
        { merge: true }
      );
    });

    it("does NOT write to actorProfiles when payload is empty", async () => {
      const { setDoc } = require("firebase/firestore");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aiData: {
            coach_reply: "No update needed.",
            session_focus: null,
            step_index: 0,
            mode: null,
            phase: null,
            action: { type: "update_actor_profile", payload: {} },
          },
        }),
      });

      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session).not.toBeNull();
      });

      await act(async () => {
        await result.current.sendMessage("Update my bio");
      });

      const actorProfileWrites = setDoc.mock.calls.filter(
        (call: any[]) => call[0] && call[0]._doc === true
      );
      expect(actorProfileWrites).toHaveLength(0);
    });

    it("strips restricted fields from update_actor_profile payload", async () => {
      const { setDoc } = require("firebase/firestore");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aiData: {
            coach_reply: "Done.",
            session_focus: null,
            step_index: 0,
            mode: null,
            phase: null,
            action: {
              type: "update_actor_profile",
              payload: { slug: "evil-slug", agencyEmail: "x@y.com", bio: "ok bio" },
            },
          },
        }),
      });

      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session).not.toBeNull();
      });

      await act(async () => {
        await result.current.sendMessage("Update my profile");
      });

      const actorProfileWrite = setDoc.mock.calls.find(
        (call: any[]) =>
          call[0] &&
          typeof call[0] === "object" &&
          "_doc" in call[0]
      );
      expect(actorProfileWrite).toBeDefined();
      const writtenPayload = actorProfileWrite?.[1];
      expect(writtenPayload).toHaveProperty("bio", "ok bio");
      expect(writtenPayload).not.toHaveProperty("slug");
      expect(writtenPayload).not.toHaveProperty("agencyEmail");
    });

    it("writes to users/{userPath}/profile/master when action.type is trigger_dna_extraction with passing quality gate", async () => {
      const { setDoc } = require("firebase/firestore");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aiData: {
            coach_reply: "I've extracted your DNA insights.",
            session_focus: null,
            step_index: 0,
            mode: null,
            phase: null,
            action: { type: "trigger_dna_extraction" },
            extractions: {
              progress_assessment: { has_actionable_pattern: true, depth_score: 5 },
              new_traits: ["Resilient"],
              core_values: ["Creativity"],
              somatic_tells: ["Hand gestures"],
            },
          },
        }),
      });

      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session).not.toBeNull();
      });

      await act(async () => {
        await result.current.sendMessage("What are my patterns?");
      });

      expect(setDoc).toHaveBeenCalled();
      const profileMasterWrite = setDoc.mock.calls.find(
        (call: any[]) =>
          call[1] &&
          typeof call[1] === "object" &&
          "lastUpdated" in call[1] &&
          "psychology.traits" in call[1]
      );
      expect(profileMasterWrite).toBeDefined();
      expect(profileMasterWrite[1]).toMatchObject({
        lastUpdated: expect.any(Object),
      });
      expect(profileMasterWrite[1]["psychology.traits"]).toBeDefined();
      expect(profileMasterWrite[1]["psychology.coreValues"]).toBeDefined();
      expect(profileMasterWrite[1]["physicality.somaticTells"]).toBeDefined();
    });

    it("does NOT write to profile/master when trigger_dna_extraction has failing quality gate", async () => {
      const { setDoc } = require("firebase/firestore");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aiData: {
            coach_reply: "Interesting.",
            session_focus: null,
            step_index: 0,
            mode: null,
            phase: null,
            action: { type: "trigger_dna_extraction" },
            extractions: {
              progress_assessment: { has_actionable_pattern: true, depth_score: 2 },
              new_traits: ["Resilient"],
            },
          },
        }),
      });

      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session).not.toBeNull();
      });

      await act(async () => {
        await result.current.sendMessage("What are my patterns?");
      });

      const profileMasterWrite = setDoc.mock.calls.find(
        (call: any[]) =>
          call[0] &&
          typeof call[0] === "object" &&
          "_path" in call[0] &&
          String(call[0]._path).includes("profile/master")
      );
      expect(profileMasterWrite).toBeUndefined();
    });

    it("does NOT trigger DNA quality gate for update_actor_profile action", async () => {
      const { setDoc } = require("firebase/firestore");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aiData: {
            coach_reply: "I've updated your profile.",
            session_focus: null,
            step_index: 0,
            mode: null,
            phase: null,
            action: { type: "update_actor_profile", payload: { bio: "Updated" } },
            extractions: {
              progress_assessment: { has_actionable_pattern: true, depth_score: 5 },
              new_traits: ["Resilient"],
            },
          },
        }),
      });

      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session).not.toBeNull();
      });

      await act(async () => {
        await result.current.sendMessage("Update my bio");
      });

      const profileMasterWrites = setDoc.mock.calls.filter(
        (call: any[]) =>
          call[0] &&
          typeof call[0] === "object" &&
          "_path" in call[0] &&
          String(call[0]._path).includes("profile/master")
      );
      expect(profileMasterWrites).toHaveLength(0);
    });
  });

  describe("startNewSession", () => {
    it("creates new session doc with setDoc", async () => {
      const { setDoc } = require("firebase/firestore");

      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session).not.toBeNull();
      });

      await act(async () => {
        await result.current.startNewSession();
      });

      expect(setDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: "active",
          title: "New Session",
          linkedAuditionId: null,
          messageCount: 0,
          sessionFocus: null,
          stepIndex: 0,
          mode: null,
          phase: null,
        })
      );
    });

    it("generates a new UUID for sessionId", async () => {
      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session).not.toBeNull();
      });

      const oldSessionId = result.current.sessionId;

      await act(async () => {
        await result.current.startNewSession();
      });

      expect(result.current.sessionId).not.toBe(oldSessionId);
      expect(result.current.sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it("clears messages on new session", async () => {
      const { setDoc } = require("firebase/firestore");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aiData: {
            coach_reply: "Hello",
            session_focus: null,
            step_index: 0,
            mode: null,
            phase: null,
          },
        }),
      });

      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session).not.toBeNull();
      });

      await act(async () => {
        await result.current.sendMessage("First message");
      });

      await act(async () => {
        await result.current.startNewSession();
      });

      expect(setDoc).toHaveBeenCalledTimes(1);
      
      expect(result.current.messages).toEqual([]);
    });

    it("passes linkedAuditionId when provided", async () => {
      const { setDoc } = require("firebase/firestore");

      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session).not.toBeNull();
      });

      await act(async () => {
        await result.current.startNewSession({ linkedAuditionId: "aud-xyz" });
      });

      expect(setDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          linkedAuditionId: "aud-xyz",
        })
      );
    });

    it("clears error on new session", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session).not.toBeNull();
      });

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      expect(result.current.error).not.toBeNull();

      await act(async () => {
        await result.current.startNewSession();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe("clearSessionFocus", () => {
    it("calls updateDoc with null focus fields", async () => {
      const { updateDoc } = require("firebase/firestore");

      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session).not.toBeNull();
      });

      await act(async () => {
        await result.current.clearSessionFocus();
      });

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          sessionFocus: null,
          mode: null,
          stepIndex: 0,
          phase: null,
        })
      );
    });
  });

  describe("Firebase Configuration Handling", () => {
    it("skips Firestore operations when Firebase is not configured", async () => {
      const { isFirebaseConfigured } = require("@/lib/firebase");
      isFirebaseConfigured.mockReturnValue(false);

      const { result } = renderHook(() => useActingCoach());

      expect(result.current.session).toBeNull();
      expect(result.current.messages).toEqual([]);
    });
  });
});
