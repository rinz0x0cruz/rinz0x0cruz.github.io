import { caseStudies, type CaseStudy } from '../data/portfolio';
import { projects, type Project } from '../data/projects';

export type WorkRecord =
  | { kind: 'project'; record: Project }
  | { kind: 'case-study'; record: CaseStudy };

export function resolveWorkRecord(kind: WorkRecord['kind'], sourceId: string): WorkRecord {
  if (kind === 'project') {
    const record = projects.find((project) => project.sourceId === sourceId);
    if (!record) throw new Error(`Unknown project sourceId: ${sourceId}`);
    return { kind, record };
  }

  const record = caseStudies.find((study) => study.sourceId === sourceId);
  if (!record) throw new Error(`Unknown case-study sourceId: ${sourceId}`);
  return { kind, record };
}