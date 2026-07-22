import { readdirSync, readFileSync } from 'node:fs';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import {
  about,
  achievements,
  caseStudies,
  intro,
  projectDemos,
  publicProfiles,
} from '../src/data/portfolio';
import { projects } from '../src/data/projects';
import { site } from '../src/data/site';
import { resolveWorkRecord } from '../src/utils/work';

function expectUnique(values: readonly string[]) {
  expect(new Set(values).size).toBe(values.length);
}

describe('plug-and-play portfolio content', () => {
  it('keeps the identity statement and current focus complete', () => {
    expect(intro.eyebrow.length).toBeGreaterThan(10);
    expect(intro.statement.length).toBeGreaterThan(40);
    expect(intro.signalTerms).toHaveLength(3);
    expectUnique(intro.signalTerms);
    expect(intro.currentFocus.length).toBeGreaterThan(0);
    expectUnique(intro.currentFocus);
    const featuredSocials = site.socials.filter((social) => social.featured);
    expect(featuredSocials.length).toBeGreaterThan(0);
    expectUnique(featuredSocials.map((social) => social.name));
  });

  it('defines additive curated capability groups', () => {
    expect(about.statement.length).toBeGreaterThan(40);
    expect(about.capabilities.length).toBeGreaterThan(0);
    expectUnique(about.capabilities.map((group) => group.category));
    for (const group of about.capabilities) {
      expect(group.items.length).toBeGreaterThan(0);
      expectUnique(group.items);
    }
  });

  it('defines distinct, complete featured outcomes', () => {
    expect(achievements.length).toBeGreaterThanOrEqual(4);
    expectUnique(achievements.map((achievement) => achievement.label));
    for (const achievement of achievements) {
      expect(achievement.value.trim()).not.toBe('');
      expect(achievement.detail.length).toBeGreaterThan(30);
    }
  });

  it('defines self-contained interactive project demos', () => {
    expect(projectDemos.length).toBeGreaterThanOrEqual(2);
    expectUnique(projects.map((project) => project.sourceId));
    expect(projects.every((project) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.sourceId))).toBe(true);
    expectUnique(projectDemos.map((demo) => demo.name.toLowerCase()));
    expectUnique(projectDemos.map((demo) => demo.projectSourceId));
    for (const demo of projectDemos) {
      expect(projects.some((project) => project.sourceId === demo.projectSourceId)).toBe(true);
      expect(demo.theme.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(demo.theme.media).toHaveLength(3);
      expect(demo.telemetry.length).toBeGreaterThan(0);
      expect(demo.activity.length).toBeGreaterThan(0);
      expect(demo.hotspots.length).toBeGreaterThan(0);
      expectUnique(demo.hotspots.map((hotspot) => hotspot.title));
      expectUnique(demo.hotspots.map((hotspot) => hotspot.id));
      for (const hotspot of demo.hotspots) {
        expect(hotspot.id).toMatch(/^[a-z0-9]+(?:_[a-z0-9]+)*$/);
        expect(hotspot.x).toBeGreaterThan(0);
        expect(hotspot.x).toBeLessThan(100);
        expect(hotspot.y).toBeGreaterThan(0);
        expect(hotspot.y).toBeLessThan(100);
      }
    }
  });

  it('defines complete professional case studies', () => {
    expect(caseStudies.length).toBeGreaterThanOrEqual(3);
    expectUnique(caseStudies.map((study) => study.sourceId));
    expect(caseStudies.every((study) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(study.sourceId))).toBe(true);
    expectUnique(caseStudies.map((study) => study.title));
    for (const study of caseStudies) {
      expect(study.approach.length).toBeGreaterThan(0);
      expect(study.outcome.length).toBeGreaterThan(30);
      expect(study.metric.trim()).not.toBe('');
    }
  });

  it('resolves stable work IDs through one canonical lookup', () => {
    for (const project of projects) {
      expect(resolveWorkRecord('project', project.sourceId).record).toBe(project);
    }
    for (const study of caseStudies) {
      expect(resolveWorkRecord('case-study', study.sourceId).record).toBe(study);
    }
    expect(() => resolveWorkRecord('project', 'missing-project')).toThrow('Unknown project sourceId');
  });

  it('keeps public profiles extensible', () => {
    expect(publicProfiles.length).toBeGreaterThanOrEqual(2);
    expectUnique(publicProfiles.map((profile) => profile.name));
    for (const profile of publicProfiles) {
      expect(new URL(profile.url).protocol).toBe('https:');
      expect(profile.metrics.length).toBeGreaterThan(0);
      expectUnique(profile.metrics.map((metric) => metric.label));
      expect(profile.verifiedAt).toContain('2026');
      expect(profile.snapshotDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('publishes an additive set of ExploitRank-backed blogs', () => {
    const contentDirectory = new URL('../src/content/writeups/', import.meta.url);
    const files = readdirSync(contentDirectory).filter((file) => file.endsWith('.md')).sort();
    const publishedFiles = files.filter((file) => !matter(readFileSync(new URL(file, contentDirectory), 'utf8')).data.draft);
    expect(publishedFiles.length).toBeGreaterThanOrEqual(2);
    for (const file of publishedFiles) {
      const source = readFileSync(new URL(file, contentDirectory), 'utf8');
      const frontmatter = matter(source).data;
      expect(source).toContain('ExploitRank');
      expect(source).toContain('2026-07');
      expect(frontmatter.snapshotDate).toBeInstanceOf(Date);
      expect(frontmatter.sources.length).toBeGreaterThan(0);
      expect(frontmatter.sources.every((entry: { url: string }) => entry.url.startsWith('https://'))).toBe(true);
    }
  });
});