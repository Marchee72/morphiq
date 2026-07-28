import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { useStore } from './presentation/state/store';
import { db } from './data/database/LocalDatabase';

const initialState = useStore.getState();

async function seedProfile() {
  await db.userProfiles.add({ name: 'Alex', gender: 'male', birthDate: new Date('1995-01-01'), height: 180, createdAt: new Date() });
}

/**
 * These cover what the shell itself guarantees — the five destinations exist,
 * the right one is current, and mode and language changes re-render without
 * disturbing state. Screen content is covered by the screen tests.
 */
describe('App shell', () => {
  beforeEach(async () => {
    useStore.setState(initialState, true);
    await Promise.all(db.tables.map(t => t.clear()));
  });

  it('shows onboarding when no profiles exist', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: /create profile/i })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('renders five destinations with Today current', async () => {
    await seedProfile();
    render(<App />);
    for (const tab of ['Today', 'Train', 'Find', 'Body', 'Coach']) {
      expect(await screen.findByRole('button', { name: tab })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
  });

  it('navigates between destinations', async () => {
    await seedProfile();
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Body' }));
    await waitFor(() => expect(useStore.getState().activeTab).toBe('body'));
    expect(screen.getByRole('button', { name: 'Body' })).toHaveAttribute('aria-current', 'page');
  });

  it('mounts the app shell', async () => {
    await seedProfile();
    const { container } = render(<App />);
    await screen.findByRole('button', { name: 'Today' });
    expect(container.querySelector('.app.at')).toBeTruthy();
  });

  it('follows the colour mode setting', async () => {
    await seedProfile();
    const { container } = render(<App />);
    await screen.findByRole('button', { name: 'Today' });

    useStore.getState().setTheme('dark');
    await waitFor(() => expect(container.querySelector('.app')).toHaveAttribute('data-mode', 'dark'));
    useStore.getState().setTheme('light');
    await waitFor(() => expect(container.querySelector('.app')).toHaveAttribute('data-mode', 'light'));
  });

  it('follows the language setting', async () => {
    await seedProfile();
    render(<App />);
    await screen.findByRole('button', { name: 'Today' });

    useStore.getState().setLanguage('es');
    expect(await screen.findByRole('button', { name: 'Hoy' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Today' })).not.toBeInTheDocument();
  });
});
