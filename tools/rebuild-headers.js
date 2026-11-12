import fs from 'node:fs';
import path from 'node:path';

/**
 * Rebuild the header / command-bar area of every dashboard page with a
 * consistent, professional treatment:
 *
 *   [emblem]  EYEBROW · META
 *            Headline Title
 *            Supporting description
 *                                                     [live badge]
 *                                                     [action buttons]
 *
 * The existing action buttons are preserved verbatim - only the surrounding
 * chrome is redesigned.
 */

const PUBLIC = path.resolve('public');

const BUTTON_RE = /<button\b[\s\S]*?<\/button>/g;

const PAGES = [
  {
    file: 'dashboard/index.html',
    startMarker: '<!-- Top Action & Title Bar -->',
    endMarker: '<!-- Quick Vital Statistics Strip -->',
    icon: 'menu_book',
    eyebrow: 'Central Registry',
    meta: 'MARC21 · RFID sync',
    title: 'Catalog &amp; Resource Inventory',
    subtitle:
      'Central MARC21 bibliographic registry, multi-tier holdings, and physical item RFID monitoring.',
    badge: { value: '148,290', label: 'Titles Cataloged', dot: true },
    // Wrap the outer container of the buttons so they line up on the right.
    buttonWrapClass:
      'flex flex-wrap items-center gap-2.5',
    buttonSize: 'default',
  },
  {
    file: 'dashboard/pages/page1.html',
    startMarker: '<!-- Header Command Bar -->',
    endMarker: '<!-- Top KPI Stats Row (4 cards) -->',
    icon: 'space_dashboard',
    eyebrow: 'Operations Desk',
    meta: 'Stacks A–G',
    title: 'Overview &amp; Circulation Analytics',
    subtitle:
      'Live operations desk, real-time patron circulation flow, and inventory telemetry across Stacks A–G.',
    badge: { text: 'Autumn Term • Tuesday, Oct 24', dot: true },
    buttonWrapClass: 'flex flex-wrap items-center gap-2.5',
    buttonSize: 'default',
  },
  {
    file: 'dashboard/pages/page2.html',
    startMarker: '<!-- Top Command & Action Bar -->',
    endMarker: '<!-- Summary Metrics Quad-Grid -->',
    icon: 'group',
    eyebrow: 'Circulation Terminal 04',
    meta: 'Archival Term 2024–25',
    title: 'Borrowers &amp; Circulation Services',
    subtitle:
      'Registered borrowers, active loans, desk holds and patron standing for the current archival term.',
    badge: { value: '12,450', label: 'Registered Borrowers', dot: true },
    buttonWrapClass: 'flex flex-wrap items-center gap-2.5',
    buttonSize: 'default',
  },
  {
    file: 'dashboard/pages/page3.html',
    startMarker: '<!-- Top Context Header Area -->',
    endMarker: '<!-- Budget Overview Cards (4 Bento Panels) -->',
    icon: 'shopping_bag',
    eyebrow: 'Financial Ledger &amp; Provenance',
    meta: 'REV-2024.11-B',
    title: 'Acquisitions &amp; Order Management',
    subtitle:
      'Fiscal Year 2024–2025 • Q2 Procurement Cycle • Central Stacks &amp; Departmental Endowments',
    badge: { text: 'Q2 Procurement Cycle', dot: true },
    buttonWrapClass: 'flex flex-wrap items-center gap-2.5',
    buttonSize: 'default',
  },
];

/* ------------------------------------------------------------------ *
 * Three distinct button types
 * ------------------------------------------------------------------ */

const BTN_GHOST =
  'inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-transparent ring-1 ring-outline-variant/70 hover:bg-surface-container hover:ring-outline-variant text-on-surface font-label-lg text-label-lg font-medium transition-all';

const BTN_ATTENTION =
  'inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-error-container/35 ring-1 ring-error-container/70 hover:bg-error-container/55 text-on-error-container font-label-lg text-label-lg font-semibold transition-all';

const BTN_PRIMARY =
  'inline-flex items-center gap-2.5 px-5 py-3 rounded-xl bg-primary-container text-on-primary hover:opacity-90 font-label-lg text-label-lg font-semibold shadow-[0_6px_18px_rgba(15,30,54,.22)] transition-all';

const ICON_GHOST = 'text-on-surface-variant';
const ICON_ATTENTION = 'text-error';
const ICON_PRIMARY = '';

