import { describe, expect, it } from 'vitest';
import { analyticsCampaignSources } from '../src/data/analytics';

describe('analytics campaign sources', () => {
  it('accepts four current resumes and preserves retired role links', () => {
    expect(analyticsCampaignSources).toEqual(expect.arrayContaining([
      'resume_general',
      'resume_security_researcher',
      'resume_security_engineer',
      'resume_malware_analyst',
      'resume_security_analyst',
      'resume_threat_hunter',
    ]));
    expect(new Set(analyticsCampaignSources).size).toBe(analyticsCampaignSources.length);
    expect(analyticsCampaignSources.every((source) => /^[a-z0-9_]+$/u.test(source))).toBe(true);
  });
});
