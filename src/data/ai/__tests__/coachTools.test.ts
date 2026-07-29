import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { runCoachTool, COACH_TOOLS, type CoachDataSource } from '../coachTools';
import { chatCompletionWithTools, MAX_TOOL_ROUNDS, type LLMProviderConfig } from '../GeminiCoach';
import type { WorkoutLog } from '../../../core/entities/WorkoutLog';
import type { WorkoutSet } from '../../../core/entities/WorkoutSet';

const DAY = 86_400_000;
const NOW = new Date(2026, 6, 27, 18, 30);

function log(id: string, daysAgo: number, type = 'Push A'): WorkoutLog {
  return {
    id,
    profileId: 'p1',
    timestamp: new Date(NOW.getTime() - daysAgo * DAY),
    type,
    duration: 60,
    description: '',
  };
}

let seq = 0;
function set(logId: string, name: string, setNumber: number, weight: number, reps: number): WorkoutSet {
  return {
    id: `s${seq++}`,
    workoutLogId: logId,
    profileId: 'p1',
    exerciseName: name,
    setNumber,
    weight,
    reps,
    isCompleted: true,
    timestamp: new Date(NOW.getTime() - DAY),
  };
}

function source(over: Partial<CoachDataSource> = {}): CoachDataSource {
  return {
    now: () => NOW,
    // Today, three days ago, and outside the default week.
    workoutLogs: () => [log('w1', 0), log('w2', 3, 'Pull B'), log('w3', 20)],
    allSets: () => [
      set('w1', 'Barbell Bench Press', 1, 80, 8),
      set('w1', 'Barbell Bench Press', 2, 100, 5),
      set('w2', 'Barbell Row', 1, 70, 10),
      set('w3', 'Barbell Bench Press', 1, 60, 8),
    ],
    activeSession: () => null,
    routines: () => [],
    measurements: () => [],
    ...over,
  };
}

describe('coach tool schemas', () => {
  it('exposes a session lookup, because "what did I do today" was unanswerable without one', () => {
    const names = COACH_TOOLS.map(tool => tool.function.name);
    expect(names).toContain('get_sessions');
    expect(names).toContain('get_active_session');
  });
});

describe('runCoachTool — get_sessions', () => {
  it('defaults to the last seven days', () => {
    const result = runCoachTool('get_sessions', {}, source()) as { count: number; sessions: { type: string }[] };
    expect(result.count).toBe(2);
    expect(result.sessions.map(s => s.type)).toEqual(['Push A', 'Pull B']);
  });

  it('includes a session logged earlier today, rather than cutting the range at midnight', () => {
    const result = runCoachTool(
      'get_sessions',
      { from: '2026-07-27', to: '2026-07-27' },
      source(),
    ) as { count: number };
    expect(result.count).toBe(1);
  });

  it('reaches back when asked to', () => {
    const result = runCoachTool('get_sessions', { from: '2026-06-01' }, source()) as { count: number };
    expect(result.count).toBe(3);
  });

  it('returns each session with its exercises and sets', () => {
    const result = runCoachTool('get_sessions', {}, source()) as {
      sessions: { exercises: { name: string; sets: { weightKg: number; reps: number }[] }[] }[];
    };
    const today = result.sessions[0];
    expect(today.exercises[0].name).toBe('Barbell Bench Press');
    expect(today.exercises[0].sets).toEqual([
      { set: 1, weightKg: 80, reps: 8, personalRecord: false },
      { set: 2, weightKg: 100, reps: 5, personalRecord: true },
    ]);
  });

  it('caps the number of sessions', () => {
    const result = runCoachTool('get_sessions', { from: '2026-01-01', limit: 1 }, source()) as { count: number };
    expect(result.count).toBe(1);
  });
});

describe('runCoachTool — get_active_session', () => {
  it('reports nothing running when nothing is', () => {
    expect(runCoachTool('get_active_session', {}, source())).toEqual({ inProgress: false });
  });

  it('reports the session being trained right now, which no log carries yet', () => {
    const result = runCoachTool('get_active_session', {}, source({
      activeSession: () => ({
        startTime: new Date(NOW.getTime() - 35 * 60_000),
        workoutType: 'Push A',
        routineSource: 'manual',
        routineExercises: [
          { exerciseName: 'Barbell Bench Press', targetSets: 3, targetReps: 8 },
          { exerciseName: 'Barbell Row', targetSets: 3 },
        ],
        sets: [
          { exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true },
          { exerciseName: 'Barbell Bench Press', setNumber: 2, weight: 80, reps: 8, isCompleted: true },
        ],
        feelingTag: 'good',
      }),
    })) as {
      inProgress: boolean; elapsedMin: number; loggedSets: number; plannedSets: number;
      volumeKgSoFar: number; exercises: { name: string; sets: unknown[] }[];
    };

    expect(result.inProgress).toBe(true);
    expect(result.elapsedMin).toBe(35);
    expect(result.loggedSets).toBe(2);
    expect(result.plannedSets).toBe(6);
    expect(result.volumeKgSoFar).toBe(1280);
    expect(result.exercises[1].sets).toEqual([]);
  });
});

