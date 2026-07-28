import { describe, expect, it, beforeEach } from 'vitest';
import { authHeaders, clearSession, getToken, getUser, setSession } from '../session';

const user = { id: 1, email: 'marchee72@gmail.com', name: 'Marche', picture: null };

describe('session', () => {
  beforeEach(() => {
    localStorage.clear();
    clearSession();
  });

  it('starts signed out', () => {
    expect(getToken()).toBeNull();
    expect(getUser()).toBeNull();
    expect(authHeaders()).toEqual({});
  });

  it('carries the token on requests once signed in', () => {
    setSession({ token: 'abc123', user });
    expect(authHeaders()).toEqual({ Authorization: 'Bearer abc123' });
    expect(getUser()?.email).toBe('marchee72@gmail.com');
  });

  it('persists across a reload', () => {
    setSession({ token: 'abc123', user });
    expect(localStorage.getItem('morphiq_session')).toBe('abc123');
    expect(JSON.parse(localStorage.getItem('morphiq_user')!)).toMatchObject({ id: 1 });
  });

  it('leaves nothing behind on sign out', () => {
    setSession({ token: 'abc123', user });
    clearSession();
    expect(getToken()).toBeNull();
    expect(getUser()).toBeNull();
    expect(authHeaders()).toEqual({});
    expect(localStorage.getItem('morphiq_session')).toBeNull();
    expect(localStorage.getItem('morphiq_user')).toBeNull();
  });

  it('survives corrupt stored data rather than throwing on boot', () => {
    // A half-written value would otherwise crash the app before it renders.
    localStorage.setItem('morphiq_user', '{not json');
    clearSession();
    expect(getUser()).toBeNull();
  });
});
