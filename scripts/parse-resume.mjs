// Parse the resume PDF into validated data for src/data/resume.json.
//
// Usage:
//   npm run parse:resume                         # dry run with semantic diff
//   npm run parse:resume -- --check              # fail when PDF and JSON drift
//   npm run parse:resume -- --write              # update non-destructively
//   npm run parse:resume -- --write --accept-removals
//   npm run parse:resume -- --pdf <path>
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resumeSchema } from '../src/data/resume.schema.ts';
import {
  ResumeParseError,
  extractPdfText,
  mergeResume,
  parseResumeArgs,
  parseResumeText,
  resumeChanges,
} from './lib/resume-parser.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const defaultPdfPath = join(root, 'public', 'Mohit-Sharma-Resume.pdf');
const outputPath = join(root, 'src', 'data', 'resume.json');

function usage() {
  console.log(`Usage: npm run parse:resume -- [options]

Options:
  --check             Fail if the PDF would change resume.json
  --write             Write validated changes to resume.json
  --accept-removals   Allow --write to remove records absent from the PDF
  --pdf <path>        Parse a different PDF
  --help              Show this help`);
}

function formatSchemaIssues(error) {
  return error.issues.map((issue) => `${issue.path.join('.') || 'resume'}: ${issue.message}`).join('\n  - ');
}

function displayValue(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 100 ? `${text.slice(0, 97)}...` : text;
}

function formatChange(change) {
  if (change.kind === 'added') return `+ ${change.path}: ${displayValue(change.after)}`;
  if (change.kind === 'removed') return `- ${change.path}: ${displayValue(change.before)}`;
  return `~ ${change.path}: ${displayValue(change.before)} -> ${displayValue(change.after)}`;
}

function writeAtomically(path, value) {
  const temporaryPath = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(temporaryPath, value, 'utf8');
    renameSync(temporaryPath, path);
  } finally {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
  }
}

try {
  const options = parseResumeArgs(process.argv.slice(2), defaultPdfPath);
  if (options.help) {
    usage();
    process.exit(0);
  }

  const pdfPath = isAbsolute(options.pdfPath) ? options.pdfPath : resolve(process.cwd(), options.pdfPath);
  if (!existsSync(pdfPath)) throw new ResumeParseError(`PDF not found: ${pdfPath}`);
  if (!existsSync(outputPath)) throw new ResumeParseError(`Resume data not found: ${outputPath}`);

  const existingResult = resumeSchema.safeParse(JSON.parse(readFileSync(outputPath, 'utf8')));
  if (!existingResult.success) {
    throw new ResumeParseError(`Existing resume.json is invalid:\n  - ${formatSchemaIssues(existingResult.error)}`);
  }

  const text = await extractPdfText(readFileSync(pdfPath));
  const parsed = parseResumeText(text);
  const preserveMissing = !options.acceptRemovals;
  const mergedResult = resumeSchema.safeParse(mergeResume(parsed, existingResult.data, { preserveMissing }));
  if (!mergedResult.success) {
    throw new ResumeParseError(`Parsed resume data is invalid:\n  - ${formatSchemaIssues(mergedResult.error)}`);
  }

  const merged = mergedResult.data;
  const changes = resumeChanges(existingResult.data, merged);
  const summary = [
    `source   ${pdfPath}`,
    `name     ${merged.basics.name}`,
    `contact  ${merged.basics.email} \u00b7 ${merged.basics.phone} \u00b7 ${merged.basics.location}`,
    `work     ${merged.work.length} roles: ${merged.work.map((role) => `${role.org}/${role.title} (${role.start}\u2013${role.end || 'now'})`).join('; ')}`,
    `skills   ${merged.skills.length} groups, ${merged.skills.reduce((total, group) => total + group.items.length, 0)} items`,
    `projects ${merged.projects.length} \u00b7 education ${merged.education.length} \u00b7 certs ${merged.certifications.length} \u00b7 languages ${merged.languages.length}`,
    `drift    ${changes.length ? `${changes.length} change${changes.length === 1 ? '' : 's'}` : 'none'}`,
  ];
  console.log(`\n${summary.join('\n')}\n`);
  if (changes.length) console.log(`${changes.map(formatChange).join('\n')}\n`);

  if (options.check) {
    if (changes.length) {
      console.error('resume.json is out of sync with the PDF. Review the drift and run with --write.\n');
      process.exit(1);
    }
    console.log('  resume.json matches the PDF.\n');
  } else if (options.write) {
    if (!changes.length) {
      console.log('  no changes to write.\n');
    } else {
      writeAtomically(outputPath, `${JSON.stringify(merged, null, 2)}\n`);
      console.log('  wrote  src/data/resume.json\n');
    }
  } else {
    console.log('  dry run. use --check for CI or --write to update resume.json.\n');
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nResume parse failed: ${message}\n`);
  process.exit(1);
}