describe('runCoachTool — the rest', () => {
  it('reads one exercise progression', () => {
    const result = runCoachTool(
      'get_exercise_history',
      { exerciseName: 'Barbell Bench Press' },
      source(),
    ) as { count: number };
    expect(result.count).toBe(2);
  });

  it('requires an exercise name rather than guessing', () => {
    expect(runCoachTool('get_exercise_history', {}, source())).toEqual({ error: 'exerciseName is required' });
  });

  it('reads records', () => {
    const result = runCoachTool('get_records', {}, source()) as { records: { exerciseName: string }[] };
    expect(result.records.map(r => r.exerciseName)).toContain('Barbell Bench Press');
  });

  it('names the tool it does not know', () => {
    expect(runCoachTool('get_horoscope', {}, source())).toEqual({ error: 'Unknown tool: get_horoscope' });
  });
});

// ── The loop ───────────────────────────────────────────────────────────────

const provider: LLMProviderConfig = {
  baseUrl: 'https://api.example.com/v1',
  model: 'test-model',
  apiKey: 'sk-test',
};

function reply(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

function toolCallReply(name: string, args: Record<string, unknown> = {}) {
  return reply({
    choices: [{
      finish_reason: 'tool_calls',
      message: {
        content: null,
        tool_calls: [{ id: 'call_1', type: 'function', function: { name, arguments: JSON.stringify(args) } }],
      },
    }],
  });
}

describe('chatCompletionWithTools', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('feeds a tool result back and returns the answer that follows', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(toolCallReply('get_sessions'))
      .mockResolvedValueOnce(reply({ choices: [{ message: { content: 'You benched 100x5 today.' } }] }));
    vi.stubGlobal('fetch', fetchMock);

    const execute = vi.fn().mockReturnValue({ count: 1 });
    const answer = await chatCompletionWithTools(
      provider, 'system', [{ role: 'user', content: 'how was today' }],
      COACH_TOOLS, execute,
    );

    expect(answer).toBe('You benched 100x5 today.');
    expect(execute).toHaveBeenCalledWith('get_sessions', {});

    // The second request carries the assistant's tool call and our reply to it.
    const second = JSON.parse(fetchMock.mock.calls[1][1].body) as { messages: { role: string }[] };
    expect(second.messages.map(m => m.role)).toEqual(['system', 'user', 'assistant', 'tool']);
  });

  it('turns a failing tool into an error result instead of losing the turn', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(toolCallReply('get_sessions'))
      .mockResolvedValueOnce(reply({ choices: [{ message: { content: 'I could not read that.' } }] }));
    vi.stubGlobal('fetch', fetchMock);

    const answer = await chatCompletionWithTools(
      provider, 'system', [{ role: 'user', content: 'hi' }],
      COACH_TOOLS,
      () => { throw new Error('database unavailable'); },
    );

    expect(answer).toBe('I could not read that.');
    const second = JSON.parse(fetchMock.mock.calls[1][1].body) as { messages: { role: string; content: string }[] };
    expect(second.messages.at(-1)!.content).toContain('database unavailable');
  });

  it('forces an answer on the last round rather than looping forever', async () => {
    const fetchMock = vi.fn().mockResolvedValue(toolCallReply('get_sessions'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(chatCompletionWithTools(
      provider, 'system', [{ role: 'user', content: 'hi' }],
      COACH_TOOLS, () => ({ ok: true }),
    )).rejects.toThrow(/without answering/);

    expect(fetchMock).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
    const last = JSON.parse(fetchMock.mock.calls[MAX_TOOL_ROUNDS - 1][1].body) as { tool_choice: string };
    expect(last.tool_choice).toBe('none');
  });

  it('falls back to a plain completion when the provider does not support tools', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: 'This model does not support tool calling' } }),
      } as Response)
      .mockResolvedValueOnce(reply({ choices: [{ message: { content: 'Plain answer.' } }] }));
    vi.stubGlobal('fetch', fetchMock);

    const answer = await chatCompletionWithTools(
      provider, 'system', [{ role: 'user', content: 'hi' }],
      COACH_TOOLS, () => ({}),
    );

    expect(answer).toBe('Plain answer.');
    const retry = JSON.parse(fetchMock.mock.calls[1][1].body) as { tools?: unknown };
    expect(retry.tools).toBeUndefined();
  });

  it('does not swallow an unrelated failure as a missing-tools error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Insufficient balance' } }),
    } as Response));

    await expect(chatCompletionWithTools(
      provider, 'system', [{ role: 'user', content: 'hi' }],
      COACH_TOOLS, () => ({}),
    )).rejects.toThrow(/Insufficient balance/);
  });
});
