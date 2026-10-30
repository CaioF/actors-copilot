/**
 * Actor self-recording takes captured during Reader rehearsal.
 *
 * The Reader already captures the actor's microphone input with `MediaRecorder`
 * to feed the speech-to-text endpoint, but the captured audio was thrown away
 * right after transcription. This module keeps the actor's own audio so the
 * Reader can play it back on the exact dialogue line it belongs to.
 *
 * Everything here is intentionally framework-free and synchronous so it can be
 * unit tested without a DOM.
 * @module
 */

/**
 * Smallest blob (in bytes) we accept as a usable take. A WebM container with
 * real content is comfortably above this floor, while an empty container stays
 * below it. The threshold is intentionally low so a short line ("Why?") is
 * still replayable.
 */
export const MIN_TAKE_BYTES = 300;

/**
 * Shortest recording (ms) we accept as a take. Below this the capture is
 * treated as a misfire rather than a line.
 */
export const MIN_TAKE_DURATION_MS = 300;

/**
 * Peak amplitude below which a recording counts as silence. The actor's
 * microphone produces near-zero samples when nothing was said, and a silent
 * take would only ever produce a playback button that plays nothing.
 */
export const SILENCE_PEAK_THRESHOLD = 0.01;

/**
 * Sample rate of the stored take. Gemini downsamples audio to 16 kHz anyway,
 * so keeping the take at that rate makes it smaller without losing speech.
 */
export const TAKE_SAMPLE_RATE = 16000;

/**
 * MIME type of the stored take and of the audio sent to the transcription
 * API. WAV is understood by every browser and by every Gemini audio endpoint,
 * which the container format produced by `MediaRecorder` (usually WebM) is
 * not.
 */
export const TAKE_MIME_TYPE = "audio/wav";

/**
 * MIME types we try, in order, when creating a `MediaRecorder`. The first
 * supported one wins; when none is supported the recorder falls back to its
 * own default.
 */
export const ACTOR_TAKE_MIME_CANDIDATES: readonly string[] = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

/** A single recorded take of one dialogue line. */
export interface ActorTake {
  /** Id of the dialogue line this take belongs to. */
  lineId: string;
  /** The actor's original audio. Never re-encoded or synthesized. */
  blob: Blob;
  /** Object URL used to play the blob back in the browser. */
  url: string;
  /** MIME type of the captured audio. */
  mimeType: string;
  /** Timestamp of the moment the take was stored. */
  createdAt: number;
  /** 1 for the first take of a line, 2 for the next one, and so on. */
  takeNumber: number;
}

/** Creates and revokes the object URLs used to play back a take. */
export interface ObjectUrlFactory {
  create(blob: Blob): string;
  revoke(url: string): void;
}

/**
 * Default factory backed by the browser's `URL` API. In environments without
 * `createObjectURL` (SSR, bare test runners) it degrades to an empty URL
 * instead of throwing, so storing a take never breaks the rehearsal.
 */
export function createObjectUrlFactory(): ObjectUrlFactory {
  return {
    create: (blob: Blob) => {
      if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
        return URL.createObjectURL(blob);
      }
      return "";
    },
    revoke: (url: string) => {
      if (!url) return;
      if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(url);
      }
    },
  };
}

/**
 * Picks the best supported recording MIME type.
 *
 * @param isSupported - Optional override for `MediaRecorder.isTypeSupported`,
 * used by tests and by environments without the MediaRecorder API.
 * @returns {string | undefined} The MIME type to record with, or `undefined`
 * when the browser should use its own default.
 */
