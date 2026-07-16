import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContentDirectory, validateWorkDirectory } from './lib/content-validator.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [writeups, work] = await Promise.all([
  validateContentDirectory(join(root, 'src', 'content', 'writeups'), root),
  validateWorkDirectory(join(root, 'src', 'content', 'work'), root),
]);
const failures = [...writeups.failures, ...work.failures];

if (failures.length) {
  console.error(`Content validation failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(
  `Validated ${writeups.files.length} writeup${writeups.files.length === 1 ? '' : 's'} and ` +
    `${work.files.length} work entr${work.files.length === 1 ? 'y' : 'ies'}.`,
);