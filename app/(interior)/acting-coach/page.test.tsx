// /** @jest-environment jsdom */

// import { render, screen, fireEvent, waitFor } from "@testing-library/react";
// import userEvent from "@testing-library/user-event";
// import "@testing-library/jest-dom";

// // react-markdown Mock to avoid ESM crash on Jest
// jest.mock("react-markdown", () => ({
//   __esModule: true,
//   default: ({ children }: any) => <>{children}</>,
// }));

// // Mocks for JSDOM and Radix UI components
// global.ResizeObserver = jest.fn().mockImplementation(() => ({
//   observe: jest.fn(),
//   unobserve: jest.fn(),
//   disconnect: jest.fn(),
// }));
// window.HTMLElement.prototype.scrollIntoView = jest.fn();

// jest.mock("@/lib/firebase", () => ({
//   getDb: jest.fn(),
//   isFirebaseConfigured: jest.fn(() => false),
// }));

// jest.mock("firebase/auth", () => ({
//   getAuth: jest.fn(() => ({ currentUser: null })),
//   onAuthStateChanged: jest.fn((auth, callback) => {
//     callback(null);
//     return jest.fn();
//   }),
// }));

// jest.mock("firebase/firestore", () => ({
//   collection: jest.fn(),
//   addDoc: jest.fn(),
//   serverTimestamp: jest.fn(),
// }));

// const mockSearchParams = new URLSearchParams();

// jest.mock("next/navigation", () => ({
//   useRouter: jest.fn(() => ({ push: jest.fn() })),
//   usePathname: jest.fn(() => "/acting-coach"),
//   useSearchParams: jest.fn(() => mockSearchParams),
// }));

// const mockSendMessage = jest.fn();
// const mockStartNewSession = jest.fn().mockResolvedValue(undefined);
// const mockClearSessionFocus = jest.fn().mockResolvedValue(undefined);

// jest.mock("@/hooks/use-acting-coach", () => ({
//   useActingCoach: jest.fn(),
// }));

// jest.mock("@/lib/acting-coach/render-markdown", () => ({ renderMarkdown: (s: string) => s }));

// import ActingCoachPage from "./page";
// import { useActingCoach } from "@/hooks/use-acting-coach";

// describe("ActingCoachPage", () => {
//   beforeEach(() => {
//     jest.clearAllMocks();
//     mockSearchParams.delete("auditionId");
//     mockSearchParams.delete("project");
//     mockSearchParams.delete("role");
    
//     (useActingCoach as jest.Mock).mockReturnValue({
//       messages: [],
//       isLoading: false,
//       error: null,
//       sendMessage: mockSendMessage,
//       startNewSession: mockStartNewSession,
//       clearSessionFocus: mockClearSessionFocus,
//       session: { title: "Session 1", sessionFocus: null },
//     });
//   });

//   it("renders ChatInput with custom placeholder", () => {
//     render(<ActingCoachPage />);
//     expect(screen.getByPlaceholderText("Talk to your coach...")).toBeInTheDocument();
//   });

//   it("calls sendMessage when user submits a message", async () => {
//     render(<ActingCoachPage />);
//     const input = screen.getByPlaceholderText("Talk to your coach...");
//     fireEvent.change(input, { target: { value: "How do I cold read?" } });
    
//     const sendButton = document.querySelector("button[aria-label='Send message']");
//     if (sendButton) fireEvent.click(sendButton);

//     expect(mockSendMessage).toHaveBeenCalledWith("How do I cold read?", undefined, null);
//   });

//   it("renders QuickPromptsDropdown when messages is empty", () => {
//     render(<ActingCoachPage />);
//     expect(screen.getByRole("button", { name: "Quick Prompts" })).toBeInTheDocument();
//   });

//   it("clicking New Session calls startNewSession", () => {
//     render(<ActingCoachPage />);
//     fireEvent.click(screen.getByText("New Session"));
//     expect(mockStartNewSession).toHaveBeenCalledTimes(1);
//   });

//   it("auto-triggers sendMessage with audition context when auditionId URL param is present", async () => {
//     mockSearchParams.set("auditionId", "aud-123");
//     mockSearchParams.set("project", "FOUNDATION");
//     mockSearchParams.set("role", "TECHNICIAN");

//     render(<ActingCoachPage />);

//     await waitFor(() => {
//       expect(mockSendMessage).toHaveBeenCalledWith(
//         "I want to work on my FOUNDATION audition as TECHNICIAN.",
//         "aud-123"
//       );
//     });
//   });

//   it("renders session focus indicator when sessionFocus is set", () => {
//     (useActingCoach as jest.Mock).mockReturnValue({
//       messages: [],
//       isLoading: false,
//       error: null,
//       sendMessage: mockSendMessage,
//       startNewSession: mockStartNewSession,
//       clearSessionFocus: mockClearSessionFocus,
//       session: { title: "New Session", sessionFocus: "Find Jane's objective in scene 2" },
//     });
//     render(<ActingCoachPage />);
//     expect(screen.getByText(/Currently working on: Find Jane's objective in scene 2/i)).toBeInTheDocument();
//     expect(screen.getByRole("button", { name: "Clear current focus" })).toBeInTheDocument();
//   });

//   it("clicking clear button calls clearSessionFocus", () => {
//     (useActingCoach as jest.Mock).mockReturnValue({
//       messages: [],
//       isLoading: false,
//       error: null,
//       sendMessage: mockSendMessage,
//       startNewSession: mockStartNewSession,
//       clearSessionFocus: mockClearSessionFocus,
//       session: { title: "New Session", sessionFocus: "Find Jane's objective" },
//     });
//     render(<ActingCoachPage />);
//     fireEvent.click(screen.getByRole("button", { name: "Clear current focus" }));
//     expect(mockClearSessionFocus).toHaveBeenCalledTimes(1);
//   });
// });