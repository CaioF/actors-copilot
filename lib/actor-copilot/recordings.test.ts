/**
 * Unit tests for the actor self-recording take store used by the Reader.
 */
import {
  ACTOR_TAKE_MIME_CANDIDATES,
  ActorTakeStore,
  MIN_TAKE_BYTES,
  MIN_TAKE_DURATION_MS,
  SILENCE_PEAK_THRESHOLD,
  computePeak,
  downmixToMono,
  encodeWav,
  isSilentOrTooShort,
  isUsableTake,
  pickRecorderMimeType,
  resample,
} from "./recordings";

/** Builds a blob of the requested size so the size floor can be exercised. */
function makeBlob(size: number, type = "audio/webm"): Blob {
  return new Blob([new Uint8Array(size)], { type });
}

function makeFactory() {
  const created: string[] = [];
  const revoked: string[] = [];
  let counter = 0;

  return {
    created,
    revoked,
    factory: {
      create: () => {
        counter += 1;
        const url = `blob:take-${counter}`;
        created.push(url);
        return url;
      },
      revoke: (url: string) => {
        revoked.push(url);
      },
    },
  };
}

describe("pickRecorderMimeType", () => {
  it("returns the first supported candidate", () => {
    const supported = (type: string) => type === "audio/webm;codecs=opus";
    expect(pickRecorderMimeType(supported)).toBe("audio/webm;codecs=opus");
  });

  it("falls back to the next supported candidate", () => {
    const supported = (type: string) => type === "audio/mp4";
    expect(pickRecorderMimeType(supported)).toBe("audio/mp4");
  });

  it("returns undefined when no candidate is supported", () => {
    expect(pickRecorderMimeType(() => false)).toBeUndefined();
  });

  it("uses the documented candidate list", () => {
    expect(ACTOR_TAKE_MIME_CANDIDATES[0]).toBe("audio/webm;codecs=opus");
  });
});

describe("isUsableTake", () => {
  it("rejects missing blobs", () => {
    expect(isUsableTake(null)).toBe(false);
    expect(isUsableTake(undefined)).toBe(false);
  });

  it("rejects blobs below the silence floor", () => {
    expect(isUsableTake(makeBlob(MIN_TAKE_BYTES - 1))).toBe(false);
  });

  it("accepts blobs at or above the silence floor", () => {
    expect(isUsableTake(makeBlob(MIN_TAKE_BYTES))).toBe(true);
    expect(isUsableTake(makeBlob(MIN_TAKE_BYTES * 4))).toBe(true);
  });
});

describe("encodeWav", () => {
  it("writes a valid RIFF/WAVE header", () => {
    const wav = encodeWav(new Float32Array(100), 16000);
    const view = new DataView(wav);
    const header = new TextDecoder().decode(new Uint8Array(wav, 0, 4));
    const format = new TextDecoder().decode(new Uint8Array(wav, 8, 4));
    const chunk = new TextDecoder().decode(new Uint8Array(wav, 12, 4));
    const data = new TextDecoder().decode(new Uint8Array(wav, 36, 4));

    expect(header).toBe("RIFF");
    expect(format).toBe("WAVE");
    expect(chunk).toBe("fmt ");
    expect(data).toBe("data");

    // PCM, mono, 16 bit, at the requested sample rate.
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(24, true)).toBe(16000);
  });

  it("sizes the file as header plus 16 bit samples", () => {
    const wav = encodeWav(new Float32Array(50), 16000);
    expect(wav.byteLength).toBe(44 + 50 * 2);
  });

  it("keeps the sample values within the 16 bit range", () => {
    const wav = encodeWav(new Float32Array([0, 1, -1, 0.5]), 16000);
    const view = new DataView(wav);

    expect(view.getInt16(44, true)).toBe(0);
    expect(view.getInt16(46, true)).toBe(32767);
    expect(view.getInt16(48, true)).toBe(-32768);
    expect(view.getInt16(50, true)).toBe(16383);
  });

  it("clamps samples that are out of range", () => {
    const wav = encodeWav(new Float32Array([4, -4]), 16000);
    const view = new DataView(wav);

    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32768);
  });
});

describe("downmixToMono", () => {
  it("averages the channels", () => {
    const left = new Float32Array([1, 0, -1]);
    const right = new Float32Array([0, 0, 1]);
    const mono = downmixToMono([left, right]);

    expect(Array.from(mono)).toEqual([0.5, 0, 0]);
  });

  it("returns the single channel untouched", () => {
    const only = new Float32Array([0.25, 0.75]);
    expect(downmixToMono([only])).toBe(only);
  });

  it("handles no channels", () => {
    expect(downmixToMono([]).length).toBe(0);
  });
});

