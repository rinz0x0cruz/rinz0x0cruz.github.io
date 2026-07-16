import { describe, expect, it } from 'vitest';
import type { WorkRole } from '../src/data/resume';
import { calculateExperience, monthIndex, utcMonthIndex } from '../src/utils/experience';

function role(overrides: Partial<WorkRole> = {}): WorkRole {
  return {
    org: 'Example',
    title: 'Researcher',
    blurb: null,
    location: 'Remote',
    start: '2025-01',
    end: '2025-03',
    ...overrides,
  };
}

describe('experience calculation', () => {
  it('uses UTC month indexes', () => {
    expect(monthIndex('2025-01')).toBe(2025 * 12);
    expect(utcMonthIndex(new Date('2025-07-31T23:30:00-07:00'))).toBe(2025 * 12 + 7);
  });

  it('merges overlapping and adjacent ranges without double counting', () => {
    const summary = calculateExperience(
      [
        role({ start: '2025-01', end: '2025-03' }),
        role({ org: 'Other', title: 'Analyst', start: '2025-03', end: '2025-05' }),
        role({ org: 'Third', title: 'Intern', start: '2025-06', end: '2025-07' }),
      ],
      new Date('2025-08-01T00:00:00Z')
    );
    expect(summary).toEqual({ monthsWorked: 7, yearsDisplay: '0.6', roleCount: 3, organizationCount: 3 });
  });

  it('does not count gaps and uses the injected month for current roles', () => {
    const summary = calculateExperience(
      [role(), role({ org: 'Other', title: 'Current', start: '2025-06', end: null })],
      new Date('2025-08-15T12:00:00Z')
    );
    expect(summary.monthsWorked).toBe(6);
  });

  it('excludes volunteer roles and handles an empty list', () => {
    expect(calculateExperience([role({ volunteer: true })], new Date('2025-08-01T00:00:00Z'))).toEqual({
      monthsWorked: 0,
      yearsDisplay: '0.0',
      roleCount: 0,
      organizationCount: 0,
    });
    expect(calculateExperience([], new Date('2025-08-01T00:00:00Z')).monthsWorked).toBe(0);
  });

  it('rejects malformed dates, reverse ranges, and invalid as-of values', () => {
    expect(() => monthIndex('2025-13')).toThrow(/Invalid year-month/);
    expect(() => calculateExperience([role({ start: '2025-04', end: '2025-03' })], new Date())).toThrow(
      /ends before it starts/
    );
    expect(() => calculateExperience([], new Date('invalid'))).toThrow(/Invalid as-of date/);
  });
});