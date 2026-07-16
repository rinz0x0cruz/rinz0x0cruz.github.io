import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import matter from 'gray-matter';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { workSourceSchema } from '../../src/content/work-schema.ts';
import { writeupSchema } from '../../src/content/writeup-schema.ts';
import { caseStudies } from '../../src/data/portfolio.ts';
import { projects } from '../../src/data/projects.ts';

export const maxWriteupBytes = 128 * 1024;
export const maxWorkBytes = 128 * 1024;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const projectSourceIds = new Set(projects.map((project) => project.sourceId));
const caseStudySourceIds = new Set(caseStudies.map((study) => study.sourceId));

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? markdownFiles(path) : extname(entry.name) === '.md' ? [path] : [];
    })
  );
  return nested.flat().sort();
}

function walk(node, visit) {
  visit(node);
  if (Array.isArray(node.children)) node.children.forEach((child) => walk(child, visit));
}

function safeUrl(value, kind) {
  const url = value.trim();
  if (url.startsWith('#') || url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
    return !url.startsWith('//');
  }
  try {
    const protocol = new URL(url).protocol;
    return kind === 'image'
      ? protocol === 'http:' || protocol === 'https:'
      : protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:';
  } catch {
    return false;
  }
}

function formatIssues(issues) {
  return issues.map((issue) => `${issue.path.join('.') || 'frontmatter'}: ${issue.message}`).join('; ');
}

function validateMarkdownSource({
  displayPath,
  relativePath,
  source,
  size,
  schema,
  maxBytes,
  contentLabel,
}) {
  const failures = [];
  const normalizedPath = relativePath.split(sep).join('/');
  const slug = normalizedPath.slice(0, -extname(normalizedPath).length);

  if (!slugPattern.test(slug)) {
    failures.push(`${displayPath}: slug must contain only lowercase letters, numbers, and single hyphens`);
  }
  if (size > maxBytes) {
    failures.push(`${displayPath}: ${size} bytes exceeds the ${maxBytes}-byte limit`);
  }

  let parsed;
  try {
    parsed = matter(source);
  } catch (error) {
    failures.push(`${displayPath}: invalid frontmatter (${error.message})`);
    return { failures, slug };
  }

  const result = schema.safeParse(parsed.data);
  if (!result.success) failures.push(`${displayPath}: ${formatIssues(result.error.issues)}`);
  if (!parsed.content.trim()) failures.push(`${displayPath}: ${contentLabel} body cannot be empty`);

  let tree;
  try {
    tree = fromMarkdown(parsed.content);
  } catch (error) {
    failures.push(`${displayPath}: invalid Markdown (${error.message})`);
    return { failures, slug };
  }

  walk(tree, (node) => {
    if (node.type === 'html') failures.push(`${displayPath}: raw HTML is not allowed`);
    if ((node.type === 'link' || node.type === 'definition') && !safeUrl(node.url, 'link')) {
      failures.push(`${displayPath}: unsafe link URL "${node.url}"`);
    }
    if (node.type === 'image' && !safeUrl(node.url, 'image')) {
      failures.push(`${displayPath}: unsafe image URL "${node.url}"`);
    }
  });

  return { failures, slug, data: result.success ? result.data : undefined };
}

export function validateWriteupSource({ displayPath, relativePath, source, size = Buffer.byteLength(source) }) {
  return validateMarkdownSource({
    displayPath,
    relativePath,
    source,
    size,
    schema: writeupSchema,
    maxBytes: maxWriteupBytes,
    contentLabel: 'writeup',
  });
}

export function validateWorkSource({ displayPath, relativePath, source, size = Buffer.byteLength(source) }) {
  const result = validateMarkdownSource({
    displayPath,
    relativePath,
    source,
    size,
    schema: workSourceSchema,
    maxBytes: maxWorkBytes,
    contentLabel: 'work entry',
  });

  if (result.data?.kind === 'project' && !projectSourceIds.has(result.data.sourceId)) {
    result.failures.push(`${displayPath}: unknown project sourceId "${result.data.sourceId}"`);
  }
  if (result.data?.kind === 'case-study' && !caseStudySourceIds.has(result.data.sourceId)) {
    result.failures.push(`${displayPath}: unknown case-study sourceId "${result.data.sourceId}"`);
  }

  return result;
}

export async function validateContentDirectory(contentDir, root) {
  const files = await markdownFiles(contentDir);
  const failures = [];
  const slugs = new Set();

  for (const path of files) {
    const displayPath = relative(root, path).split(sep).join('/');
    const relativePath = relative(contentDir, path);
    const source = await readFile(path, 'utf8');
    const { size } = await stat(path);
    const result = validateWriteupSource({ displayPath, relativePath, source, size });
    failures.push(...result.failures);
    if (slugs.has(result.slug)) failures.push(`${displayPath}: duplicate slug "${result.slug}"`);
    slugs.add(result.slug);
  }

  return { failures, files };
}

export async function validateWorkDirectory(contentDir, root) {
  const files = await markdownFiles(contentDir);
  const failures = [];
  const slugs = new Set();
  const sourceIds = new Set();

  for (const path of files) {
    const displayPath = relative(root, path).split(sep).join('/');
    const relativePath = relative(contentDir, path);
    const source = await readFile(path, 'utf8');
    const { size } = await stat(path);
    const result = validateWorkSource({ displayPath, relativePath, source, size });
    failures.push(...result.failures);

    if (slugs.has(result.slug)) failures.push(`${displayPath}: duplicate slug "${result.slug}"`);
    slugs.add(result.slug);

    if (!result.data) continue;
    if (sourceIds.has(result.data.sourceId)) {
      failures.push(`${displayPath}: duplicate sourceId "${result.data.sourceId}"`);
    }
    sourceIds.add(result.data.sourceId);

    const heroPath = resolve(dirname(path), result.data.heroImage);
    try {
      const hero = await stat(heroPath);
      if (!hero.isFile()) failures.push(`${displayPath}: heroImage must resolve to a file`);
    } catch {
      failures.push(`${displayPath}: heroImage does not exist at "${result.data.heroImage}"`);
    }
  }

  return { failures, files };
}