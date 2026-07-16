import { describe, expect, it } from 'vitest';
import { workSourceSchema } from '../src/content/work-schema';

const project = {
  kind: 'project',
  sourceId: 'exploitrank',
  published: '2026-07-16',
  snapshotDate: '2026-07-16',
  heroImage: '../../assets/work/exploitrank/hero.png',
  heroAlt: 'ExploitRank decision dashboard with a bounded review queue',
  evidence: [
    { label: 'Decision model', detail: 'Signals resolve into an inspectable prioritization decision.' },
    { label: 'Offline path', detail: 'The generated dashboard remains useful without runtime services.' },
  ],
  draft: false,
};

describe('work content schema', () => {
  it('accepts project and redacted case-study entries', () => {
    expect(workSourceSchema.safeParse(project).success).toBe(true);
    expect(
      workSourceSchema.safeParse({
        ...project,
        kind: 'case-study',
        sourceId: 'midnight-blizzard',
        confidentialityNote: 'Client-identifying evidence and raw telemetry are intentionally omitted.',
      }).success,
    ).toBe(true);
  });

  it('rejects unstable IDs, misplaced images, and duplicate evidence labels', () => {
    const result = workSourceSchema.safeParse({
      ...project,
      sourceId: 'Exploit Rank',
      heroImage: '/work-exploitrank.png',
      evidence: [project.evidence[0], { ...project.evidence[1], label: 'decision model' }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const messages = result.error.issues.map((issue) => issue.message).join('\n');
    expect(messages).toContain('lowercase kebab-case');
    expect(messages).toContain('src/assets/work');
    expect(messages).toContain('Evidence labels must be unique');
  });

  it('rejects dates that contradict authored provenance', () => {
    const result = workSourceSchema.safeParse({
      ...project,
      updated: '2026-07-15',
      snapshotDate: '2026-07-17',
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.path.join('.'))).toEqual(
      expect.arrayContaining(['updated', 'snapshotDate']),
    );
  });
});