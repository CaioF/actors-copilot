/** @jest-environment jsdom */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useActingCoach } from "./use-acting-coach";

const mockGetIdToken = jest.fn();
const mockFetch = jest.fn();

jest.mock("firebase/auth", () => ({
  getAuth: () => ({
    currentUser: {
      getIdToken: mockGetIdToken,
    },
  }),
}));

global.fetch = mockFetch;

describe("useActingCoach", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetIdToken.mockResolvedValue("mock-token");
  });

  describe("sendMessage", () => {
    it("posts to /api/coach/chat with current history and updates local messages on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aiData: {
            coach_reply: "Hello, how can I help you?",
            citations: [
              {
                citationNumber: 1,
                sourceBook: "Acting Techniques",
                excerptText: "Some excerpt text",
              },
            ],
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
      expect(result.current.messages[1].citations).toHaveLength(1);
      expect(result.current.messages[1].citations?.[0]).toMatchObject({
        citationNumber: 1,
        sourceBook: "Acting Techniques",
        excerptText: "Some excerpt text",
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

    it("appends new messages to existing history", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            aiData: {
              coach_reply: "First response",
              citations: [],
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            aiData: {
              coach_reply: "Second response",
              citations: [],
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
          }),
        })
      );
    });
  });

  describe("clearSession", () => {
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

      act(() => {
        result.current.clearSession();
      });

      expect(result.current.messages).toEqual([]);
      expect(result.current.error).toBe(null);
    });

    it("is safely callable on a fresh hook with no messages", () => {
      const { result } = renderHook(() => useActingCoach());

      expect(result.current.messages).toEqual([]);
      expect(result.current.error).toBe(null);

      act(() => {
        result.current.clearSession();
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
        act(() => {
          result.current.clearSession();
        });
        resolveSlowResponse!({
          ok: true,
          json: async () => ({
            aiData: {
              coach_reply: "Delayed response",
              citations: [],
            },
          }),
        });
        await sendPromise;
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });
});