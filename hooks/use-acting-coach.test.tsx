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
  const mockDoc = jest.fn(() => ({ _doc: true }));
  const mockQuery = jest.fn(() => ({ _query: true }));

  return {
    collection: mockCollection,
    doc: mockDoc,
    query: mockQuery,
    orderBy: jest.fn(),
    addDoc: jest.fn(async () => ({ id: "msg-123" })),
    onSnapshot: jest.fn((ref, observer) => {
      Promise.resolve().then(() => {
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
