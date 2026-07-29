import { useContext } from 'react';
import { SocialContext } from './contexts';
import type { SocialState } from './types';

/**
 * The seam every partner-facing screen reads through, alongside `useAppData`
 * and `useAppActions`.
 *
 * Screens never reach `useSocialStore` directly, for the same reason they never
 * reach `useStore`: the provider is what knows which profile is active and what
 * to do when it changes.
 */
export function useSocial(): SocialState {
  const value = useContext(SocialContext);
  if (!value) throw new Error('useSocial must be used inside <SocialProvider>');
  return value;
}
