import { describe, it, expect } from 'vitest';
import { formatDuration, sumDurations } from '../lib/time.js';

describe('formatDuration', () => {
  it('formats sub-minute durations', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(45)).toBe('00:45');
  });

  it('formats minute-only durations', () => {
    expect(formatDuration(60)).toBe('01:00');
    expect(formatDuration(125)).toBe('02:05');
  });

  it('formats hour-and-up durations', () => {
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(36000)).toBe('10:00:00');
  });

  it('clamps negative + nullish input to zero', () => {
    expect(formatDuration(-5)).toBe('00:00');
    expect(formatDuration(null)).toBe('00:00');
    expect(formatDuration(undefined)).toBe('00:00');
  });
});

describe('sumDurations', () => {
  it('sums an array of entries', () => {
    expect(sumDurations([{ duration_seconds: 60 }, { duration_seconds: 120 }])).toBe(180);
  });
  it('treats null/missing duration as 0 (running entries)', () => {
    expect(sumDurations([{ duration_seconds: null }, { duration_seconds: 30 }])).toBe(30);
    expect(sumDurations([{}, { duration_seconds: 10 }])).toBe(10);
  });
  it('handles empty/null input', () => {
    expect(sumDurations([])).toBe(0);
    expect(sumDurations(null)).toBe(0);
  });
});
