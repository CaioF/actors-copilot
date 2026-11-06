/** @jest-environment node */

const mockGetDb = jest.fn(() => ({}));
const mockCollection = jest.fn();
const mockGetDocs = jest.fn();
const mockQuery = jest.fn();
const mockOrderBy = jest.fn();
const mockDoc = jest.fn();
const mockGetDoc = jest.fn();

jest.mock("@/lib/firebase", () => ({
  getDb: () => mockGetDb(),
}));

jest.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}));

import {
  auditionsCollectionPath,
  listSavedAuditions,
  loadSavedAudition,
} from "./audition-repository";
import { resolveUserPath } from "./user-path";

describe("resolveUserPath", () => {
  it("derives the path from the member's uid and first name", () => {
    expect(resolveUserPath({ uid: "abc123", displayName: "Raquel Subero" })).toBe("abc123_Raquel");
  });

  it("strips characters that are not valid in a Firestore document id", () => {
    expect(resolveUserPath({ uid: "abc123", displayName: "Jean-Luc" })).toBe("abc123_JeanLuc");
  });

  it("falls back to Actor when the member has no display name", () => {
    expect(resolveUserPath({ uid: "abc123", displayName: null })).toBe("abc123_Actor");
  });

  it("returns null when there is no signed-in member", () => {
    expect(resolveUserPath(null)).toBeNull();
    expect(resolveUserPath(undefined)).toBeNull();
  });
});

describe("auditionsCollectionPath", () => {
  it("points at the single auditions collection used by the whole app", () => {
    expect(auditionsCollectionPath("abc123_Raquel")).toBe("users/abc123_Raquel/auditions");
  });
});

describe("listSavedAuditions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDb.mockReturnValue({});
    mockCollection.mockReturnValue({ id: "auditions-ref" });
    mockOrderBy.mockReturnValue({ id: "order" });
    mockQuery.mockReturnValue({ id: "query-ref" });
    mockDoc.mockImplementation((_db: unknown, path: string) => ({ path }));
  });

  it("reads only the signed-in member's collection", async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });

    await listSavedAuditions("user123_Actor");

    expect(mockCollection).toHaveBeenCalledWith({}, "users/user123_Actor/auditions");
    expect(mockOrderBy).toHaveBeenCalledWith("createdAt", "desc");
  });

  it("normalizes the stored document into the shape the UI needs", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: "audition-1",
          data: () => ({
            project: "Romeo and Juliet",
            role: "Ophelia",
            projectType: "theater",
            analysisType: "sides",
            status: "completed",
            hasSides: true,
            hasBrief: false,
            castingDirectorName: "Nina Gold",
            createdAt: { toDate: () => new Date("2026-11-06T00:00:00.000Z") },
          }),
        },
      ],
    });

    const [audition] = await listSavedAuditions("user123_Actor");

    expect(audition).toEqual({
      id: "audition-1",
      project: "Romeo and Juliet",
      role: "Ophelia",
      projectType: "theater",
      analysisType: "sides",
      status: "Completed",
      hasSides: true,
      hasBrief: false,
      castingDirectorName: "Nina Gold",
      createdAt: new Date("2026-11-06T00:00:00.000Z"),
    });
  });

  it("falls back to sane defaults for incomplete documents", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: "audition-2", data: () => ({}) }],
    });

    const [audition] = await listSavedAuditions("user123_Actor");

    expect(audition).toMatchObject({
      project: "Untitled Project",
      role: "Unknown Role",
      projectType: "cinematic",
      analysisType: "sides",
      status: "Draft",
      hasSides: true,
      hasBrief: false,
      createdAt: null,
    });
  });

  it("propagates a Firestore failure so callers can show an error state", async () => {
    mockGetDocs.mockRejectedValue(new Error("permission-denied"));

    await expect(listSavedAuditions("user123_Actor")).rejects.toThrow("permission-denied");
  });
});

describe("loadSavedAudition", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDb.mockReturnValue({});
    mockDoc.mockImplementation((_db: unknown, path: string) => ({ path }));
  });

  it("reads the audition document from the member's collection", async () => {
    const stored = { project: "Hamlet", role: "Ophelia", hasSides: true };
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => stored });

    const result = await loadSavedAudition("user123_Actor", "audition-1");

    expect(mockDoc).toHaveBeenCalledWith({}, "users/user123_Actor/auditions/audition-1");
    expect(result).toEqual(stored);
  });

  it("returns null when the audition no longer exists", async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });

    await expect(loadSavedAudition("user123_Actor", "missing")).resolves.toBeNull();
  });
});
