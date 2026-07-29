import { useMemo } from 'react';
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
    };
  }), [messages]);
}

/** The most recent routine the coach proposed, which both screens surface as a card. */
export function latestRoutine(turns: CoachTurn[]): RoutineTemplate | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].routine) return turns[i].routine;
  }
  return null;
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
