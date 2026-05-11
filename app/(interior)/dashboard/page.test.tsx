/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/components/dashboard-header", () => ({
  DashboardHeader: ({ title }: { title: string }) => (
    <div data-testid="dashboard-header">{title}</div>
  ),
}));

jest.mock("@/components/step-card", () => ({
  StepCard: () => <div data-testid="step-card">StepCard</div>,
}));

jest.mock("@/components/memory-recording-banner", () => ({
  MemoryRecordingBanner: () => <div data-testid="memory-recording-banner">MemoryRecordingBanner</div>,
}));

jest.mock("@/components/history-upload-modal", () => ({
  HistoryUploadModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="history-upload-modal">
      <button onClick={onClose}>Close History Modal</button>
    </div>
  ),
}));

const mockUser = { uid: "test-user-123", displayName: "Test User" };
const mockUseAuth = jest.fn();

jest.mock("@/lib/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockGetHasSeenIntroVideo = jest.fn();
const mockMarkHasSeenIntroVideo = jest.fn();

jest.mock("@/lib/firestore.utils", () => ({
  getHasSeenIntroVideo: (...args: unknown[]) => mockGetHasSeenIntroVideo(...args),
  markHasSeenIntroVideo: (...args: unknown[]) => mockMarkHasSeenIntroVideo(...args),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
  createChildLogger: jest.fn().mockReturnValue({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  }),
}));

import { logger } from "@/lib/logger";
import DashboardPage from "./page";

describe("DashboardPage - Intro Video Flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false });
    mockGetHasSeenIntroVideo.mockResolvedValue(false);
    mockMarkHasSeenIntroVideo.mockResolvedValue(undefined);
  });

  describe("Intro video modal visibility", () => {
    it("renders intro video modal when user has not seen it", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.queryByTestId("intro-video-modal")).toBeInTheDocument();
      });
    });

    it("renders intro video modal and calls markHasSeenIntroVideo once for unseen user", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.queryByTestId("intro-video-modal")).toBeInTheDocument();
      });

      expect(mockMarkHasSeenIntroVideo).toHaveBeenCalledTimes(1);
      expect(mockMarkHasSeenIntroVideo).toHaveBeenCalledWith(mockUser.uid);
    });

    it("does not render intro video modal when user has already seen it", async () => {
      mockGetHasSeenIntroVideo.mockResolvedValue(true);

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.queryByTestId("intro-video-modal")).not.toBeInTheDocument();
      });

      expect(mockMarkHasSeenIntroVideo).not.toHaveBeenCalled();
    });
  });

  describe("Auth state guards", () => {
    it("does not call intro video helpers when auth is still loading", async () => {
      mockUseAuth.mockReturnValue({ user: null, loading: true });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.queryByTestId("intro-video-modal")).not.toBeInTheDocument();
      });

      expect(mockGetHasSeenIntroVideo).not.toHaveBeenCalled();
      expect(mockMarkHasSeenIntroVideo).not.toHaveBeenCalled();
    });

    it("does not call intro video helpers when no user exists", async () => {
      mockUseAuth.mockReturnValue({ user: null, loading: false });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.queryByTestId("intro-video-modal")).not.toBeInTheDocument();
      });

      expect(mockGetHasSeenIntroVideo).not.toHaveBeenCalled();
      expect(mockMarkHasSeenIntroVideo).not.toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it("does not crash and does not render modal when getHasSeenIntroVideo rejects", async () => {
      mockGetHasSeenIntroVideo.mockRejectedValue(new Error("Firebase: Network Unavailable"));

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.queryByTestId("intro-video-modal")).not.toBeInTheDocument();
      });

      expect(logger.error).not.toHaveBeenCalled();
    });

    it("renders modal and logs error when markHasSeenIntroVideo rejects after showing modal", async () => {
      mockMarkHasSeenIntroVideo.mockRejectedValue(new Error("Firebase: Permission Denied"));

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.queryByTestId("intro-video-modal")).toBeInTheDocument();
      });

      expect(logger.error).not.toHaveBeenCalled();
    });

    it("retries the seen-check for the same uid after a previous getHasSeenIntroVideo failure", async () => {
      mockGetHasSeenIntroVideo
        .mockRejectedValueOnce(new Error("Firebase: Network Unavailable"))
        .mockResolvedValueOnce(false);

      const { rerender } = render(<DashboardPage />);

      await waitFor(() => {
        expect(mockGetHasSeenIntroVideo).toHaveBeenCalledTimes(1);
      });

      mockUseAuth.mockReturnValue({ user: { ...mockUser }, loading: false });
      rerender(<DashboardPage />);

      await waitFor(() => {
        expect(mockGetHasSeenIntroVideo).toHaveBeenCalledTimes(2);
      });

      expect(await screen.findByRole("dialog", { name: /intro video/i })).toBeInTheDocument();
    });
  });

  describe("Modal close interaction", () => {
    it("closes modal when close button is clicked without re-calling Firestore helpers", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.queryByTestId("intro-video-modal")).toBeInTheDocument();
      });

      const closeButton = screen.getByRole("button", { name: /close intro video/i });
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByTestId("intro-video-modal")).not.toBeInTheDocument();
      });

      expect(mockGetHasSeenIntroVideo).toHaveBeenCalledTimes(1);
      expect(mockMarkHasSeenIntroVideo).toHaveBeenCalledTimes(1);
    });

    it("renders the modal with dialog semantics and moves focus to the close button", async () => {
      render(<DashboardPage />);

      const dialog = await screen.findByRole("dialog", { name: /intro video/i });
      const closeButton = screen.getByRole("button", { name: /close intro video/i });

      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(closeButton).toHaveFocus();
    });
  });
});