describe("resample", () => {
  it("keeps the signal when the rate does not change", () => {
    const samples = new Float32Array([0.1, 0.2, 0.3]);
    expect(resample(samples, 16000, 16000)).toBe(samples);
  });

  it("halves the length when the rate is halved", () => {
    const samples = new Float32Array(1000).fill(0.5);
    const output = resample(samples, 32000, 16000);

    expect(output.length).toBe(500);
    expect(output[0]).toBeCloseTo(0.5, 5);
  });

  it("doubles the length when the rate is doubled", () => {
    const samples = new Float32Array(500).fill(0.25);
    const output = resample(samples, 16000, 32000);

    expect(output.length).toBe(1000);
    expect(output[10]).toBeCloseTo(0.25, 5);
  });
});

describe("computePeak", () => {
  it("returns the loudest absolute sample", () => {
    expect(computePeak(new Float32Array([0.1, -0.8, 0.3]))).toBeCloseTo(0.8, 5);
  });

  it("returns zero for silence", () => {
    expect(computePeak(new Float32Array(100))).toBe(0);
  });
});

describe("isSilentOrTooShort", () => {
  it("rejects a silent recording", () => {
    expect(isSilentOrTooShort(0, 3000)).toBe(true);
    expect(isSilentOrTooShort(SILENCE_PEAK_THRESHOLD / 2, 3000)).toBe(true);
  });

  it("rejects a recording that is too short", () => {
    expect(isSilentOrTooShort(0.5, MIN_TAKE_DURATION_MS - 1)).toBe(true);
  });

  it("accepts a recording with speech", () => {
    expect(isSilentOrTooShort(0.5, 3000)).toBe(false);
  });
});

describe("ActorTakeStore", () => {
  it("keeps the actor audio associated with its dialogue line", () => {
    const { factory } = makeFactory();
    const store = new ActorTakeStore(factory);

    const take = store.put("line-1", makeBlob(5000));

    expect(take).not.toBeNull();
    expect(take?.lineId).toBe("line-1");
    expect(take?.takeNumber).toBe(1);
    expect(store.get("line-1")?.blob.size).toBe(5000);
    expect(store.has("line-1")).toBe(true);
    expect(store.has("line-2")).toBe(false);
    expect(store.size).toBe(1);
  });

  it("replaces the previous take of a line and revokes its blob URL", () => {
    const { factory, revoked } = makeFactory();
    const store = new ActorTakeStore(factory);

    const first = store.put("line-1", makeBlob(5000));
    const second = store.put("line-1", makeBlob(6000));

    expect(second?.takeNumber).toBe(2);
    expect(store.size).toBe(1);
    expect(revoked).toContain(first?.url);
    expect(store.get("line-1")?.blob.size).toBe(6000);
  });

  it("refuses to store empty audio", () => {
    const { factory, created } = makeFactory();
    const store = new ActorTakeStore(factory);

    const take = store.put("line-1", makeBlob(10));

    expect(take).toBeNull();
    expect(store.has("line-1")).toBe(false);
    expect(created).toHaveLength(0);
  });

  it("keeps takes of different lines apart", () => {
    const { factory } = makeFactory();
    const store = new ActorTakeStore(factory);

    store.put("line-1", makeBlob(5000));
    store.put("line-2", makeBlob(5000));

    expect(store.size).toBe(2);
    expect(store.list().map((take) => take.lineId)).toEqual(["line-1", "line-2"]);
  });

  it("removes a single take and revokes its blob URL", () => {
    const { factory, revoked } = makeFactory();
    const store = new ActorTakeStore(factory);

    const take = store.put("line-1", makeBlob(5000));
    store.remove("line-1");

    expect(store.has("line-1")).toBe(false);
    expect(store.size).toBe(0);
    expect(revoked).toContain(take?.url);
  });

  it("clears every take when the session restarts", () => {
    const { factory, revoked } = makeFactory();
    const store = new ActorTakeStore(factory);

    store.put("line-1", makeBlob(5000));
    store.put("line-2", makeBlob(5000));
    store.clear();

    expect(store.size).toBe(0);
    expect(store.list()).toEqual([]);
    expect(revoked).toHaveLength(2);
  });
});
