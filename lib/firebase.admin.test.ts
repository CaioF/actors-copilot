/**
 * @jest-environment node
 */
import { logger } from "@/lib/logger";

// --- MOCK SETUP ---
jest.mock("firebase-admin", () => {
  return {
    apps: [],
    initializeApp: jest.fn(),
    credential: {
      cert: jest.fn(() => "mocked-cert"),
    },
    auth: jest.fn(() => "mocked-auth-instance"),
    app: jest.fn(() => "mocked-app-instance"),
  };
});

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: jest.fn(() => "mocked-firestore-instance"),
}));

// NOVO: Adicionado o mock do Storage
jest.mock("firebase-admin/storage", () => ({
  getStorage: jest.fn(() => ({
    bucket: jest.fn(() => "mocked-bucket-instance"),
  })),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe("Firebase Admin Server Initialization", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    
    // Limpamos o estado interno pegando a instância recém-criada pelo resetModules
    const adminMock = require("firebase-admin");
    adminMock.apps = [];
    adminMock.initializeApp.mockClear();
    adminMock.credential.cert.mockClear();
    
    const firestoreMock = require("firebase-admin/firestore");
    firestoreMock.getFirestore.mockClear();

    const storageMock = require("firebase-admin/storage");
    storageMock.getStorage.mockClear();
    
    (logger.error as jest.Mock).mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const setupValidEnvironment = () => {
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "test-project-id";
    process.env.FIREBASE_CLIENT_EMAIL = "admin@test-project.iam.gserviceaccount.com";
    process.env.FIREBASE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nfake-key-line-1\nfake-key-line-2\n-----END PRIVATE KEY-----";
  };

  describe("Environment Variable Validation", () => {
    it("should throw an initialization error if keys are missing", () => {
      setupValidEnvironment();
      delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

      expect(() => {
        require("./firebase.admin");
      }).toThrow(/Missing one or more required environment variables/);
    });
  });

  describe("SDK Initialization & Formatting", () => {
    it("should correctly format the private key by replacing escaped newlines", () => {
      setupValidEnvironment();
      require("./firebase.admin");

      const adminMock = require("firebase-admin");
      
      expect(adminMock.credential.cert).toHaveBeenCalledWith(
        expect.objectContaining({
          privateKey: "-----BEGIN PRIVATE KEY-----\nfake-key-line-1\nfake-key-line-2\n-----END PRIVATE KEY-----"
        })
      );
    });

    it("should initialize the admin app exactly once on cold start", () => {
      setupValidEnvironment();
      const { auth, db } = require("./firebase.admin");
      const adminMock = require("firebase-admin");

      expect(adminMock.initializeApp).toHaveBeenCalledTimes(1);
      expect(auth).toBe("mocked-auth-instance");
      expect(db).toBe("mocked-firestore-instance");
    });
  });

  describe("Singleton Pattern (Fast Refresh Protection)", () => {
    it("should bypass initialization if an admin app already exists in memory", () => {
      setupValidEnvironment();
      
      const adminMock = require("firebase-admin");
      adminMock.apps = ["existing-app-instance"];

      const { auth, db } = require("./firebase.admin");

      expect(adminMock.initializeApp).not.toHaveBeenCalled();
      expect(auth).toBe("mocked-auth-instance");
      expect(db).toBe("mocked-firestore-instance");
    });
  });

  describe("Firestore Database Routing", () => {
    it("should route to the (default) database if no specific ID is provided", () => {
      setupValidEnvironment();
      delete process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID;

      require("./firebase.admin");
      const firestoreMock = require("firebase-admin/firestore");

      expect(firestoreMock.getFirestore).toHaveBeenCalledWith("mocked-app-instance", "(default)");
    });

    it("should route to a custom database if NEXT_PUBLIC_FIREBASE_DATABASE_ID is declared", () => {
      setupValidEnvironment();
      process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID = "production-tenant-db";

      require("./firebase.admin");
      const firestoreMock = require("firebase-admin/firestore");

      expect(firestoreMock.getFirestore).toHaveBeenCalledWith("mocked-app-instance", "production-tenant-db");
    });
  });

  describe("Error Handling", () => {
    it("should log the error and re-throw if initializeApp fails internally", () => {
      setupValidEnvironment();
      
      const adminMock = require("firebase-admin");
      const mockError = new Error("Mocked internal Firebase crash");
      adminMock.initializeApp.mockImplementationOnce(() => {
        throw mockError;
      });

      expect(() => {
        require("./firebase.admin");
      }).toThrow("Mocked internal Firebase crash");

      const { logger } = require("@/lib/logger");
      
      expect(logger.error).toHaveBeenCalledWith({
        err: mockError,
        msg: "Error initializing Firebase Admin",
      });
    });
  });
});