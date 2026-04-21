/**
 * @jest-environment node
 */
import { saveRawMessageToFirestore } from "./firestore.utils";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getApp } from "@/lib/firebase";

// --- MOCK SETUP ---
// We mock the Firebase client SDK to ensure tests run instantly 
// without requiring an active network connection or a real database instance.
jest.mock("firebase/firestore", () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  addDoc: jest.fn(),
  serverTimestamp: jest.fn(() => "mocked-server-timestamp"),
}));

jest.mock("@/lib/firebase", () => ({
  getApp: jest.fn(() => "mocked-firebase-app"),
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
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error saving message to Firestore:",
        networkError
      );
    });
  });
});