/** Decide which of the three types a button should get. */
const buttonType = (button) => {
  if (/bg-primary-container/.test(button)) return 'primary';

  const icon = (button.match(/material-symbols-outlined[^>]*>([^<]*)</) || [])[1] || '';
  const label = button
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const attentionIcons = [
    'notification_important',
    'assignment_late',
    'mark_chat_unread',
    'warning',
    'report',
    'error',
  ];
  const attentionWords = /overdue|reminder|escalat|expired|late|fine|unpaid|dunning|review|request|queue|pending/;

  if (attentionIcons.includes(icon) || attentionWords.test(label)) return 'attention';

  // A trailing count badge means "there is a queue waiting" - treat it as
  // an attention action (e.g. "Review Patron Requests 14").
  const countBadge = button.match(
    /<span[^>]*class="[^"]*font-code-num[^"]*"[^>]*>\s*(\d+)\s*<\/span>/i
  );
  if (countBadge && Number(countBadge[1]) > 0) return 'attention';

  return 'ghost';
};

/** Restyle the action buttons into the three-type hierarchy. */
const restyleButtons = (buttons) =>
  buttons
    .map((button) => {
      const type = buttonType(button);

      const cls =
        type === 'primary' ? BTN_PRIMARY : type === 'attention' ? BTN_ATTENTION : BTN_GHOST;
      const iconCls =
        type === 'primary' ? ICON_PRIMARY : type === 'attention' ? ICON_ATTENTION : ICON_GHOST;

      let out = button.replace(/class="[^"]*"/, `class="${cls}"`);

      // Give the leading icon its own colour.
      out = out.replace(
        /<span class="material-symbols-outlined text-\[18px\][^"]*">/,
        `<span class="material-symbols-outlined text-[20px] ${iconCls}">`
      );

      return out;
    })
    .join('\n');

const buildHeader = (cfg, buttons) => {
  const badge = cfg.badge
    ? cfg.badge.value
      ? `<div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-container-highest text-on-surface font-label-md text-label-md font-semibold">
           <span class="w-2 h-2 rounded-full bg-secondary"></span>
           <span class="font-code-num text-code-num font-semibold">${cfg.badge.value}</span>
           <span class="text-on-surface-variant font-normal">${cfg.badge.label}</span>
         </div>`
      : `<div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-container-highest text-on-surface font-label-md text-label-md font-semibold">
           <span class="w-2 h-2 rounded-full bg-secondary"></span>
           <span>${cfg.badge.text}</span>
         </div>`
    : '';

  return `${cfg.startMarker}
<div class="px-margin pt-space-lg pb-space-md">
  <div class="rounded-2xl bg-surface-container-lowest ring-1 ring-outline-variant/40 shadow-[0_2px_12px_rgba(15,30,54,.07)] overflow-hidden">
    <div class="p-5 sm:p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-5">

      <!-- Title block -->
      <div class="flex items-start gap-4 min-w-0">
        <span class="inline-flex w-12 h-12 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary shadow-[0_4px_14px_rgba(15,30,54,.22)]">
          <span class="material-symbols-outlined text-[24px]">${cfg.icon}</span>
        </span>
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-bold">${cfg.eyebrow}</span>
            <span class="w-1 h-1 rounded-full bg-outline-variant"></span>
            <span class="font-code-num text-code-num text-on-surface-variant font-medium">${cfg.meta}</span>
          </div>
          <h1 class="font-headline-lg text-headline-lg text-on-surface font-semibold tracking-tight mt-1.5">${cfg.title}</h1>
          <p class="font-body-sm text-body-sm text-on-surface-variant mt-1.5 max-w-2xl">${cfg.subtitle}</p>
        </div>
      </div>

      <!-- Live badge + actions -->
      <div class="flex flex-col items-start xl:items-end gap-3.5 shrink-0">
        ${badge}
        <div class="${cfg.buttonWrapClass}">
${buttons}
        </div>
      </div>

    </div>
  </div>
</div>
`;
};

PAGES.forEach((cfg) => {
  const file = path.join(PUBLIC, cfg.file);
  let html = fs.readFileSync(file, 'utf8');

  const start = html.indexOf(cfg.startMarker);
  const end = html.indexOf(cfg.endMarker, start);

  if (start === -1 || end === -1) {
    console.error(`!! markers not found in ${cfg.file}`);
    return;
  }

  const region = html.slice(start, end);
  const buttons = region.match(BUTTON_RE) || [];

  if (!buttons.length) {
    console.error(`!! no buttons found in ${cfg.file}`);
    return;
  }

  const rebuilt = buildHeader(cfg, restyleButtons(buttons));
  html = html.slice(0, start) + rebuilt + html.slice(end);

  fs.writeFileSync(file, html, 'utf8');
  console.log(`rebuilt ${cfg.file}  (${buttons.length} buttons kept)`);
});
