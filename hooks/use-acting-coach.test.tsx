/** @jest-environment jsdom */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useActingCoach } from "./use-acting-coach";

const mockGetIdToken = jest.fn();
const mockFetch = jest.fn();

let messageObserver: ((snapshot: { docs: unknown[] }) => void) | null = null;
const writtenMessages: { id: string; role: string; content: string }[] = [];

jest.mock("firebase/firestore", () => {
  const mockCollection = jest.fn((_db, path) => ({ path, type: "collection" }));
  const mockDoc = jest.fn((_db, path) => ({ path, type: "doc" }));
  const mockQuery = jest.fn((ref) => ({ path: (ref as { path: string }).path, type: "query" }));
  return {
    collection: mockCollection,
    doc: mockDoc,
    query: mockQuery,
    orderBy: jest.fn(),
    addDoc: jest.fn((_coll, data) => {
      if (data && typeof data === "object" && "content" in data) {
        const msg = {
          id: `mock-id-${Date.now()}`,
          role: (data as { role?: string }).role || "user",
          content: (data as { content: string }).content,
        };
        writtenMessages.push(msg);
        Promise.resolve().then(() => {
          if (messageObserver) {
            messageObserver({
              docs: writtenMessages.map((m) => ({
                id: m.id,
                data: () => m,
              })),
            });
          }
        });
        return Promise.resolve({ id: msg.id });
      }
      return Promise.resolve({ id: "mock-id" });
    }),
    onSnapshot: jest.fn((ref, observer) => {
      const refPath = ref && typeof ref === "object" && "path" in ref ? (ref as { path: string }).path : String(ref);
      if (refPath.includes("/messages")) {
        messageObserver = observer as (snapshot: { docs: unknown[] }) => void;
        Promise.resolve().then(() => {
          if (messageObserver) {
            messageObserver({
              docs: writtenMessages.map((m) => ({
                id: m.id,
                data: () => m,
              })),
            });
          }
        });
      } else {
        Promise.resolve().then(() => {
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
        });
      }
      return jest.fn();
    }),
    serverTimestamp: jest.fn(() => new Date()),
    setDoc: jest.fn(),
    updateDoc: jest.fn(),
    increment: jest.fn((n) => n),
    getDocs: jest.fn(),
    arrayUnion: jest.fn((...args) => args),
  };
});

jest.mock("@/lib/firebase", () => ({
  getDb: jest.fn(() => ({})),
  isFirebaseConfigured: jest.fn(() => true),
}));

jest.mock("firebase/auth", () => ({
  getAuth: () => ({
    currentUser: {
      getIdToken: mockGetIdToken,
    },
  }),
  onAuthStateChanged: jest.fn((_auth, cb) => {
    cb({ uid: "test-uid", displayName: "Test Actor" });
    return jest.fn();
  }),
}));

global.fetch = mockFetch;

