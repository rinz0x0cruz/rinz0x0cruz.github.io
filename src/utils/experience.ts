import type { WorkRole } from '@/data/resume';

export interface ExperienceSummary {
  monthsWorked: number;
  yearsDisplay: string;
  roleCount: number;
  organizationCount: number;
}

export function monthIndex(yearMonth: string): number {
  const match = yearMonth.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!match) throw new Error(`Invalid year-month: ${yearMonth}`);
  return Number(match[1]) * 12 + Number(match[2]) - 1;
}

export function utcMonthIndex(date: Date): number {
  if (Number.isNaN(date.getTime())) throw new Error('Invalid as-of date.');
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

export function calculateExperience(roles: readonly WorkRole[], asOf: Date): ExperienceSummary {
  const officialRoles = roles.filter((role) => !role.volunteer);
  const asOfIndex = utcMonthIndex(asOf);
  const intervals = officialRoles
    .map((role) => {
      const start = monthIndex(role.start);
      const end = role.end ? monthIndex(role.end) : asOfIndex;
      if (end < start) throw new Error(`Role ends before it starts: ${role.org} / ${role.title}`);
      return { start, end };
    })
    .sort((left, right) => left.start - right.start);

  let monthsWorked = 0;
  let blockStart = -1;
  let blockEnd = -2;
  for (const interval of intervals) {
    if (interval.start > blockEnd + 1) {
      if (blockStart >= 0) monthsWorked += blockEnd - blockStart + 1;
      blockStart = interval.start;
      blockEnd = interval.end;
    } else {
      blockEnd = Math.max(blockEnd, interval.end);
    }
  }
  if (blockStart >= 0) monthsWorked += blockEnd - blockStart + 1;

  return {
    monthsWorked,
    yearsDisplay: (monthsWorked / 12).toFixed(1),
    roleCount: officialRoles.length,
    organizationCount: new Set(officialRoles.map((role) => role.org)).size,
  };
}