export function pickRecorderMimeType(
  isSupported?: (mimeType: string) => boolean
): string | undefined {
  const supported =
    isSupported ??
    ((mimeType: string) => {
      if (typeof MediaRecorder === "undefined") return false;
      if (typeof MediaRecorder.isTypeSupported !== "function") return false;
      return MediaRecorder.isTypeSupported(mimeType);
    });

  for (const candidate of ACTOR_TAKE_MIME_CANDIDATES) {
    if (supported(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Whether a captured blob is large enough to be treated as a real take.
 *
 * @param blob - The captured audio.
 * @returns {boolean} True when the blob holds more than the silence floor.
 */
export function isUsableTake(blob: Blob | null | undefined): boolean {
  if (!blob) return false;
  return blob.size >= MIN_TAKE_BYTES;
}

/**
 * A recording decoded into a format that can be stored, played back and
 * transcribed.
 */
export interface DecodedTake {
  /** The re-encoded audio (16 kHz mono 16-bit WAV). */
  blob: Blob;
  /** Duration of the recording in milliseconds. */
  durationMs: number;
  /** Peak absolute sample amplitude, from 0 (silence) to 1 (full scale). */
  peak: number;
  /** Sample rate of `blob`. */
  sampleRate: number;
}

/**
 * Downmixes interleaved channels to a single mono channel.
 *
 * @param channels - One `Float32Array` per channel.
 * @returns {Float32Array} The averaged mono signal.
 */
export function downmixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  if (channels.length === 1) return channels[0];

  const length = Math.min(...channels.map((channel) => channel.length));
  const mono = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (const channel of channels) sum += channel[i];
    mono[i] = sum / channels.length;
  }

  return mono;
}

/**
 * Resamples a mono signal with linear interpolation.
 *
 * @param samples - The source samples.
 * @param fromRate - Source sample rate in Hz.
 * @param toRate - Target sample rate in Hz.
 * @returns {Float32Array} The resampled signal.
 */
export function resample(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate || fromRate <= 0 || toRate <= 0 || samples.length === 0) {
    return samples;
  }

  const ratio = fromRate / toRate;
  const length = Math.max(1, Math.round(samples.length / ratio));
  const output = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const position = i * ratio;
    const index = Math.floor(position);
    const nextIndex = Math.min(index + 1, samples.length - 1);
    const weight = position - index;
    output[i] = samples[index] * (1 - weight) + samples[nextIndex] * weight;
  }

  return output;
}

/**
 * Peak absolute amplitude of a signal.
 *
 * @param samples - The samples to inspect.
 * @returns {number} The peak amplitude, from 0 to 1.
 */
export function computePeak(samples: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const value = Math.abs(samples[i]);
    if (value > peak) peak = value;
  }
  return peak;
}

/**
 * Encodes mono samples as a 16-bit PCM WAV file.
 *
 * @param samples - Mono samples, normally between -1 and 1.
 * @param sampleRate - Sample rate in Hz.
 * @returns {ArrayBuffer} The WAV file bytes.
 */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // format: PCM
  view.setUint16(22, 1, true); // channels: mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += bytesPerSample;
  }

  return buffer;
}

/**
 * Whether a decoded recording holds something worth keeping.
 *
 * @param peak - Peak amplitude of the recording.
 * @param durationMs - Duration of the recording in milliseconds.
 * @returns {boolean} False when the recording is silent or too short.
 */
export function isSilentOrTooShort(peak: number, durationMs: number): boolean {
  return durationMs < MIN_TAKE_DURATION_MS || peak < SILENCE_PEAK_THRESHOLD;
}

/**
 * Decodes a captured recording into a mono 16 kHz WAV file.
 *
 * The browser records in whatever container it likes (WebM/Opus on Chromium,
 * MP4/AAC on Safari). That container is not accepted by every Gemini audio
 * endpoint, and it is not guaranteed to be playable either, so the capture is
 * decoded here and re-encoded as WAV. Decoding also proves the capture is
 * intact: a truncated recording fails here instead of silently producing a
 * take that plays nothing.
 *
 * @param blob - The captured audio.
 * @param targetSampleRate - Sample rate of the returned WAV.
 * @returns {Promise<DecodedTake | null>} The decoded take, or `null` when the
 * environment cannot decode the capture.
 */
