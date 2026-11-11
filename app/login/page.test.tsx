/** @jest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockSearchParams = new URLSearchParams();
const mockUseAuth = jest.fn();
const mockRedirectTo = jest.fn();

jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

jest.mock('@/lib/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/lib/navigate', () => ({
  redirectTo: (url: string) => mockRedirectTo(url),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: { alt?: string }) => <img alt={alt ?? ''} />,
}));

import LoginPage from './page';

function signedOut() {
  return {
    user: null,
    loading: false,
    loginWithGoogle: jest.fn(),
    loginWithEmail: jest.fn(),
    signupWithEmail: jest.fn(),
    sendPasswordReset: jest.fn(),
  };
}

/** A member whose Firebase record was created just now. */
function freshMember() {
  return {
    ...signedOut(),
    user: {
      metadata: { creationTime: new Date().toISOString() },
      getIdToken: jest.fn().mockResolvedValue('token'),
    },
  };
}

/**
 * The tab that is open is read from the wording of the Google button: it is
 * the only label that appears once and changes with the mode.
 */
describe('LoginPage', () => {
  beforeEach(() => {
    Array.from(mockSearchParams.keys()).forEach((key) => mockSearchParams.delete(key));
    mockUseAuth.mockReturnValue(signedOut());
    mockRedirectTo.mockReset();
  });

  it('opens the sign-in tab on a plain login link', () => {
    render(<LoginPage />);

    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
    expect(screen.queryByText('Sign Up with Google')).not.toBeInTheDocument();
  });

  it('opens the sign-up tab when the visitor comes from a referral link', () => {
    mockSearchParams.set('ref', 'lucas');
    render(<LoginPage />);

    expect(screen.getByText('Sign Up with Google')).toBeInTheDocument();
    expect(screen.queryByText('Continue with Google')).not.toBeInTheDocument();
  });

  it('still opens the sign-up tab when the referral link asks for it explicitly', () => {
    mockSearchParams.set('mode', 'signup');
    render(<LoginPage />);

    expect(screen.getByText('Sign Up with Google')).toBeInTheDocument();
  });

  /**
   * A member who signs up without picking a plan has no plan and no trial.
   * The login page used to leave them there, signed in, with nothing to
   * click: the trial checkout was never opened.
   */
  it('sends a brand new account to the trial screen when no plan was picked', async () => {
    mockSearchParams.set('ref', 'lucas');
    mockUseAuth.mockReturnValue(freshMember());

    render(<LoginPage />);

    await waitFor(() => expect(mockRedirectTo).toHaveBeenCalledWith('/start-trial'));
  });

  it('sends an account that already exists to the dashboard', async () => {
    mockUseAuth.mockReturnValue({
      ...signedOut(),
      user: {
        metadata: { creationTime: '2026-01-01T00:00:00.000Z' },
        getIdToken: jest.fn().mockResolvedValue('token'),
      },
    });

    render(<LoginPage />);

    await waitFor(() => expect(mockRedirectTo).toHaveBeenCalledWith('/dashboard'));
  });
});
