import { z } from 'astro/zod';

const sourceIdSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Source IDs must be lowercase kebab-case.');

const workImagePathSchema = z
  .string()
  .trim()
  .regex(
    /^\.\.\/\.\.\/assets\/work\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:avif|jpe?g|png|svg|webp)$/,
    'Work images must be stored under src/assets/work/<source-id>/.',
  );

const evidenceSchema = z.strictObject({
  label: z.string().trim().min(1).max(60),
  detail: z.string().trim().min(20).max(240),
});

const evidenceListSchema = z
  .array(evidenceSchema)
  .min(2, 'Published work needs at least two evidence points.')
  .max(8)
  .refine(
    (evidence) => new Set(evidence.map((item) => item.label.toLowerCase())).size === evidence.length,
    'Evidence labels must be unique.',
  );

const commonFields = <TImageSchema extends z.ZodTypeAny>(heroImage: TImageSchema) => ({
  sourceId: sourceIdSchema,
  published: z.coerce.date(),
  updated: z.coerce.date().optional(),
  snapshotDate: z.coerce.date(),
  heroImage,
  heroAlt: z.string().trim().min(12).max(180),
  evidence: evidenceListSchema,
  draft: z.boolean().default(false),
});

function createWorkSchema<TImageSchema extends z.ZodTypeAny>(heroImage: TImageSchema) {
  return z
    .discriminatedUnion('kind', [
      z.strictObject({
        kind: z.literal('project'),
        ...commonFields(heroImage),
      }),
      z.strictObject({
        kind: z.literal('case-study'),
        ...commonFields(heroImage),
        confidentialityNote: z.string().trim().min(20).max(280),
      }),
    ])
    .superRefine((work, context) => {
      const effectiveDate = work.updated ?? work.published;
      if (work.updated && work.updated < work.published) {
        context.addIssue({
          code: 'custom',
          path: ['updated'],
          message: 'Updated date cannot be earlier than the published date.',
        });
      }
      if (work.snapshotDate > effectiveDate) {
        context.addIssue({
          code: 'custom',
          path: ['snapshotDate'],
          message: 'Evidence snapshot cannot be newer than the authored content.',
        });
      }
    });
}

export const workSourceSchema = createWorkSchema(workImagePathSchema);

export const createWorkCollectionSchema = <TImageSchema extends z.ZodTypeAny>(image: () => TImageSchema) =>
  createWorkSchema(image());

export type WorkSourceData = z.infer<typeof workSourceSchema>;