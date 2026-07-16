import { describe, expect, it } from 'vitest';
import { evaluateFreshness } from '../scripts/lib/freshness.mjs';

describe('evidence freshness policy', () => {
  it('separates current, warning, and hard-expired snapshots', () => {
    const result = evaluateFreshness(
      [
        { label: 'Current', snapshotDate: '2026-07-16' },
        { label: 'Warning', snapshotDate: '2026-04-16' },
        { label: 'Expired', snapshotDate: '2026-01-16' },
      ],
      '2026-07-16',
    );
    expect(result.records.map((record: { label: string; level: string }) => [record.label, record.level])).toEqual([
      ['Current', 'current'],
      ['Warning', 'warning'],
      ['Expired', 'expired'],
    ]);
    expect(result.warnings.map((record: { label: string }) => record.label)).toEqual(['Warning', 'Expired']);
    expect(result.expired.map((record: { label: string }) => record.label)).toEqual(['Expired']);
  });

  it('rejects future or invalid snapshots', () => {
    expect(() => evaluateFreshness([{ label: 'Future', snapshotDate: '2026-07-17' }], '2026-07-16')).toThrow(
      'in the future',
    );
    expect(() => evaluateFreshness([{ label: 'Invalid', snapshotDate: 'not-a-date' }], '2026-07-16')).toThrow(
      'invalid snapshot date',
    );
  });
});