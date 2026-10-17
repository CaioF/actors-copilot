/** @jest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { AdminLoginForm } from './admin-login-form';

describe('AdminLoginForm', () => {
  const fetchMock = jest.fn();
  const assign = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock;
  });

  it('renders labelled username and password fields without expected credentials', () => {
    const { container } = render(<AdminLoginForm navigate={assign} />);

    expect(screen.getByRole('textbox', { name: 'Username' })).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(container).not.toHaveTextContent(/expected|default password/i);
    expect(container.querySelector('script')).not.toBeInTheDocument();
  });

  it('disables the form and shows a loading label while submitting', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<AdminLoginForm navigate={assign} />);

    await user.type(screen.getByRole('textbox', { name: 'Username' }), 'operator');
    await user.type(screen.getByLabelText('Password'), 'not-a-secret');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByRole('button', { name: 'Logging in...' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Username' })).toBeDisabled();
    expect(screen.getByLabelText('Password')).toBeDisabled();
  });

  it.each([401, 429])('announces a generic error for a %s response', async (status) => {
    fetchMock.mockResolvedValue({ ok: false, status });
    const user = userEvent.setup();
    render(<AdminLoginForm navigate={assign} />);

    await user.type(screen.getByRole('textbox', { name: 'Username' }), 'operator');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'polite');
    expect(alert).toHaveTextContent(
      status === 429
        ? 'Too many attempts. Please wait and try again.'
        : 'Unable to log in with those credentials.',
    );
    expect(alert).not.toHaveTextContent('operator');
    expect(alert).not.toHaveTextContent('wrong');
  });

  it('posts credentials and hard-navigates after successful login', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const user = userEvent.setup();
    render(<AdminLoginForm navigate={assign} />);

    await user.type(screen.getByRole('textbox', { name: 'Username' }), 'operator');
    await user.type(screen.getByLabelText('Password'), 'entered-secret');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/admin-dashboard'));
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'operator', password: 'entered-secret' }),
    });
  });
});
