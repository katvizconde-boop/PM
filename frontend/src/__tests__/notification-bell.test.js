import { describe, it, expect } from 'vitest';
import { countUnread } from '../components/NotificationBell.jsx';

const mk = (iso) => ({ id: iso, created_at: iso });

describe('countUnread', () => {
  it('counts only items strictly newer than lastSeen', () => {
    const items = [
      mk('2026-05-06T12:00:00Z'),
      mk('2026-05-06T11:00:00Z'),
      mk('2026-05-06T10:00:00Z'),
    ];
    const lastSeen = new Date('2026-05-06T11:00:00Z').getTime();
    // Only the 12:00 item is strictly newer.
    expect(countUnread(items, lastSeen)).toBe(1);
  });

  it('returns all items when lastSeen is 0 (first visit)', () => {
    const items = [mk('2026-05-06T12:00:00Z'), mk('2026-05-06T11:00:00Z')];
    expect(countUnread(items, 0)).toBe(2);
  });

  it('returns 0 when nothing is newer', () => {
    const items = [mk('2020-01-01T10:00:00Z')];
    const future = Date.now() + 60_000;
    expect(countUnread(items, future)).toBe(0);
  });

  it('returns 0 for an empty feed', () => {
    expect(countUnread([], 0)).toBe(0);
  });
});
