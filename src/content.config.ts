import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { writeupSchema } from '@/content/writeup-schema';

// Writeups / blog. Uses Astro's content-layer glob loader.
const writeups = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writeups' }),
  schema: writeupSchema,
});

export const collections = { writeups };
