/**
 * Build the public pages (landing + login) from the templates in
 * tools/templates/ by injecting the shared Tailwind theme configuration and
 * the brand assets.
 *
 * The dashboard pages are standalone HTML and are NOT touched by this script.
 *
 *   node tools/build-pages.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TEMPLATES = path.join(__dirname, 'templates');
const OUT = path.join(ROOT, 'public');

const LOGO_SVG = `<svg class="h-9 w-9 shrink-0" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="RCC IIT Library logo"><rect width="32" height="32" rx="9" fill="#0f1e36"/><path d="M8.6 25.2V14.3a7.4 7.4 0 0 1 14.8 0v10.9" stroke="#fe932c" stroke-width="2.1" stroke-linecap="round"/><path d="M9.6 19.8h5.3a1.1 1.1 0 0 1 1.1 1.1v4.5a1.1 1.1 0 0 1-1.1 1.1h-4.5a.8.8 0 0 1-.8-.8v-5.9Z" fill="#f8f9ff"/><path d="M22.4 19.8h-5.3a1.1 1.1 0 0 0-1.1 1.1v4.5a1.1 1.1 0 0 0 1.1 1.1h4.5a.8.8 0 0 0 .8-.8v-5.9Z" fill="#d3e4fe"/><path d="M16 20v6.3" stroke="#fe932c" stroke-width="1.3" stroke-linecap="round"/></svg>`;

const AVATAR_SVG = `<svg class="w-9 h-9 rounded-full shrink-0" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Priyanka Das, Head Librarian"><circle cx="20" cy="20" r="20" fill="#0f1e36"/><circle cx="20" cy="20" r="19" fill="none" stroke="#fe932c" stroke-width="1.5"/><text x="20" y="20" dy="0.35em" text-anchor="middle" font-family="'Plus Jakarta Sans',system-ui,sans-serif" font-size="14" font-weight="700" letter-spacing="0.5" fill="#f8f9ff">PD</text></svg>`;

const FAVICON = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#0f1e36"/><path d="M8.6 25.2V14.3a7.4 7.4 0 0 1 14.8 0v10.9" stroke="#fe932c" stroke-width="2.2" stroke-linecap="round" fill="none"/><path d="M9.8 20h5.1a1 1 0 0 1 1 1v4.2a1 1 0 0 1-1 1h-4.3a.8.8 0 0 1-.8-.8V20Zm12.4 0h-5.1a1 1 0 0 0-1 1v4.2a1 1 0 0 0 1 1h4.3a.8.8 0 0 0 .8-.8V20Z" fill="#f8f9ff"/></svg>'
).replace(/'/g, '%27')}`;

/** Pull the Tailwind theme out of a dashboard page so every page matches. */
const readTailwindConfig = () => {
  const dashboard = path.join(OUT, 'dashboard', 'index.html');
  const html = fs.readFileSync(dashboard, 'utf8');
  const match = html.match(/<script id="tailwind-config">([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error('Could not find the tailwind-config script in public/dashboard/index.html');
  }
  return match[1];
};

const build = () => {
  const tailwindConfig = readTailwindConfig();

  const pages = [
    { template: 'landing.html', output: 'landing.html' },
    { template: 'login.html', output: 'login.html' },
  ];

  pages.forEach(({ template, output }) => {
    const source = fs.readFileSync(path.join(TEMPLATES, template), 'utf8');
    const html = source
      .replace('__TAILWIND_CONFIG__', tailwindConfig)
      .replace(/__LOGO_SVG__/g, LOGO_SVG)
      .replace(/__AVATAR__/g, AVATAR_SVG)
      .replace(/__FAVICON__/g, FAVICON);

    fs.writeFileSync(path.join(OUT, output), html, 'utf8');
    console.log(`built public/${output}  (${html.length} bytes)`);
  });
};

build();