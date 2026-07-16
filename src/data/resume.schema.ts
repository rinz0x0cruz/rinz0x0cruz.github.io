import { z } from 'astro/zod';

const requiredText = z.string().trim().min(1);
const yearMonthSchema = z
  .string()
  .regex(/^(?:19|20)\d{2}-(?:0[1-9]|1[0-2])$/, 'Expected a valid YYYY-MM date.');
const httpUrlSchema = z.url().refine((value) => /^https?:\/\//i.test(value), {
  message: 'Expected an HTTP(S) URL.',
});

export const resumeLinksSchema = z
  .object({
    linkedin: httpUrlSchema,
    github: httpUrlSchema,
  })
  .strict();

export const resumeBasicsSchema = z
  .object({
    name: requiredText,
    role: requiredText,
    location: requiredText,
    email: z.email(),
    phone: requiredText,
    links: resumeLinksSchema,
    summary: requiredText,
  })
  .strict();

export const workRoleSchema = z
  .object({
    org: requiredText,
    title: requiredText,
    blurb: z.string().trim().min(1).nullable(),
    location: requiredText,
    start: yearMonthSchema,
    end: yearMonthSchema.nullable(),
    tag: requiredText.optional(),
    logo: z.string().regex(/^\/[A-Za-z0-9._/-]+$/).nullable().optional(),
    volunteer: z.boolean().optional(),
  })
  .strict()
  .superRefine((role, context) => {
    if (role.end && role.end < role.start) {
      context.addIssue({
        code: 'custom',
        path: ['end'],
        message: 'Role end date cannot be before its start date.',
      });
    }
  });

export const resumeSkillGroupSchema = z
  .object({
    category: requiredText,
    items: z.array(requiredText).min(1),
  })
  .strict();

export const resumeProjectSchema = z
  .object({
    name: requiredText,
    blurb: z.string(),
    tech: requiredText,
    url: httpUrlSchema.nullable(),
  })
  .strict();

export const resumeEducationSchema = z
  .object({
    school: requiredText,
    degree: requiredText,
    start: yearMonthSchema,
    end: yearMonthSchema.nullable(),
    note: z.string(),
  })
  .strict()
  .superRefine((education, context) => {
    if (education.end && education.end < education.start) {
      context.addIssue({
        code: 'custom',
        path: ['end'],
        message: 'Education end date cannot be before its start date.',
      });
    }
  });

function uniqueBy<T>(items: T[], key: (item: T) => string) {
  const seen = new Set<string>();
  return items.every((item) => {
    const value = key(item).toLowerCase();
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

export const resumeSchema = z
  .object({
    basics: resumeBasicsSchema,
    work: z.array(workRoleSchema).min(1),
    skills: z.array(resumeSkillGroupSchema).min(1),
    projects: z.array(resumeProjectSchema),
    education: z.array(resumeEducationSchema).min(1),
    certifications: z.array(requiredText),
    languages: z.array(requiredText),
  })
  .strict()
  .superRefine((resume, context) => {
    if (!uniqueBy(resume.work, (role) => `${role.org}\0${role.title}`)) {
      context.addIssue({ code: 'custom', path: ['work'], message: 'Work roles must be unique by organization and title.' });
    }
    if (!uniqueBy(resume.skills, (group) => group.category)) {
      context.addIssue({ code: 'custom', path: ['skills'], message: 'Skill categories must be unique.' });
    }
  });

export type ResumeLinks = z.infer<typeof resumeLinksSchema>;
export type ResumeBasics = z.infer<typeof resumeBasicsSchema>;
export type WorkRole = z.infer<typeof workRoleSchema>;
export type ResumeSkillGroup = z.infer<typeof resumeSkillGroupSchema>;
export type ResumeProject = z.infer<typeof resumeProjectSchema>;
export type ResumeEducation = z.infer<typeof resumeEducationSchema>;
export type Resume = z.infer<typeof resumeSchema>;