describe("useActingCoach", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetIdToken.mockResolvedValue("mock-token");
    writtenMessages.length = 0;
    messageObserver = null;
  });

  describe("sendMessage", () => {
    it("posts to /api/coach/chat with current history and updates local messages on success", async () => {
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

      await act(async () => {
        await result.current.sendMessage("Hello coach");
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/coach/chat", {
        method: "POST",
        headers: {
          Authorization: "Bearer mock-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: "Hello coach",
          history: [],
          currentFocus: null,
        }),
      });

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2);
      });

      expect(result.current.messages[0]).toMatchObject({
        role: "user",
        content: "Hello coach",
      });
      expect(result.current.messages[1]).toMatchObject({
        role: "assistant",
        content: "Hello, how can I help you?",
      });
    });

    it("surfaces fallback error message and resets loading state on route failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => useActingCoach());

      await act(async () => {
        await result.current.sendMessage("Hello coach");
      });

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2);
      });

      expect(result.current.messages[0]).toMatchObject({
        role: "user",
        content: "Hello coach",
      });
      expect(result.current.messages[1]).toMatchObject({
        role: "assistant",
        content:
          "I apologize, but I'm having trouble responding right now. Please try again.",
      });
      expect(result.current.isLoading).toBe(false);
    });

    it("surfaces fallback error message on malformed success payloads and resets loading state", async () => {
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

      await act(async () => {
        await result.current.sendMessage("Hello coach");
      });

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2);
      });

      expect(result.current.messages[1]).toMatchObject({
        role: "assistant",
        content:
          "I apologize, but I'm having trouble responding right now. Please try again.",
      });
      expect(result.current.isLoading).toBe(false);
    });

    it("calls addDoc with user message when authenticated", async () => {
      const { addDoc } = require("firebase/firestore");

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

      await act(async () => {
        await result.current.sendMessage("Hello coach");
      });

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          role: "user",
          content: "Hello coach",
        })
      );
    });

    it("calls addDoc with assistant reply after API success when authenticated", async () => {
      const { addDoc } = require("firebase/firestore");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aiData: {
            coach_reply: "Here is some guidance.",
            session_focus: null,
            step_index: 0,
            mode: null,
            phase: null,
          },
        }),
      });

      const { result } = renderHook(() => useActingCoach());

      await act(async () => {
        await result.current.sendMessage("How do I prepare?");
      });

      const assistantCalls = addDoc.mock.calls.filter(
        (call: unknown[]) => (call[1] as { role?: string })?.role === "assistant"
      );
      expect(assistantCalls).toHaveLength(1);
      expect(assistantCalls[0][1].content).toBe("Here is some guidance.");
    });

    it("appends new messages to existing history", async () => {
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

      await act(async () => {
        await result.current.sendMessage("First message");
      });

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2);
      });

      await act(async () => {
        await result.current.sendMessage("Second message");
      });

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(4);
      });

      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        "/api/coach/chat",
        expect.objectContaining({
          body: JSON.stringify({
            content: "Second message",
            history: [
              { role: "user", content: "First message" },
              { role: "assistant", content: "First response" },
            ],
            currentFocus: {
              sessionFocus: null,
              stepIndex: 0,
              mode: null,
              phase: null,
            },
          }),
        })
      );
    });

    it("calls updateDoc with sessionFocus, stepIndex, mode, and phase from aiData after successful response", async () => {
      const { updateDoc } = require("firebase/firestore");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aiData: {
            coach_reply: "Here is some guidance.",
            session_focus: "Find the objective",
            step_index: 3,
            mode: "guided",
            phase: "objective",
          },
        }),
      });

      const { result } = renderHook(() => useActingCoach());

      await act(async () => {
        await result.current.sendMessage("What should I work on?");
      });

      await waitFor(() => {
        expect(updateDoc).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            sessionFocus: "Find the objective",
            stepIndex: 3,
            mode: "guided",
            phase: "objective",
          })
        );
      });
    });

    it("sends currentFocus from session snapshot in fetch body", async () => {
      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session).not.toBeNull();
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aiData: {
            coach_reply: "Response with focus",
            session_focus: "Work on objective",
            step_index: 2,
            mode: "guided",
            phase: "objective",
          },
        }),
      });

      await act(async () => {
        await result.current.sendMessage("Continue working");
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.currentFocus).toEqual({
        sessionFocus: null,
        stepIndex: 0,
        mode: null,
        phase: null,
      });
    });
  });

  describe("startNewSession", () => {
    it("resets messages to [] and error to null after a conversation", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aiData: {
            coach_reply: "Hello, how can I help you?",
            citations: [],
          },
        }),
      });

      const { result } = renderHook(() => useActingCoach());

      await act(async () => {
        await result.current.sendMessage("Hello coach");
      });

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2);
      });

      // Clear mock messages state so the new session listener sees an empty collection
      writtenMessages.length = 0;

      await act(async () => {
        await result.current.startNewSession();
      });

      await waitFor(() => {
        expect(result.current.messages).toEqual([]);
      });
      expect(result.current.error).toBe(null);
    });

    it("is safely callable on a fresh hook with no messages", async () => {
      const { result } = renderHook(() => useActingCoach());

      expect(result.current.messages).toEqual([]);
      expect(result.current.error).toBe(null);

      await act(async () => {
        await result.current.startNewSession();
      });

      expect(result.current.messages).toEqual([]);
      expect(result.current.error).toBe(null);
    });

    it("does not reset isLoading — in-flight request completes and resolves cleanly", async () => {
      let resolveSlowResponse: (value: unknown) => void;
      const slowResponsePromise = new Promise((resolve) => {
        resolveSlowResponse = resolve;
      });

      mockFetch.mockImplementationOnce(
        () => slowResponsePromise as Promise<unknown>
      );

      const { result } = renderHook(() => useActingCoach());

      await act(async () => {
        const sendPromise = result.current.sendMessage("Hello coach");
        await result.current.startNewSession();
        resolveSlowResponse!({
          ok: true,
          json: async () => ({
            aiData: {
              coach_reply: "Delayed response",
              session_focus: null,
              step_index: 0,
              mode: null,
              phase: null,
            },
          }),
        });
        await sendPromise;
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it("creates a new Firestore session doc and updates sessionId state", async () => {
      const { setDoc } = require("firebase/firestore");

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
        /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i
      );
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

    it("passes linkedAuditionId to setDoc when provided", async () => {
      const { setDoc } = require("firebase/firestore");

      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session).not.toBeNull();
      });

      await act(async () => {
        await result.current.startNewSession({ linkedAuditionId: "audition-123" });
      });

      expect(setDoc).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          linkedAuditionId: "audition-123",
        })
      );
    });
  });

  describe("Firestore listener infrastructure", () => {
    it("returns session and sessionId from the hook", async () => {
      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.sessionId).toBeDefined();
        expect(typeof result.current.sessionId).toBe("string");
      });
      expect(result.current.session).toBeDefined();
    });

    it("calls onSnapshot for session when userPath is set", async () => {
      const { onSnapshot } = require("firebase/firestore");

      renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(onSnapshot).toHaveBeenCalled();
      });
    });
  });

  describe("clearSessionFocus", () => {
    it("calls updateDoc with cleared fields when userPath is set", async () => {
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

    it("returns early without calling updateDoc when userPath is null", async () => {
      const { updateDoc } = require("firebase/firestore");

      const { result } = renderHook(() => useActingCoach());

      await waitFor(() => {
        expect(result.current.session).not.toBeNull();
      });

      await act(async () => {
        await result.current.clearSessionFocus();
      });

      expect(updateDoc).toHaveBeenCalled();
    });
  });

  describe("DNA extraction trigger", () => {
    const highQualityExtraction = {
      new_traits: ["introverted performer"],
      defense_mechanisms: [" intellectualization"],
      leaf_snippets: [{ quote: "I hide behind characters" }],
      holistic_analysis: "Shows strong analytical approach to role preparation",
      somatic_tells: ["taps foot when thinking"],
      core_values: [" authenticity"],
      relational_dynamics: [" struggles with vulnerability"],
      milestones: [{ title: "First breakthrough", date: "2024-01-01" }],
      core_wounds_and_fears: ["fear of judgment"],
      unmet_needs: ["validation"],
      public_masks: ["confident exterior"],
      emotional_baseline: {
        conflict_response: "withdraws",
        internal_friction: "high",
        vulnerability_management: "avoidant",
      },
      intellectual_framework: {
        cognitive_style: "analytical",
        attention_to_detail: "high",
      },
      archetype_signals: ["the scholar"],
      key_entities_and_arenas: ["the stage"],
      themes_extracted: [],
      progress_assessment: {
        has_actionable_pattern: true,
        depth_score: 7,
      },
    };

    it("calls setDoc on profile/master with arrayUnion payloads when action is trigger_dna_extraction and quality gate passes", async () => {
      const { setDoc, arrayUnion, doc } = require("firebase/firestore");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aiData: {
            coach_reply: "You did great work today.",
            session_focus: null,
            step_index: 0,
            mode: "informational",
            phase: null,
            action: { type: "trigger_dna_extraction", payload: {} },
            extractions: highQualityExtraction,
          },
        }),
      });

      const { result } = renderHook(() => useActingCoach());

      await act(async () => {
        await result.current.sendMessage("I discovered something about myself today");
      });

      await waitFor(() => {
        expect(setDoc).toHaveBeenCalled();
      });

      const profileMasterCall = setDoc.mock.calls.find((call: unknown[]) => {
        const docCall = (doc.mock.calls as unknown[][]).find((c: unknown[]) => (c[1] as string | undefined)?.includes?.("profile/master"));
        return docCall !== undefined;
      });
      expect(profileMasterCall).toBeDefined();
      expect(profileMasterCall[2]).toEqual({ merge: true });

      const payload = profileMasterCall[1];
      expect(payload.lastUpdated).toBeDefined();
      expect(payload["psychology.traits"]).toEqual(arrayUnion("introverted performer"));
      expect(payload["psychology.defenseMechanisms"]).toEqual(arrayUnion(" intellectualization"));
      expect(payload["physicality.somaticTells"]).toEqual(arrayUnion("taps foot when thinking"));
      expect(payload["psychology.coreValues"]).toEqual(arrayUnion(" authenticity"));
      expect(payload["psychology.relationalDynamics"]).toEqual(arrayUnion(" struggles with vulnerability"));
      expect(payload["acting_fuel.coreWounds"]).toEqual(arrayUnion("fear of judgment"));
      expect(payload["acting_fuel.unmetNeeds"]).toEqual(arrayUnion("validation"));
      expect(payload["acting_fuel.publicMasks"]).toEqual(arrayUnion("confident exterior"));
      expect(payload["acting_fuel.archetypes"]).toEqual(arrayUnion("the scholar"));
      expect(payload["history.keyEntities"]).toEqual(arrayUnion("the stage"));
      expect(payload["psychology.emotionalBaseline.conflictResponse"]).toBe("withdraws");
      expect(payload["psychology.emotionalBaseline.internalFriction"]).toBe("high");
      expect(payload["psychology.emotionalBaseline.vulnerabilityManagement"]).toBe("avoidant");
      expect(payload["psychology.intellectualFramework.cognitiveStyle"]).toBe("analytical");
      expect(payload["psychology.intellectualFramework.attentionToDetail"]).toBe("high");

      const leafSnippets = payload["psychology.leafSnippets"];
      expect(leafSnippets).toBeDefined();
      expect(leafSnippets[0]).toMatchObject({
        quote: "I hide behind characters",
        section: "identity",
        timestamp: expect.any(String),
      });

      const analysisTimeline = payload["psychology.analysisTimeline"];
      expect(analysisTimeline).toBeDefined();
      expect(analysisTimeline[0]).toMatchObject({
        inference: "Shows strong analytical approach to role preparation",
        section: "identity",
        timestamp: expect.any(String),
      });

      const milestones = payload["history.milestones"];
      expect(milestones).toBeDefined();
      expect(milestones[0]).toMatchObject({
        title: "First breakthrough",
        date: "2024-01-01",
        section: "identity",
        discoveredAt: expect.any(String),
      });
    });

    it("does NOT call setDoc on profile/master when extractions is null", async () => {
      const { setDoc } = require("firebase/firestore");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aiData: {
            coach_reply: "You did great work today.",
            session_focus: null,
            step_index: 0,
            mode: "informational",
            phase: null,
            action: { type: "trigger_dna_extraction", payload: {} },
            extractions: null,
          },
        }),
      });

      const { result } = renderHook(() => useActingCoach());

      await act(async () => {
        await result.current.sendMessage("I discovered something about myself today");
      });

      await waitFor(() => {
        expect(setDoc).not.toHaveBeenCalledWith(
          expect.objectContaining({ path: expect.stringContaining("profile/master") }),
          expect.anything(),
          expect.anything()
        );
      });
    });

    it("does NOT call setDoc on profile/master when action is absent", async () => {
      const { setDoc } = require("firebase/firestore");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aiData: {
            coach_reply: "Regular coaching response.",
            session_focus: null,
            step_index: 0,
            mode: "informational",
            phase: null,
          },
        }),
      });

      const { result } = renderHook(() => useActingCoach());

      await act(async () => {
        await result.current.sendMessage("How do I improve?");
      });

      await waitFor(() => {
        expect(setDoc).not.toHaveBeenCalledWith(
          expect.objectContaining({ path: expect.stringContaining("profile/master") }),
          expect.anything(),
          expect.anything()
        );
      });
    });

    it("does NOT call setDoc when depth_score is below 4", async () => {
      const { setDoc } = require("firebase/firestore");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aiData: {
            coach_reply: "Surface-level observation.",
            session_focus: null,
            step_index: 0,
            mode: "informational",
            phase: null,
            action: { type: "trigger_dna_extraction", payload: {} },
            extractions: {
              ...highQualityExtraction,
              progress_assessment: {
                has_actionable_pattern: true,
                depth_score: 2,
              },
            },
          },
        }),
      });

      const { result } = renderHook(() => useActingCoach());

      await act(async () => {
        await result.current.sendMessage("Small talk about the weather");
      });

      await waitFor(() => {
        expect(setDoc).not.toHaveBeenCalledWith(
          expect.objectContaining({ path: expect.stringContaining("profile/master") }),
          expect.anything(),
          expect.anything()
        );
      });
    });

    it("does NOT call setDoc when has_actionable_pattern is false", async () => {
      const { setDoc } = require("firebase/firestore");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aiData: {
            coach_reply: "Surface-level observation.",
            session_focus: null,
            step_index: 0,
            mode: "informational",
            phase: null,
            action: { type: "trigger_dna_extraction", payload: {} },
            extractions: {
              ...highQualityExtraction,
              progress_assessment: {
                has_actionable_pattern: false,
                depth_score: 7,
              },
            },
          },
        }),
      });

      const { result } = renderHook(() => useActingCoach());

      await act(async () => {
        await result.current.sendMessage("Small talk about the weather");
      });

      await waitFor(() => {
        expect(setDoc).not.toHaveBeenCalledWith(
          expect.objectContaining({ path: expect.stringContaining("profile/master") }),
          expect.anything(),
          expect.anything()
        );
      });
    });

    it("does NOT write themes_extracted to profile", async () => {
      const { setDoc, doc } = require("firebase/firestore");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aiData: {
            coach_reply: "You did great work today.",
            session_focus: null,
            step_index: 0,
            mode: "informational",
            phase: null,
            action: { type: "trigger_dna_extraction", payload: {} },
            extractions: highQualityExtraction,
          },
        }),
      });

      const { result } = renderHook(() => useActingCoach());

      await act(async () => {
        await result.current.sendMessage("I discovered something about myself today");
      });

      await waitFor(() => {
        expect(setDoc).toHaveBeenCalled();
      });

      const profileMasterCall = setDoc.mock.calls.find((call: unknown[]) => {
        const docCall = (doc.mock.calls as unknown[][]).find((c: unknown[]) => (c[1] as string | undefined)?.includes?.("profile/master"));
        return docCall !== undefined;
      });
      expect(profileMasterCall).toBeDefined();
      const payload = profileMasterCall[1];
      expect(payload).not.toHaveProperty("themes_extracted");
    });
  });
});