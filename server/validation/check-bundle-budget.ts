import { readdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const MAX_INITIAL_JS_GZIP_BYTES = 200 * 1024;
const assets = await readdir('dist/assets');
const jsAssets = assets.filter((asset) => asset.endsWith('.js'));

if (jsAssets.length === 0) {
  console.error('No JS bundle found in dist/assets. Run npm run build first.');
  process.exit(1);
}

let failed = false;
for (const asset of jsAssets) {
  const source = await readFile(`dist/assets/${asset}`);
  const gzipBytes = gzipSync(source).byteLength;
  const status = gzipBytes <= MAX_INITIAL_JS_GZIP_BYTES ? 'PASS' : 'FAIL';
  console.log(`${status} ${asset}: ${formatKb(gzipBytes)} gzip`);
  if (gzipBytes > MAX_INITIAL_JS_GZIP_BYTES) failed = true;
}

if (failed) {
  console.error(`Initial JS gzip budget exceeded: ${formatKb(MAX_INITIAL_JS_GZIP_BYTES)} max.`);
  process.exit(1);
}

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(2)}KB`;
}