export async function decodeToWav(
  blob: Blob,
  targetSampleRate: number = TAKE_SAMPLE_RATE
): Promise<DecodedTake | null> {
  const AudioContextCtor =
    typeof window !== "undefined"
      ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined;

  if (!AudioContextCtor) return null;

  const context = new AudioContextCtor();

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const decoded = await context.decodeAudioData(arrayBuffer);
    const mono = downmixToMono(
      Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index))
    );
    const resampled = resample(mono, decoded.sampleRate, targetSampleRate);
    const wav = encodeWav(resampled, targetSampleRate);

    return {
      blob: new Blob([wav], { type: TAKE_MIME_TYPE }),
      durationMs: Math.round(decoded.duration * 1000),
      peak: computePeak(resampled),
      sampleRate: targetSampleRate,
    };
  } catch (err) {
    // A truncated or unsupported capture lands here. The caller falls back to
    // the original container and reports the problem to the actor.
    void err;
    return null;
  } finally {
    try {
      await context.close();
    } catch {
      // The context may already be closed.
    }
  }
}

/**
 * Reads a blob as a base64 string (without the data URL prefix).
 *
 * @param blob - The blob to encode.
 * @returns {Promise<string>} The base64 payload, or an empty string.
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    if (typeof FileReader === "undefined") {
      resolve("");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string | null;
      resolve(result ? result.split(",")[1] ?? "" : "");
    };
    reader.onerror = () => resolve("");
    reader.readAsDataURL(blob);
  });
}

/**
 * In-memory store of the actor's takes, keyed by dialogue line id.
 *
 * Storing a take for a line that already has one **replaces** it: the
 * previous blob URL is revoked and the take number goes up. The store is
 * session-scoped by design — takes live in the Reader tab and are gone when
 * the page is reloaded, so the UI must not promise persistence.
 */
export class ActorTakeStore {
  private readonly takes = new Map<string, ActorTake>();
  private readonly counters = new Map<string, number>();
  private readonly factory: ObjectUrlFactory;

  constructor(factory: ObjectUrlFactory = createObjectUrlFactory()) {
    this.factory = factory;
  }

  /**
   * Stores (or replaces) the take of a dialogue line.
   *
   * @param lineId - Id of the dialogue line the audio belongs to.
   * @param blob - The captured audio.
   * @param mimeType - Optional MIME type, defaults to the blob type.
   * @returns {ActorTake | null} The stored take, or `null` when the audio is
   * empty and therefore not worth keeping.
   */
  put(lineId: string, blob: Blob, mimeType?: string): ActorTake | null {
    if (!lineId || !isUsableTake(blob)) return null;

    const previous = this.takes.get(lineId);
    if (previous) {
      this.factory.revoke(previous.url);
    }

    const takeNumber = (this.counters.get(lineId) ?? 0) + 1;
    this.counters.set(lineId, takeNumber);

    const take: ActorTake = {
      lineId,
      blob,
      url: this.factory.create(blob),
      mimeType: mimeType || blob.type || "audio/webm",
      createdAt: Date.now(),
      takeNumber,
    };

    this.takes.set(lineId, take);
    return take;
  }

  /** Returns the take of a dialogue line, if any. */
  get(lineId: string): ActorTake | undefined {
    return this.takes.get(lineId);
  }

  /** Whether a dialogue line has a stored take. */
  has(lineId: string): boolean {
    return this.takes.has(lineId);
  }

  /**
   * Removes the take of a dialogue line and revokes its blob URL.
   *
   * The take counter is kept, so a later recording of the same line is
   * numbered as the next take instead of restarting the count.
   *
   * @param lineId - Id of the dialogue line.
   */
  remove(lineId: string): void {
    const take = this.takes.get(lineId);
    if (!take) return;
    this.factory.revoke(take.url);
    this.takes.delete(lineId);
  }

  /** Removes every take and revokes every blob URL. */
  clear(): void {
    this.takes.forEach((take) => this.factory.revoke(take.url));
    this.takes.clear();
    this.counters.clear();
  }

  /** All stored takes, in the order they were first recorded. */
  list(): ActorTake[] {
    return Array.from(this.takes.values());
  }

  /** How many lines currently have a take. */
  get size(): number {
    return this.takes.size;
  }
}
