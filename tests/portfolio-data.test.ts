import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  achievements,
  caseStudies,
  intro,
  projectDemos,
  publicProfiles,
} from '../src/data/portfolio';

function expectUnique(values: readonly string[]) {
  expect(new Set(values).size).toBe(values.length);
}

describe('plug-and-play portfolio content', () => {
  it('keeps the identity statement and current focus complete', () => {
    expect(intro.eyebrow.length).toBeGreaterThan(10);
    expect(intro.statement.length).toBeGreaterThan(40);
    expect(intro.currentFocus).toHaveLength(3);
    expectUnique(intro.currentFocus);
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
    expect(projectDemos).toHaveLength(2);
    expectUnique(projectDemos.map((demo) => demo.name.toLowerCase()));
    for (const demo of projectDemos) {
      expect(demo.image).toMatch(/^\/[a-z0-9-]+\.png$/);
      expect(demo.telemetry).toHaveLength(3);
      expect(demo.hotspots.length).toBeGreaterThanOrEqual(3);
      expectUnique(demo.hotspots.map((hotspot) => hotspot.title));
      for (const hotspot of demo.hotspots) {
        expect(hotspot.x).toBeGreaterThan(0);
        expect(hotspot.x).toBeLessThan(100);
        expect(hotspot.y).toBeGreaterThan(0);
        expect(hotspot.y).toBeLessThan(100);
      }
    }
  });

  it('defines complete professional case studies', () => {
    expect(caseStudies.length).toBeGreaterThanOrEqual(3);
    expectUnique(caseStudies.map((study) => study.title));
    for (const study of caseStudies) {
      expect(study.approach).toHaveLength(3);
      expect(study.outcome.length).toBeGreaterThan(30);
      expect(study.metric.trim()).not.toBe('');
    }
  });

  it('keeps public profiles extensible', () => {
    expect(publicProfiles).toHaveLength(2);
    expectUnique(publicProfiles.map((profile) => profile.name));
    for (const profile of publicProfiles) {
      expect(new URL(profile.url).protocol).toBe('https:');
      expect(profile.metrics).toHaveLength(3);
      expectUnique(profile.metrics.map((metric) => metric.label));
      expect(profile.verifiedAt).toContain('2026');
    }
  });

  it('publishes exactly two ExploitRank-backed blogs', () => {
    const contentDirectory = new URL('../src/content/writeups/', import.meta.url);
    const files = readdirSync(contentDirectory).filter((file) => file.endsWith('.md')).sort();
    expect(files).toEqual([
      'one-cve-301-ransomware-signals.md',
      'patch-by-exploitability-not-cvss.md',
    ]);
    for (const file of files) {
      const source = readFileSync(new URL(file, contentDirectory), 'utf8');
      expect(source).toContain('ExploitRank');
      expect(source).toContain('2026-07');
    }
  });
});