import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const files = [
  ['README.md', 'root'],
  ['taskflow-api/README.md', 'project'],
];

files.forEach(([rel, label]) => {
  const full = path.join(root, rel);
  const md = fs.readFileSync(full, 'utf8');
  const fences = (md.match(/```/g) || []).length;
  const h2 = (md.match(/^## /gm) || []).length;
  const h3 = (md.match(/^### /gm) || []).length;
  const tables = (md.match(/^\|.*\|$/gm) || []).length;
  const links = (md.match(/\]\([^)]+\)/g) || []).length;

  console.log(`\n=== ${label}: ${rel}`);
  console.log(`  bytes        : ${md.length}`);
  console.log(`  lines        : ${md.split(/\r?\n/).length}`);
  console.log(`  code fences  : ${fences} ${fences % 2 === 0 ? '(balanced)' : '(UNBALANCED!)'}`);
  console.log(`  h2 / h3      : ${h2} / ${h3}`);
  console.log(`  table rows   : ${tables}`);
  console.log(`  links        : ${links}`);
  console.log(`  demo.mp4     : ${(md.match(/docs\/demo\.mp4/g) || []).length}`);
  console.log(`  video tag    : ${md.includes('<video src=') ? 'yes' : 'no'}`);
});

// Verify every relative link that points at a real file resolves.
const rootMd = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const targets = [...rootMd.matchAll(/\]\((taskflow-api\/[^)#]+)\)/g)].map((m) => m[1]);
console.log('\n=== root README relative links resolve?');
targets.forEach((t) => {
  console.log(`  ${fs.existsSync(path.join(root, t)) ? 'OK  ' : 'MISS'} ${t}`);
});

const projMd = fs.readFileSync(path.join(root, 'taskflow-api/README.md'), 'utf8');
const projTargets = [...projMd.matchAll(/\]\((docs\/[^)#]+)\)/g)].map((m) => m[1]);
console.log('\n=== project README relative links resolve?');
projTargets.forEach((t) => {
  console.log(`  ${fs.existsSync(path.join(root, 'taskflow-api', t)) ? 'OK  ' : 'MISS'} ${t}`);
});

// Verify TOC anchors have matching headings.
console.log('\n=== project README TOC anchors');
const headings = [...projMd.matchAll(/^#{2,3} (.+)$/gm)].map((m) =>
  m[1]
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
);
const anchors = [...projMd.matchAll(/\]\(#([a-z0-9-]+)\)/g)].map((m) => m[1]);
const missing = anchors.filter((a) => !headings.includes(a));
console.log(`  ${anchors.length} anchors, ${missing.length ? 'MISSING: ' + missing.join(', ') : 'all resolve'}`);
