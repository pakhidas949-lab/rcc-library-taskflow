import fs from 'node:fs';
import path from 'node:path';

const PUBLIC = path.resolve('public');
const PAGES = [
  'landing.html',
  'login.html',
  'dashboard/index.html',
  'dashboard/pages/page1.html',
  'dashboard/pages/page2.html',
  'dashboard/pages/page3.html',
];

// Pull every <button ...>...</button> and <a ...>...</a> from a page.
const BUTTON_RE = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
const ANCHOR_RE = /<a\b([^>]*?)href="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/gi;

const text = (html) =>
  html
    .replace(/<[^>]+>/g, '\n')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

for (const page of PAGES) {
  const html = fs.readFileSync(path.join(PUBLIC, page), 'utf8');
  console.log(`\n########## ${page}`);

  const buttons = [...html.matchAll(BUTTON_RE)].map((m) => {
    const attrs = m[1];
    const label = text(m[2]);
    const icon = (m[2].match(/material-symbols-outlined[^>]*>([^<]*)</) || [])[1] || '';
    const type = (attrs.match(/type="([^"]*)"/) || [])[1] || 'submit(default)';
    const inlineHandler = /onclick=/.test(attrs);
    const id = (attrs.match(/id="([^"]*)"/) || [])[1] || '';
    const cls = (attrs.match(/class="([^"]*)"/) || [])[1] || '';
    return { kind: 'button', label: label || '(icon only)', icon, type, inlineHandler, id, cls };
  });

  const anchors = [...html.matchAll(ANCHOR_RE)].map((m) => {
    const attrs = m[1] + m[3];
    const label = text(m[4]);
    const icon = (m[4].match(/material-symbols-outlined[^>]*>([^<]*)</) || [])[1] || '';
    const inlineHandler = /onclick=/.test(attrs);
    return { kind: 'a', label: label || '(icon only)', icon, href: m[2], inlineHandler };
  });

  console.log(`  BUTTONS: ${buttons.length}`);
  buttons.forEach((b) => {
    const flags = [b.inlineHandler ? 'HAS-handler' : 'no-handler', b.id ? `id=${b.id}` : '']
      .filter(Boolean)
      .join(' ');
    console.log(`    [${b.icon || b.label}]${b.label && b.icon ? ` "${b.label}"` : ''} type=${b.type} ${flags}`);
  });

  console.log(`  LINKS: ${anchors.length}`);
  const hrefs = {};
  anchors.forEach((a) => {
    hrefs[a.href] = (hrefs[a.href] || 0) + 1;
  });
  Object.entries(hrefs).forEach(([h, n]) => {
    const sample = anchors.find((a) => a.href === h);
    console.log(`    ${String(n).padStart(2)}x ${h.padEnd(28)} "${sample.label}"${sample.inlineHandler ? ' HAS-handler' : ''}`);
  });
}
