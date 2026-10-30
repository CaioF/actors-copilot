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

const CURRENCY_SUPPORT = {
  support: {
    monthly: {
      economy: ["usd", "eur", "gbp"],
      business: ["usd", "eur", "gbp"],
    },
    annual: {
      economy: ["usd", "eur", "gbp"],
      business: ["usd", "eur", "gbp"],
    },
  },
};

describe("StartTrialPage", () => {
  const originalFetch = global.fetch;
  const redirectMock = redirectTo as jest.MockedFunction<typeof redirectTo>;

  beforeEach(() => {
    jest.useFakeTimers();
    redirectMock.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  /**
   * Mocks the two calls the page makes on mount plus the checkout call.
   */
  const mockFetches = (options?: { pending?: boolean; ok?: boolean }) => {
    const pending = options?.pending ?? true;
    const ok = options?.ok ?? true;

    const fetchMock = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/billing/currencies")) {
        return Promise.resolve({ ok: true, json: async () => CURRENCY_SUPPORT });
      }

      if (init?.body) {
        return Promise.resolve({ ok: true, json: async () => ({ pending: true, checkoutUrl: CHECKOUT_URL }) });
      }

      return Promise.resolve({
        ok,
        status: pending ? 200 : 401,
        json: async () => (pending ? { pending: true, tier: "business", currency: "usd" } : { error: "Unauthorized" }),
      });
    });

    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  };

  const renderPage = async () => {
    render(<StartTrialPage />);
    await act(async () => {
      await Promise.resolve();
    });
  };

  it("explains the situation and offers the plan, cycle and currency choice", async () => {
    mockFetches();
    await renderPage();

    expect(
      screen.getByRole("heading", { name: /your free trial is ready to start/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/nothing has been charged/i)).toBeInTheDocument();
    expect(screen.getByText(/have a promo code/i)).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /^economy class/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^business class/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /monthly/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /annual/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "USD" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "EUR" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "GBP" })).toBeInTheDocument();
  });

  it("sends the default selection to the checkout and hands the user over to Stripe", async () => {
    const fetchMock = mockFetches();
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: /start my free trial/i }));

    await waitFor(() => expect(redirectMock).toHaveBeenCalledWith(CHECKOUT_URL));

    const checkoutCall = fetchMock.mock.calls.find((call) => call[1]?.body);
    expect(checkoutCall?.[1]?.body).toBe(
      JSON.stringify({ tier: "business", billingCycle: "monthly", currency: "usd" }),
    );
  });

  it("sends the plan, cycle and currency the user picked", async () => {
    const fetchMock = mockFetches();
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: /^economy class/i }));
    fireEvent.click(screen.getByRole("button", { name: /annual/i }));
    fireEvent.click(screen.getByRole("button", { name: "EUR" }));

    fireEvent.click(screen.getByRole("button", { name: /start my free trial/i }));

    await waitFor(() => expect(redirectMock).toHaveBeenCalledWith(CHECKOUT_URL));

    const checkoutCall = fetchMock.mock.calls.find((call) => call[1]?.body);
    expect(checkoutCall?.[1]?.body).toBe(
      JSON.stringify({ tier: "economy", billingCycle: "annual", currency: "eur" }),
    );
  });

  it("never redirects on its own: the user always chooses when to continue", async () => {
    mockFetches();
    await renderPage();

    act(() => {
      jest.advanceTimersByTime(60000);
    });

    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("sends the user to the dashboard when there is nothing to recover", async () => {
    mockFetches({ pending: false });
    await renderPage();

    expect(screen.getByText(/you.re all set/i)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    await waitFor(() => expect(redirectMock).toHaveBeenCalledWith("/dashboard"));
  });

  it("offers a retry when the page cannot be loaded", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
    await renderPage();

    expect(screen.getByText(/couldn.t open your checkout/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /see all plans/i })).toBeInTheDocument();
  });
});
