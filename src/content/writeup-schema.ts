import { z } from 'astro/zod';

const tagSchema = z.string().trim().min(1, 'Tags cannot be empty.').max(40);

export const writeupSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(120),
    date: z.coerce.date(),
    summary: z.string().trim().max(240),
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
    if (!writeup.draft && writeup.summary.length < 20) {
      context.addIssue({
        code: 'custom',
        path: ['summary'],
        message: 'Published writeups need a summary of at least 20 characters.',
      });
    }
  });

export type WriteupData = z.infer<typeof writeupSchema>;