import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateGeneratedArtifact } from './validateGeneratedArtifact.ts';

const fixturePath = resolve(
  process.argv[2] ?? 'server/validation/fixtures/primary-button-artifact.md',
);
const markdown = await readFile(fixturePath, 'utf8');
const result = await validateGeneratedArtifact(markdown);

console.log(JSON.stringify(result, null, 2));
process.exitCode = result.status === 'fail' ? 1 : 0;
