import { describe, it, expect } from 'vitest';
import { projectPrefix, taskCode } from '../lib/projectCode.js';

describe('projectPrefix', () => {
  it('returns initials for multi-word names', () => {
    expect(projectPrefix('Demo Project')).toBe('DP');
    expect(projectPrefix('Q3 Onboarding Sprint')).toBe('QOS');
    expect(projectPrefix('Internal Delivery')).toBe('ID');
  });

  it('takes first 3 chars for single-word names', () => {
    expect(projectPrefix('Onboarding')).toBe('ONB');
    expect(projectPrefix('Sales')).toBe('SAL');
  });

  it('caps at 4 chars for very long names', () => {
    expect(projectPrefix('A B C D E F G')).toBe('ABCD');
  });

  it('falls back for empty/missing names', () => {
    expect(projectPrefix('')).toBe('PRJ');
    expect(projectPrefix(undefined)).toBe('PRJ');
    expect(projectPrefix('   ')).toBe('PRJ');
  });
});

describe('taskCode', () => {
  it('combines prefix and id with dash', () => {
    expect(taskCode('Q3 Onboarding Sprint', 12)).toBe('QOS-12');
    expect(taskCode('Demo Project', 1)).toBe('DP-1');
  });
});
