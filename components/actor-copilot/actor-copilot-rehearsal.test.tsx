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

// Only the browser-side decoder is replaced: the store and the pure helpers
// stay real so the tests exercise the actual behaviour.
jest.mock("@/lib/actor-copilot/recordings", () => {
  const actual = jest.requireActual("@/lib/actor-copilot/recordings");
  return { ...actual, decodeToWav: jest.fn() };
});

// The end-of-speech detection is not what these tests are about: a turn ends
// as soon as the actor said something.
jest.mock("@/lib/actor-copilot/script-parser", () => {
  const actual = jest.requireActual("@/lib/actor-copilot/script-parser");
  return { ...actual, getHandsFreeEndpointDelayMs: () => 0 };
});

import { ActorCopilotRehearsal } from "./actor-copilot-rehearsal";
import { SceneData } from "@/lib/actor-copilot/script-parser";
import { decodeToWav } from "@/lib/actor-copilot/recordings";

const decodeToWavMock = decodeToWav as jest.MockedFunction<typeof decodeToWav>;

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

/** Minimal SpeechRecognition double, so hands-free turns can be driven. */
class MockSpeechRecognition {
  static instances: MockSpeechRecognition[] = [];

  onresult: ((event: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onstart: (() => void) | null = null;
  continuous = false;
  interimResults = false;
  lang = "en-US";

  constructor() {
    MockSpeechRecognition.instances.push(this);
  }

  start() {
    this.onstart?.();
  }

  stop() {}
}

const fakeStream = {
  getTracks: () => [{ stop: jest.fn() }],
};

/** A decoded take as the browser would produce it from a real recording. */
function decodedTake(overrides: Partial<{ durationMs: number; peak: number }> = {}) {
  return {
    blob: new Blob([new Uint8Array(32000)], { type: "audio/wav" }),
    durationMs: overrides.durationMs ?? 2400,
    peak: overrides.peak ?? 0.4,
    sampleRate: 16000,
  };
}

beforeEach(() => {
  MockMediaRecorder.emitAudio = false;
  MockSpeechRecognition.instances = [];
  decodeToWavMock.mockReset();
  decodeToWavMock.mockResolvedValue(null);

  (window as unknown as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;

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

/** Records the current actor line with the mic button and stops it. */
async function recordCurrentLine() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Start recording your line" }));
  });

  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Stop recording" })).toBeInTheDocument()
  );

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Stop recording" }));
  });
}

/** The dialogue of the line the rehearsal is currently on. */
function activeLineText() {
  const active = document.querySelector('[data-active-line="true"]');
  return active?.textContent ?? "";
}

describe("ActorCopilotRehearsal — actor recording playback", () => {
  it("does not show a playback control before anything is recorded", async () => {
    await startActorTurn();

    expect(screen.queryByText(/Play my take/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Record again/i)).not.toBeInTheDocument();
  });

  it("keeps the actor's own recording on the line it belongs to and offers playback", async () => {
    MockMediaRecorder.emitAudio = true;
    decodeToWavMock.mockResolvedValue(decodedTake());

    await startActorTurn();
    await recordCurrentLine();

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

  it("keeps the take even when the browser cannot decode the capture", async () => {
    MockMediaRecorder.emitAudio = true;
    // A decoder that comes back with nothing usable must not cost the actor
    // their recording: the original container is kept instead.
    decodeToWavMock.mockResolvedValue(decodedTake({ durationMs: 0, peak: 0 }));

    await startActorTurn();
    await recordCurrentLine();

    await waitFor(() => {
      expect(screen.getAllByText(/Play my take/i).length).toBeGreaterThan(0);
    });
  });

  it("keeps the take when the capture cannot be decoded at all", async () => {
    MockMediaRecorder.emitAudio = true;
    decodeToWavMock.mockResolvedValue(null);

    await startActorTurn();
    await recordCurrentLine();

    await waitFor(() => {
      expect(screen.getAllByText(/Play my take/i).length).toBeGreaterThan(0);
    });
  });

  it("plays the actor's take with its own audio element, without advancing the scene", async () => {
    MockMediaRecorder.emitAudio = true;
    decodeToWavMock.mockResolvedValue(decodedTake());

    await startActorTurn();
    await recordCurrentLine();

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

  it("sends the recording to the transcription API as WAV", async () => {
    MockMediaRecorder.emitAudio = true;
    decodeToWavMock.mockResolvedValue(decodedTake());

    await startActorTurn();
    await recordCurrentLine();

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls.filter((call) =>
        String(call[0]).includes("/api/dna/transcribe/chat")
      );
      expect(calls.length).toBeGreaterThan(0);
      expect(JSON.parse(calls[0][1].body).mimeType).toBe("audio/wav");
    });
  });

  it("drops the take when the endpoint confirms the capture held no speech", async () => {
    MockMediaRecorder.emitAudio = true;
    decodeToWavMock.mockResolvedValue(decodedTake());

    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (String(url).includes("/api/dna/transcribe/chat")) {
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: "Audio too short or silent (audio/wav)" }),
        };
      }
      return {
        ok: true,
        json: async () => ({ audioUrl: "https://example.test/ai-line.mp3" }),
      };
    });

    await startActorTurn();
    await recordCurrentLine();

    await waitFor(() => {
      expect(screen.getByText(/didn't hear anything/i)).toBeInTheDocument();
    });

    // Nothing worth playing back: no playback control for this line.
    expect(screen.queryByText(/Play my take/i)).not.toBeInTheDocument();
  });

  it("reports why a line could not be recognized and still moves the scene on", async () => {
    MockMediaRecorder.emitAudio = true;
    decodeToWavMock.mockResolvedValue(decodedTake());

    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (String(url).includes("/api/dna/transcribe/chat")) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: "Transcription service unavailable" }),
        };
      }
      return {
        ok: true,
        json: async () => ({ audioUrl: "https://example.test/ai-line.mp3" }),
      };
    });

    await startActorTurn();
    await recordCurrentLine();

    // The real reason from the server is shown instead of a generic message.
    await waitFor(() => {
      expect(screen.getByText(/Transcription service unavailable/i)).toBeInTheDocument();
    });

    // The scene keeps moving: the AI partner's line is now the current one.
    await waitFor(() => {
      expect(activeLineText()).toContain("He's outside.");
    });
  });

  it("stores the take of a hands-free turn", async () => {
    jest.useFakeTimers();

    try {
      MockMediaRecorder.emitAudio = true;
      decodeToWavMock.mockResolvedValue(decodedTake());

      render(<ActorCopilotRehearsal scene={scene} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /EMILY/ }));
      });

      // Let the recognition engine start and the capture recorder open.
      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      // The actor says the line out loud.
      const recognition = MockSpeechRecognition.instances[MockSpeechRecognition.instances.length - 1];
      expect(recognition).toBeDefined();

      await act(async () => {
        recognition.onresult?.({
          results: [[{ transcript: "Where is he?" }]],
        });
        jest.advanceTimersByTime(500);
      });

      // The turn completes and the scene moves on.
      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(screen.getAllByText(/Play my take/i).length).toBeGreaterThan(0);
      });
    } finally {
      jest.useRealTimers();
    }
  });
});
