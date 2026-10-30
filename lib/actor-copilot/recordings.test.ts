/**
 * Unit tests for the actor self-recording take store used by the Reader.
 */
import {
  ACTOR_TAKE_MIME_CANDIDATES,
  ActorTakeStore,
  MIN_TAKE_BYTES,
  isUsableTake,
  pickRecorderMimeType,
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
