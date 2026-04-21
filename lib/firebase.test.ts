/**
 * @jest-environment jsdom
 */

// --- MOCK SETUP ---
jest.mock("firebase/app", () => ({
  initializeApp: jest.fn(() => "mocked-firebase-app"),
  getApps: jest.fn(() => []), 
}));

jest.mock("firebase/firestore", () => ({
  getFirestore: jest.fn(() => "mocked-firestore-db"),
}));

describe("Client-side Firebase Initialization", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    
    // Pegando as instâncias frescas de mock geradas após o resetModules
    const appMock = require("firebase/app");
    appMock.initializeApp.mockClear();
    appMock.getApps.mockClear();
    appMock.getApps.mockReturnValue([]);
    
    const firestoreMock = require("firebase/firestore");
    firestoreMock.getFirestore.mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const setupValidEnvironment = () => {
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "test-api-key";
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "test.firebaseapp.com";
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "test-project";
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "1:123456:web:abcde";
  };

  describe("isFirebaseConfigured()", () => {
    it("should return true when all strictly required environment variables are populated", () => {
      setupValidEnvironment();
      const { isFirebaseConfigured } = require("./firebase");
      expect(isFirebaseConfigured()).toBe(true);
    });

    it("should return false if any required environment variable is missing or undefined", () => {
      setupValidEnvironment();
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "undefined"; 
      const { isFirebaseConfigured } = require("./firebase");
      expect(isFirebaseConfigured()).toBe(false);
    });
  });

  describe("getApp() - Application Singleton", () => {
    it("should initialize a new Firebase app on a cold start", () => {
      setupValidEnvironment();
      const appMock = require("firebase/app");
      appMock.getApps.mockReturnValue([]);

      const { getApp } = require("./firebase");
      const app = getApp();

      expect(appMock.initializeApp).toHaveBeenCalledTimes(1);
      expect(app).toBe("mocked-firebase-app");
    });

    it("should reuse an existing Firebase app during Next.js Fast Refresh (warm start)", () => {
      setupValidEnvironment();
      const appMock = require("firebase/app");
      appMock.getApps.mockReturnValue(["pre-existing-app"]);

      const { getApp } = require("./firebase");
      const app = getApp();

      expect(appMock.initializeApp).not.toHaveBeenCalled();
      expect(app).toBe("pre-existing-app");
    });

    it("should strictly evaluate lazily and maintain the singleton reference across multiple calls", () => {
      setupValidEnvironment();
      const appMock = require("firebase/app");
      appMock.getApps.mockReturnValue([]);

      const { getApp } = require("./firebase");
      
      const app1 = getApp();
      const app2 = getApp();
      const app3 = getApp();

      expect(appMock.initializeApp).toHaveBeenCalledTimes(1);
      expect(app1).toBe(app2);
      expect(app2).toBe(app3);
    });
  });

  describe("getDb() - Firestore Routing", () => {
    it("should initialize Firestore routed to the (default) database if no custom ID is provided", () => {
      setupValidEnvironment();
      delete process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID;

      const { getDb } = require("./firebase");
      const firestoreMock = require("firebase/firestore");
      const db = getDb();

      expect(firestoreMock.getFirestore).toHaveBeenCalledWith("mocked-firebase-app", "(default)");
      expect(db).toBe("mocked-firestore-db");
    });

    it("should initialize Firestore routed to a custom database if specified in the environment", () => {
      setupValidEnvironment();
      process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID = "staging-database";

      const { getDb } = require("./firebase");
      const firestoreMock = require("firebase/firestore");
      const db = getDb();

      expect(firestoreMock.getFirestore).toHaveBeenCalledWith("mocked-firebase-app", "staging-database");
      expect(db).toBe("mocked-firestore-db");
    });

    it("should maintain the Firestore database singleton reference across multiple calls", () => {
      setupValidEnvironment();

      const { getDb } = require("./firebase");
      const firestoreMock = require("firebase/firestore");
      
      const db1 = getDb();
      const db2 = getDb();

      expect(firestoreMock.getFirestore).toHaveBeenCalledTimes(1);
      expect(db1).toBe(db2);
    });
  });
});