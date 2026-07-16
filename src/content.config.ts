import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { createWorkCollectionSchema } from '@/content/work-schema';
import { writeupSchema } from '@/content/writeup-schema';

// Writeups / blog. Uses Astro's content-layer glob loader.
const writeups = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writeups' }),
  schema: writeupSchema,
});

const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: ({ image }) => createWorkCollectionSchema(image),
});

export const collections = { work, writeups };
