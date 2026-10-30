/** @jest-environment jsdom */
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({
    currentUser: {
      getIdToken: jest.fn(async () => "test-token"),
    },
  })),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { ActorCopilotRehearsal } from "./actor-copilot-rehearsal";
import { SceneData } from "@/lib/actor-copilot/script-parser";

const scene: SceneData = {
  sceneId: "scene-1",
  title: "The Unseen Guest",
  characters: ["EMILY", "JAMES"],
  lines: [
    { id: "line-1", character: "EMILY", dialogue: "Where is he?", order: 1 },
    { id: "line-2", character: "JAMES", dialogue: "He's outside.", order: 2 },
  ],
};

/** Minimal MediaRecorder double that hands back a chunk of real audio bytes. */
class MockMediaRecorder {
  static isTypeSupported = jest.fn(() => true);

  /** When false the recorder stays silent, like a mute or a denied mic. */
  static emitAudio = false;

  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  state = "inactive";
  mimeType: string;
  stream: unknown;

  constructor(stream: unknown, options?: { mimeType?: string }) {
    this.stream = stream;
    this.mimeType = options?.mimeType ?? "audio/webm";
  }

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    if (MockMediaRecorder.emitAudio) {
      this.ondataavailable?.({
        data: new Blob([new Uint8Array(5000)], { type: this.mimeType }),
      });
    }
    this.onstop?.();
  }
}

const fakeStream = {
  getTracks: () => [{ stop: jest.fn() }],
};

beforeEach(() => {
  MockMediaRecorder.emitAudio = false;

  Object.defineProperty(global, "MediaRecorder", {
    writable: true,
    value: MockMediaRecorder,
  });

  Object.defineProperty(navigator, "mediaDevices", {
    writable: true,
    value: { getUserMedia: jest.fn(async () => fakeStream) },
  });

  Object.defineProperty(URL, "createObjectURL", {
    writable: true,
    value: jest.fn(() => "blob:mock-take"),
  });

  Object.defineProperty(URL, "revokeObjectURL", {
    writable: true,
    value: jest.fn(),
  });

  // jsdom implements neither of these.
  Object.defineProperty(window.Element.prototype, "scrollIntoView", {
    writable: true,
    value: jest.fn(),
  });

  Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
    writable: true,
    value: jest.fn(async () => undefined),
  });

  Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
    writable: true,
    value: jest.fn(),
  });

  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ audioUrl: "https://example.test/ai-line.mp3", text: "Where is he?" }),
  })) as unknown as typeof fetch;
});

afterEach(() => {
  jest.clearAllMocks();
});

/** Picks the character and turns Auto-Flow off so the mic button drives the turn. */
async function startActorTurn() {
  render(<ActorCopilotRehearsal scene={scene} />);

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /EMILY/ }));
  });

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Auto-Flow ON/ }));
  });
}

describe("ActorCopilotRehearsal — actor recording playback", () => {
  it("does not show a playback control before anything is recorded", async () => {
    await startActorTurn();

    expect(screen.queryByText(/Play my take/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Record again/i)).not.toBeInTheDocument();
  });

  it("keeps the actor's own recording on the line it belongs to and offers playback", async () => {
    MockMediaRecorder.emitAudio = true;

    await startActorTurn();

    // Record the actor line with the mic button.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Start recording your line" }));
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Stop recording" })).toBeInTheDocument()
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Stop recording" }));
    });

    // The take belongs to EMILY's line, never to the AI line.
    await waitFor(() => {
      expect(screen.getAllByText(/Play my take/i).length).toBeGreaterThan(0);
    });

    const playButtons = screen.getAllByRole("button", { name: /Play your recording of line 1/i });
    expect(playButtons.length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: /Play your recording of line 2/i })
    ).not.toBeInTheDocument();
  });

  it("plays the actor's take with its own audio element, without advancing the scene", async () => {
    MockMediaRecorder.emitAudio = true;

    await startActorTurn();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Start recording your line" }));
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Stop recording" })).toBeInTheDocument()
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Stop recording" }));
    });

    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: /Play your recording of line 1/i }).length
      ).toBeGreaterThan(0);
    });

    const ttsCallsBefore = (global.fetch as jest.Mock).mock.calls.length;

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Play your recording of line 1/i }));
    });

    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: /Pause your recording of line 1/i }).length
      ).toBeGreaterThan(0);
    });

    // Playing a take never asks the AI for new speech.
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(ttsCallsBefore);
  });
});
