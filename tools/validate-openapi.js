import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const yaml = require('js-yaml');

const doc = yaml.load(fs.readFileSync('docs/openapi.yaml', 'utf8'));

console.log('YAML parsed OK');
console.log('paths:', Object.keys(doc.paths).join(', '));
console.log('schemas:', Object.keys(doc.components.schemas).join(', '));
console.log('responses:', Object.keys(doc.components.responses).join(', '));
console.log('securitySchemes:', Object.keys(doc.components.securitySchemes || {}).join(', '));
console.log('tags:', doc.tags.map((t) => t.name).join(', '));

// Verify every $ref resolves to a real node.
const refs = [...JSON.stringify(doc).matchAll(/"\$ref":"([^"]+)"/g)].map((m) => m[1]);
const bad = refs.filter((ref) => {
  const parts = ref.replace(/^#\//, '').split('/');
  let cur = doc;
  for (const p of parts) {
    cur = cur && cur[p];
  }
  return !cur;
});
console.log('total $refs:', refs.length);
console.log('unresolved $refs:', bad.length ? bad.join(', ') : 'none');
