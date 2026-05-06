import { describe, it, expect } from 'vitest';
import { buildMonthGrid } from '../pages/Calendar.jsx';

describe('buildMonthGrid', () => {
  it('returns 42 cells (6 weeks × 7 days)', () => {
    const grid = buildMonthGrid(2026, 4); // May 2026
    expect(grid).toHaveLength(42);
  });

  it('cells are Monday-first', () => {
    // 2026-05-01 is a Friday → first Monday in grid is 2026-04-27.
    const grid = buildMonthGrid(2026, 4);
    expect(grid[0].iso).toBe('2026-04-27');
    expect(grid[0].date.getDay()).toBe(1); // Monday
  });

  it('marks days outside the requested month', () => {
    const grid = buildMonthGrid(2026, 4); // May
    // First few cells are end-of-April, last few cells are early June.
    expect(grid[0].inMonth).toBe(false);
    expect(grid.find(c => c.iso === '2026-05-01').inMonth).toBe(true);
    expect(grid[41].inMonth).toBe(false);
  });

  it('handles February in a non-leap year', () => {
    const grid = buildMonthGrid(2026, 1); // Feb 2026 (28 days)
    const inFeb = grid.filter(c => c.inMonth);
    expect(inFeb).toHaveLength(28);
  });
});
