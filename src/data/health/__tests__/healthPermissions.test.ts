import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * The permission gate is the whole sync in one boolean: `App.tsx` and the Sync
 * button in Settings both refuse to import anything when it comes back false.
 * These cover the two ways it used to come back false while Health Connect was
 * perfectly willing to hand the data over.
 */

const requestHealthPermissions = vi.fn();
const checkPermissions = vi.fn();
const requestPermissions = vi.fn();

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
    isPluginAvailable: () => true,
  },
}));

vi.mock('capacitor-health', () => ({
  Health: { requestHealthPermissions },
}));

vi.mock('../BodyCompositionPlugin', () => ({
  BodyComposition: { checkPermissions, requestPermissions },
}));

const { CapacitorHealthProvider } = await import('../CapacitorHealthProvider');

const READ_WEIGHT = 'android.permission.health.READ_WEIGHT';
const READ_BODY_FAT = 'android.permission.health.READ_BODY_FAT';

const granted = (...perms: string[]) => ({
  permissions: Object.fromEntries(perms.map(p => [p, true])),
});

describe('CapacitorHealthProvider.requestPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestPermissions.mockResolvedValue(granted(READ_WEIGHT, READ_BODY_FAT));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('syncs on weight alone when exercise was refused', async () => {
    // The regression: this asked for READ_WORKOUTS and nothing else, so a user
    // who let MorphIQ read the scale but not the watch got no weigh-ins either.
    requestHealthPermissions.mockResolvedValue({ permissions: { READ_WORKOUTS: false } });
    checkPermissions.mockResolvedValue(granted(READ_WEIGHT, READ_BODY_FAT));

    await expect(new CapacitorHealthProvider().requestPermissions()).resolves.toBe(true);
  });

  it('stays false when Health Connect granted nothing', async () => {
    requestHealthPermissions.mockResolvedValue({ permissions: { READ_WORKOUTS: false, READ_STEPS: false } });
    checkPermissions.mockResolvedValue({ permissions: {} });

    await expect(new CapacitorHealthProvider().requestPermissions()).resolves.toBe(false);
  });

  it('gives up on a permission dialog that never answers', async () => {
    // An activity recreated while the dialog is up loses the call it would have
    // resolved. Awaiting that directly left `requestPermissions` pending for the
    // whole session, and with it every import behind it.
    vi.useFakeTimers();
    requestHealthPermissions.mockResolvedValue({ permissions: { READ_STEPS: true } });
    checkPermissions.mockResolvedValue({ permissions: {} });
    requestPermissions.mockReturnValue(new Promise(() => {}));

    const settled = new CapacitorHealthProvider().requestPermissions();
    await vi.advanceTimersByTimeAsync(120_000);

    // Steps were granted, so there is still a sync worth running.
    await expect(settled).resolves.toBe(true);
  });
});
