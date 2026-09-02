import { useCallback, useMemo, useState } from 'react';
import type { Message } from '../../core/entities/Message';
import type { RoutineTemplate } from '../../core/entities/RoutineTemplate';
import { parseRoutineFromMessage } from '../../data/ai/GeminiCoach';

export interface CoachTurn {
  key: string;
  from: 'coach' | 'user';
  /** The message with any routine JSON block stripped out. */
  text: string;
  at: Date;
  /** Present when the assistant attached a routine to this message. */
  routine: RoutineTemplate | null;
  /**
   * Whether `key` is the message's own id rather than its position.
   *
   * Anything that remembers a decision about this message — dismissing its
   * routine card — has to key off something that survives the thread growing,
   * and the index fallback does not.
   */
  hasId: boolean;
}

/**
 * Turns the raw message log into something both Coach screens can render.
 *
 * The assistant embeds routines as a ```json:routine``` block inside the reply.
 * Left alone, that JSON renders as a wall of braces in the chat, so it is parsed
 * out here and handed to the screen as a structured routine instead.
 */
export function useCoachThread(messages: Message[]): CoachTurn[] {
  return useMemo(() => messages.map((message, i) => {
    const routine = message.sender === 'assistant' ? parseRoutineFromMessage(message.content) : null;
    const text = routine
      ? message.content.replace(/```(?:json:routine|json)[\s\S]*?```/i, '').trim()
      : message.content;

    return {
      key: message.id ?? `${i}`,
      from: message.sender === 'assistant' ? 'coach' : 'user',
      text,
      at: new Date(message.timestamp),
      routine,
      hasId: message.id != null,
    };
  }), [messages]);
}

/**
 * Routine cards the user has waved away.
 *
 * Kept out of the database on purpose. Dismissing is about this screen being
 * tidy, not about the coach never having said it — the message text stays, and
 * nothing is deleted from anyone's history. localStorage is therefore the right
 * home: losing the set costs a re-dismiss, and that is all.
 */
const DISMISSED_KEY = 'morphiq_coach_dismissed';

function readDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

export function dismissRoutine(messageId: string): Set<string> {
  const next = readDismissed();
  next.add(messageId);
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
  } catch {
    // The card still goes away for this render; only its memory is lost.
  }
  return next;
}

/**
 * The dismissed set, and a dismisser that keeps it in step.
 *
 * State rather than a bare read so dismissing re-renders the thread — the whole
 * point of the button is that the card leaves immediately.
 */
export function useDismissedRoutines(): [Set<string>, (messageId: string) => void] {
  const [dismissed, setDismissed] = useState(readDismissed);
  const dismiss = useCallback((messageId: string) => {
    setDismissed(dismissRoutine(messageId));
  }, []);
  return [dismissed, dismiss];
}

/**
 * The same answer, straight from the message log.
 *
 * `beginSession` has to know whether there is a routine worth offering before any
 * component has rendered, and the start sheet needs the routine itself — neither
 * can go through the hook. Parsing stops at the first hit rather than mapping the
 * whole thread.
 */
export function latestRoutineIn(messages: Message[]): RoutineTemplate | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender !== 'assistant') continue;
    const routine = parseRoutineFromMessage(messages[i].content);
    if (routine) return routine;
  }
  return null;
}
