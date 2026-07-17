import { createHash } from 'node:crypto';
import { parse } from 'parse5';

export function inlineScriptBodies(html) {
  const scripts = [];
  const visit = (node) => {
    if (node.nodeName === 'script' && !node.attrs?.some((attribute) => attribute.name === 'src')) {
      const start = node.sourceCodeLocation?.startTag?.endOffset;
      const end = node.sourceCodeLocation?.endTag?.startOffset;
      if (!Number.isInteger(start) || !Number.isInteger(end)) {
        throw new Error('Inline script is missing source offsets.');
      }
      scripts.push(html.slice(start, end));
    }
    for (const child of node.childNodes ?? []) visit(child);
  };
  visit(parse(html, { sourceCodeLocationInfo: true }));
  return scripts;
}

export function inlineScriptHashes(html) {
  return [...new Set(inlineScriptBodies(html).map((script) =>
    `'sha256-${createHash('sha256').update(script, 'utf8').digest('base64')}'`
  ))].sort();
}
