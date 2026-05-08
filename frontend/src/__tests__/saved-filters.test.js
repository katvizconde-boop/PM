import { describe, it, expect } from 'vitest';
import { apply } from '../lib/savedFilters.js';

const today = new Date().toISOString().slice(0, 10);
const past  = '2020-01-01';
const futureDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

const t = (over) => ({
  status: 'todo', priority: 'medium', assignee_id: 1, tags: [], due_date: futureDate,
  ...over,
});

describe('savedFilters.apply', () => {
  it('returns input unchanged when filter is empty', () => {
    const tasks = [t(), t()];
    expect(apply(tasks, {})).toEqual(tasks);
    expect(apply(tasks, undefined)).toEqual(tasks);
  });

  it('filters by status', () => {
    const tasks = [t({ status: 'done' }), t({ status: 'todo' })];
    expect(apply(tasks, { status: 'done' })).toHaveLength(1);
  });

  it('filters by priority', () => {
    const tasks = [t({ priority: 'urgent' }), t({ priority: 'low' })];
    expect(apply(tasks, { priority: 'urgent' })).toHaveLength(1);
  });

  it('filters by assignee_id', () => {
    const tasks = [t({ assignee_id: 1 }), t({ assignee_id: 2 })];
    expect(apply(tasks, { assignee_id: 2 })).toHaveLength(1);
  });

  it('filters by tag membership', () => {
    const tasks = [t({ tags: ['client-a', 'review'] }), t({ tags: ['client-b'] })];
    expect(apply(tasks, { tag: 'review' })).toHaveLength(1);
  });

  it('filters overdue (past due + not done)', () => {
    const tasks = [
      t({ status: 'todo', due_date: past }),       // overdue
      t({ status: 'done', due_date: past }),       // done — excluded
      t({ status: 'todo', due_date: futureDate }), // not yet due
    ];
    expect(apply(tasks, { overdue: true })).toHaveLength(1);
  });

  it('combines multiple filters with AND', () => {
    const tasks = [
      t({ status: 'todo', priority: 'urgent' }),
      t({ status: 'todo', priority: 'low' }),
    ];
    expect(apply(tasks, { status: 'todo', priority: 'urgent' })).toHaveLength(1);
  });
});
