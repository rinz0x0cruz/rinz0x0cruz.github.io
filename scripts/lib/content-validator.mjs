import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import matter from 'gray-matter';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { writeupSchema } from '../../src/content/writeup-schema.ts';

export const maxWriteupBytes = 128 * 1024;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

export function validateWriteupSource({ displayPath, relativePath, source, size = Buffer.byteLength(source) }) {
  const failures = [];
  const normalizedPath = relativePath.split(sep).join('/');
  const slug = normalizedPath.slice(0, -extname(normalizedPath).length);

  if (!slugPattern.test(slug)) {
    failures.push(`${displayPath}: slug must contain only lowercase letters, numbers, and single hyphens`);
  }
  if (size > maxWriteupBytes) {
    failures.push(`${displayPath}: ${size} bytes exceeds the ${maxWriteupBytes}-byte limit`);
  }

  let parsed;
  try {
    parsed = matter(source);
  } catch (error) {
    failures.push(`${displayPath}: invalid frontmatter (${error.message})`);
    return { failures, slug };
  }

  const result = writeupSchema.safeParse(parsed.data);
  if (!result.success) failures.push(`${displayPath}: ${formatIssues(result.error.issues)}`);
  if (!parsed.content.trim()) failures.push(`${displayPath}: writeup body cannot be empty`);

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