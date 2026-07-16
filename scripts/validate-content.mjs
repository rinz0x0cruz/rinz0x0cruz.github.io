import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContentDirectory } from './lib/content-validator.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = join(root, 'src', 'content', 'writeups');
const { failures, files } = await validateContentDirectory(contentDir, root);

if (failures.length) {
  console.error(`Writeup validation failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`Validated ${files.length} writeup${files.length === 1 ? '' : 's'}.`);