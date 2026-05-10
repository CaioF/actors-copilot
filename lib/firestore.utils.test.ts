/**
 * @jest-environment node
 */
import { saveRawMessageToFirestore } from "./firestore.utils";
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc, setDoc } from "firebase/firestore";
import { getApp, getDb } from "@/lib/firebase";
import { logger } from "@/lib/logger";

// --- MOCK SETUP ---
// We mock the Firebase client SDK to ensure tests run instantly 
// without requiring an active network connection or a real database instance.
jest.mock('@/lib/logger', () => {
  const mockLog = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  };
  return {
    logger: mockLog,
    createChildLogger: jest.fn().mockReturnValue(mockLog),
  };
});

jest.mock("firebase/firestore", () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  addDoc: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(() => "mocked-server-timestamp"),
}));

jest.mock("@/lib/firebase", () => ({
  getApp: jest.fn(() => "mocked-firebase-app"),
  getDb: jest.fn(() => "mocked-db-instance"),
}));

describe("Firestore Utilities - saveRawMessageToFirestore", () => {
  const mockUserId = "test-user-123";
  const mockMessageData = {
    userMessage: "How do I approach this monologue?",
    aiResponse: "Start by analyzing your character's objective.",
    timestamp: new Date().toISOString(),
    section: "actor_tactics",
  };

  beforeEach(() => {
    // Clear mock execution history between tests to prevent state leakage
    jest.clearAllMocks();
  });

  describe("Successful Database Operations", () => {
    it("should route the write request to the correct user-specific subcollection", async () => {
      // Arrange: Set up our mocked return values for the database routing
      const mockDbInstance = "mocked-db-instance";
      const mockCollectionRef = "mocked-collection-ref";
      
      (getFirestore as jest.Mock).mockReturnValue(mockDbInstance);
      (collection as jest.Mock).mockReturnValue(mockCollectionRef);

      // Act: Execute the function
      await saveRawMessageToFirestore(mockUserId, mockMessageData);

      // Assert: Verify the internal Firebase routing logic
      expect(getApp).toHaveBeenCalledTimes(1);
      expect(getFirestore).toHaveBeenCalledWith("mocked-firebase-app");
      expect(collection).toHaveBeenCalledWith(
        mockDbInstance,
        "users",
        mockUserId,
        "chatLogs"
      );
    });

    it("should append a server-side timestamp and commit the correct payload", async () => {
      // Arrange
      const mockCollectionRef = "mocked-collection-ref";
      (collection as jest.Mock).mockReturnValue(mockCollectionRef);

      // Act
      await saveRawMessageToFirestore(mockUserId, mockMessageData);

      // Assert: Verify that the document payload matches the required schema
      expect(serverTimestamp).toHaveBeenCalledTimes(1);
      expect(addDoc).toHaveBeenCalledWith(mockCollectionRef, {
        ...mockMessageData,
        createdAt: "mocked-server-timestamp", // Ensures we rely on the server's clock, not the client's
      });
    });
  });

  describe("Error Handling", () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      // Suppress console.error in the test output so we don't pollute the terminal 
      // when we intentionally trigger an error
      consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it("should log the failure and re-throw the error when the database transaction fails", async () => {
      // Arrange: Force the addDoc promise to reject, simulating a network failure or permission error
      const networkError = new Error("Firebase: Permission Denied");
      (addDoc as jest.Mock).mockRejectedValueOnce(networkError);

      // Act & Assert: Verify that the promise rejection bubbles up to the caller
      await expect(
        saveRawMessageToFirestore(mockUserId, mockMessageData)
      ).rejects.toThrow("Firebase: Permission Denied");

      // Verify that our internal logging caught the event before throwing
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: networkError,
          msg: 'Error saving message to Firestore'
        })
      );
    });
  });
});

describe("Intro video helpers", () => {
  const mockUserId = "test-user-123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getHasSeenIntroVideo", () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it("returns false when the actor profile document does not exist", async () => {
      const { getHasSeenIntroVideo } = await import("./firestore.utils");
      const mockDocRef = "mocked-doc-ref";
      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => false });

      const result = await getHasSeenIntroVideo(mockUserId);

      expect(doc).toHaveBeenCalledWith(expect.anything(), "actorProfiles", mockUserId);
      expect(getDoc).toHaveBeenCalledWith(mockDocRef);
      expect(result).toBe(false);
    });

    it("returns false when hasSeenIntroVideo is not explicitly true", async () => {
      const { getHasSeenIntroVideo } = await import("./firestore.utils");
      const mockDocRef = "mocked-doc-ref";
      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ hasSeenIntroVideo: false }),
      });

      const result = await getHasSeenIntroVideo(mockUserId);

      expect(result).toBe(false);
    });

    it("returns true only when docSnap.data().hasSeenIntroVideo === true", async () => {
      const { getHasSeenIntroVideo } = await import("./firestore.utils");
      const mockDocRef = "mocked-doc-ref";
      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ hasSeenIntroVideo: true }),
      });

      const result = await getHasSeenIntroVideo(mockUserId);

      expect(result).toBe(true);
    });

    it("logs and re-throws when getDoc fails", async () => {
      const { getHasSeenIntroVideo } = await import("./firestore.utils");
      const mockDocRef = "mocked-doc-ref";
      const networkError = new Error("Firebase: Network Unavailable");
      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (getDoc as jest.Mock).mockRejectedValueOnce(networkError);

      await expect(getHasSeenIntroVideo(mockUserId)).rejects.toThrow("Firebase: Network Unavailable");
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: networkError,
          msg: "Error getting intro video seen status",
        })
      );
    });
  });

  describe("markHasSeenIntroVideo", () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it("calls setDoc with actorProfiles path and merge true", async () => {
      const { markHasSeenIntroVideo } = await import("./firestore.utils");
      const mockDocRef = "mocked-doc-ref";
      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (setDoc as jest.Mock).mockResolvedValueOnce(undefined);

      await markHasSeenIntroVideo(mockUserId);

      expect(doc).toHaveBeenCalledWith(expect.anything(), "actorProfiles", mockUserId);
      expect(setDoc).toHaveBeenCalledWith(
        mockDocRef,
        { hasSeenIntroVideo: true },
        { merge: true }
      );
    });

    it("logs and re-throws when setDoc fails", async () => {
      const { markHasSeenIntroVideo } = await import("./firestore.utils");
      const mockDocRef = "mocked-doc-ref";
      const writeError = new Error("Firebase: Permission Denied");
      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (setDoc as jest.Mock).mockRejectedValueOnce(writeError);

      await expect(markHasSeenIntroVideo(mockUserId)).rejects.toThrow("Firebase: Permission Denied");
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: writeError,
          msg: "Error marking intro video as seen",
        })
      );
    });
  });
});