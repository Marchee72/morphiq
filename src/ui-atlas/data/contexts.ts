import { createContext } from 'react';
import type { AppData } from './types';
import type { AppActions, AppUiState, SocialState } from './types';

/**
 * Contexts live apart from the providers so each provider file exports only a
 * component — the condition Fast Refresh needs to hot-reload them properly.
 *
 * Data and actions are separate contexts on purpose: a data tick would otherwise
 * invalidate the action bundle, and every screen would re-render for it.
 */
export const AppDataContext = createContext<AppData | null>(null);
export const AppActionsContext = createContext<AppActions | null>(null);
export const AppUiContext = createContext<AppUiState>({ overlay: null, payload: {} });

/**
 * Partners, kept off `AppData` for the same reason data and actions are apart.
 *
 * `AppData` is derived once per mount and holds nothing that ticks. A partner's
 * presence ticks constantly, and folding it in would re-render every screen on
 * every heartbeat. This context sits innermost so only its own consumers move.
 */
export const SocialContext = createContext<SocialState | null>(null);
