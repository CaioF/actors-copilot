/** @jest-environment jsdom */
import { render, screen, act, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import StartTrialPage from "./page";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => (
    <img alt={(props.alt as string) ?? ""} src={(props.src as string) ?? ""} />
  ),
}));

jest.mock("@/lib/navigate", () => ({ redirectTo: jest.fn() }));

import { redirectTo } from "@/lib/navigate";

const CHECKOUT_URL = "https://checkout.stripe.com/c/pay/cs_test_recovery";

describe("StartTrialPage", () => {
  const originalFetch = global.fetch;
  const redirectMock = redirectTo as jest.MockedFunction<typeof redirectTo>;


  beforeEach(() => {
    jest.useFakeTimers();
    redirectMock.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
    redirectMock.mockReset();
    global.fetch = originalFetch;
  });

  const mockRecovery = (payload: Record<string, unknown>, ok = true) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok,
      json: async () => payload,
    }) as unknown as typeof fetch;
  };

  it("explains the situation in a friendly way and counts down to the checkout", async () => {
    mockRecovery({ pending: true, tier: "business", currency: "usd", checkoutUrl: CHECKOUT_URL });

    render(<StartTrialPage />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole("heading", { name: /your free trial is ready to start/i })).toBeInTheDocument();
    expect(screen.getByText(/nothing has been charged/i)).toBeInTheDocument();
    expect(screen.getByText(/14 days, on us/i)).toBeInTheDocument();
    expect(screen.getByText(/no charge today/i)).toBeInTheDocument();
    expect(screen.getByText(/cancel anytime/i)).toBeInTheDocument();
    expect(screen.getByText(/have a promo code/i)).toBeInTheDocument();
    expect(screen.getByText(/taking you to secure checkout in 15s/i)).toBeInTheDocument();
  });

  it("hands the user over to Stripe when the countdown finishes", async () => {
    mockRecovery({ pending: true, tier: "business", currency: "usd", checkoutUrl: CHECKOUT_URL });

    render(<StartTrialPage />);
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      jest.advanceTimersByTime(15000);
    });

    await waitFor(() => expect(redirectMock).toHaveBeenCalledWith(CHECKOUT_URL));
  });

  it("lets the user jump to the checkout without waiting", async () => {
    mockRecovery({ pending: true, tier: "business", currency: "usd", checkoutUrl: CHECKOUT_URL });

    render(<StartTrialPage />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: /start my free trial/i }));

    expect(redirectMock).toHaveBeenCalledWith(CHECKOUT_URL);
  });

  it("sends the user to the dashboard when there is nothing to recover", async () => {
    mockRecovery({ pending: false });

    render(<StartTrialPage />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/you.re all set/i)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    await waitFor(() => expect(redirectMock).toHaveBeenCalledWith("/dashboard"));
  });

  it("offers a retry when the checkout cannot be opened", async () => {
    mockRecovery({ error: "boom" }, false);

    render(<StartTrialPage />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/couldn.t open your checkout/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /see all plans/i })).toBeInTheDocument();
  });

  it("sends visitors without a session to the sign in screen", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;

    render(<StartTrialPage />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});
