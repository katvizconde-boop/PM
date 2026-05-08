import { describe, it, expect } from 'vitest';
import { toCSV } from '../lib/csv.js';

describe('toCSV', () => {
  const cols = [
    { label: 'Name', value: 'name' },
    { label: 'Note', value: 'note' },
  ];

  it('emits header + rows', () => {
    const csv = toCSV([{ name: 'A', note: 'one' }, { name: 'B', note: 'two' }], cols);
    expect(csv).toBe('Name,Note\nA,one\nB,two\n');
  });

  it('quotes cells with commas, quotes, or newlines', () => {
    const csv = toCSV([
      { name: 'comma, here', note: 'plain' },
      { name: 'has "quotes"', note: 'plain' },
      { name: 'with\nnewline', note: 'plain' },
    ], cols);
    expect(csv).toContain('"comma, here"');
    expect(csv).toContain('"has ""quotes"""');
    expect(csv).toContain('"with\nnewline"');
  });

  it('handles null/undefined as empty cell', () => {
    const csv = toCSV([{ name: null, note: undefined }], cols);
    expect(csv).toBe('Name,Note\n,\n');
  });

  it('supports computed columns (function value)', () => {
    const csv = toCSV(
      [{ a: 1, b: 2 }],
      [{ label: 'sum', value: (r) => r.a + r.b }]
    );
    expect(csv).toBe('sum\n3\n');
  });
});
