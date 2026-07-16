import { z } from 'astro/zod';

const tagSchema = z.string().trim().min(1, 'Tags cannot be empty.').max(40);
const sourceSchema = z.strictObject({
  label: z.string().trim().min(1).max(120),
  url: z.url({ protocol: /^https$/, error: 'Source URLs must use HTTPS.' }),
  accessed: z.coerce.date(),
});

export const writeupSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(120),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    snapshotDate: z.coerce.date(),
    summary: z.string().trim().max(240),
    sources: z
      .array(sourceSchema)
      .max(12)
      .default([])
      .refine((sources) => new Set(sources.map((source) => source.url)).size === sources.length, {
        message: 'Source URLs must be unique.',
      }),
    tags: z
      .array(tagSchema)
      .max(8)
      .default([])
      .refine((tags) => new Set(tags.map((tag) => tag.toLowerCase())).size === tags.length, {
        message: 'Tags must be unique.',
      }),
    draft: z.boolean().default(false),
  })
  .superRefine((writeup, context) => {
    const effectiveDate = writeup.updated ?? writeup.date;
    if (writeup.updated && writeup.updated < writeup.date) {
      context.addIssue({
        code: 'custom',
        path: ['updated'],
        message: 'Updated date cannot be earlier than the publication date.',
      });
    }
    if (writeup.snapshotDate > effectiveDate) {
      context.addIssue({
        code: 'custom',
        path: ['snapshotDate'],
        message: 'Evidence snapshot cannot be newer than the authored content.',
      });
    }
    writeup.sources.forEach((source, index) => {
      if (source.accessed > effectiveDate) {
        context.addIssue({
          code: 'custom',
          path: ['sources', index, 'accessed'],
          message: 'Source access date cannot be newer than the authored content.',
        });
      }
    });
    if (!writeup.draft && writeup.summary.length < 20) {
      context.addIssue({
        code: 'custom',
        path: ['summary'],
        message: 'Published writeups need a summary of at least 20 characters.',
      });
    }
    if (!writeup.draft && writeup.sources.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['sources'],
        message: 'Published writeups need at least one evidence source.',
      });
    }
  });

export type WriteupData = z.infer<typeof writeupSchema>;