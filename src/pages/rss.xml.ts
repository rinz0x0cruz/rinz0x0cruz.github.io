import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { site } from '@/data/site';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const writeups = (await getCollection('writeups'))
    .filter((w) => !w.data.draft)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

  return rss({
    title: `${site.name} · Writeups`,
    description: site.tagline,
    site: context.site ?? site.url,
    items: writeups.map((w) => ({
      title: w.data.title,
      description: w.data.summary,
      pubDate: w.data.date,
      categories: w.data.tags,
      link: `/writeups/${w.id}/`,
    })),
  });
}
