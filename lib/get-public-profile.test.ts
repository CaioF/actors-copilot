/**
 * @jest-environment node
 */

// --- MOCK SETUP ---
jest.mock("react", () => ({
  cache: jest.fn((fn) => fn),
}));

const mockGet = jest.fn();
const mockQuery = {
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  get: mockGet,
};

// Mockamos a chamada pro banco
jest.mock("@/lib/firebase.admin", () => ({
  db: {
    collection: jest.fn(() => mockQuery),
  },
}));

describe("Data Fetching: getPublicProfile", () => {
  beforeAll(() => {
    // Injetamos as variáveis DUMMY antes de requerer o arquivo alvo. 
    // Assim impedimos o firebase.admin de estourar erro de variável não encontrada!
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "dummy";
    process.env.FIREBASE_CLIENT_EMAIL = "dummy";
    process.env.FIREBASE_PRIVATE_KEY = "dummy";
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Query Construction", () => {
    it("should construct the correct Firestore query for a published actor profile", async () => {
      // Usamos require dinâmico para garantir que é carregado apenas APÓS o BeforeAll
      const { getPublicProfile } = require("./get-public-profile");
      const { db } = require("@/lib/firebase.admin");

      mockGet.mockResolvedValueOnce({ empty: true });
      const testSlug = "john-doe";

      await getPublicProfile(testSlug);

      expect(db.collection).toHaveBeenCalledWith("actorProfiles");
      expect(mockQuery.where).toHaveBeenCalledWith("slug", "==", testSlug);
      expect(mockQuery.where).toHaveBeenCalledWith("status", "==", "published");
      expect(mockQuery.limit).toHaveBeenCalledWith(1);
    });
  });

  describe("Response Handling & Timestamp Serialization", () => {
    it("should return null gracefully if no profile matches the query", async () => {
      const { getPublicProfile } = require("./get-public-profile");
      mockGet.mockResolvedValueOnce({ empty: true });

      const result = await getPublicProfile("unknown-slug");
      expect(result).toBeNull();
    });

    it("should safely convert Firestore Timestamps to ISO strings for 'lastUpdated' and 'publishedAt'", async () => {
      const { getPublicProfile } = require("./get-public-profile");
      
      const mockDate = new Date("2023-10-01T12:00:00.000Z");
      const mockData = {
        fullName: "Jane Doe",
        // Simula o objeto proprietário de Timestamp do Firebase
        lastUpdated: { toDate: () => mockDate },
        publishedAt: { toDate: () => mockDate },
      };

      mockGet.mockResolvedValueOnce({
        empty: false,
        docs: [{ data: () => mockData }],
      });

      const result = await getPublicProfile("jane-doe");

      expect(result?.lastUpdated).toBe("2023-10-01T12:00:00.000Z");
      expect(result?.publishedAt).toBe("2023-10-01T12:00:00.000Z");
      expect(typeof result?.lastUpdated).toBe("string");
    });
  });
});