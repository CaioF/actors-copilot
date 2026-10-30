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

  /** Removes the take of a dialogue line and revokes its blob URL. */
  remove(lineId: string): void {
    const take = this.takes.get(lineId);
    if (!take) return;
    this.factory.revoke(take.url);
    this.takes.delete(lineId);
    this.counters.delete(lineId);
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
