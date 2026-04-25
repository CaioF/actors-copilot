import { getUserAuditionsSummary, getAuditionFullData } from "./get-audition-context";

describe("getUserAuditionsSummary", () => {
  it("returns typed array of audition summaries from Firestore", async () => {
    const mockDocs = [
      {
        id: "audition-1",
        data: () => ({
          project: "The Foundation",
          role: "Technician",
          createdAt: "2024-01-15T10:00:00Z",
        }),
      },
      {
        id: "audition-2",
        data: () => ({
          project: "Night Watch",
          role: "Lead",
          createdAt: "2024-02-20T14:30:00Z",
        }),
      },
    ];

    const mockCollectionRef = {
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ docs: mockDocs }),
    };

    const mockDb = {
      collection: jest.fn().mockReturnValue(mockCollectionRef),
      doc: jest.fn().mockReturnValue(mockCollectionRef),
    } as any;

    const result = await getUserAuditionsSummary("testUser", mockDb);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "audition-2",
      project: "Night Watch",
      role: "Lead",
      createdAt: "2024-02-20T14:30:00Z",
    });
    expect(result[1]).toEqual({
      id: "audition-1",
      project: "The Foundation",
      role: "Technician",
      createdAt: "2024-01-15T10:00:00Z",
    });
  });

  it("returns empty array when no audition documents exist", async () => {
    const mockCollectionRef = {
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ docs: [] }),
    };

    const mockDb = {
      collection: jest.fn().mockReturnValue(mockCollectionRef),
      doc: jest.fn().mockReturnValue(mockCollectionRef),
    } as any;

    const result = await getUserAuditionsSummary("testUser", mockDb);

    expect(result).toEqual([]);
  });

  it("returns sorted by createdAt descending", async () => {
    const mockDocs = [
      {
        id: "audition-old",
        data: () => ({
          project: "Old Project",
          role: "Old Role",
          createdAt: "2024-01-01T00:00:00Z",
        }),
      },
      {
        id: "audition-new",
        data: () => ({
          project: "New Project",
          role: "New Role",
          createdAt: "2024-06-01T00:00:00Z",
        }),
      },
      {
        id: "audition-mid",
        data: () => ({
          project: "Mid Project",
          role: "Mid Role",
          createdAt: "2024-03-15T12:00:00Z",
        }),
      },
    ];

    const mockCollectionRef = {
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ docs: mockDocs }),
    };

    const mockDb = {
      collection: jest.fn().mockReturnValue(mockCollectionRef),
      doc: jest.fn().mockReturnValue(mockCollectionRef),
    } as any;

    const result = await getUserAuditionsSummary("testUser", mockDb);

    expect(result[0].id).toBe("audition-new");
    expect(result[1].id).toBe("audition-mid");
    expect(result[2].id).toBe("audition-old");
  });

  it("defaults missing fields to Unknown or empty string", async () => {
    const mockDocs = [
      {
        id: "incomplete-audition",
        data: () => ({}),
      },
    ];

    const mockCollectionRef = {
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ docs: mockDocs }),
    };

    const mockDb = {
      collection: jest.fn().mockReturnValue(mockCollectionRef),
      doc: jest.fn().mockReturnValue(mockCollectionRef),
    } as any;

    const result = await getUserAuditionsSummary("testUser", mockDb);

    expect(result[0]).toEqual({
      id: "incomplete-audition",
      project: "Unknown",
      role: "Unknown",
      createdAt: "",
    });
  });
});

describe("getAuditionFullData", () => {
  it("returns full document data for a given audition", async () => {
    const fullData = {
      project: "The Foundation",
      role: "Technician",
      createdAt: "2024-01-15T10:00:00Z",
      performanceMap: {
        intro: "Some intro",
        outro: "Some outro",
        sections: [],
      },
    };

    const mockDocRef = {
      doc: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => fullData,
      }),
    };

    const mockDb = {
      doc: jest.fn().mockReturnValue(mockDocRef),
    } as any;

    const result = await getAuditionFullData("testUser", "audition-1", mockDb);

    expect(result).toEqual(fullData);
  });

  it("returns null when audition document does not exist", async () => {
    const mockDocRef = {
      doc: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        exists: false,
        data: () => undefined,
      }),
    };

    const mockDb = {
      doc: jest.fn().mockReturnValue(mockDocRef),
    } as any;

    const result = await getAuditionFullData("testUser", "nonexistent", mockDb);

    expect(result).toBeNull();
  });
});
