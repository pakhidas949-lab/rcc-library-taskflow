/**
 * Browser-side verification of the three header button types on the
 * Borrowers & Circulation page. Injected into the page by the test runner.
 */
window.__verifyHeaderButtons = async function () {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (fn, tries = 150) => {
    for (let i = 0; i < tries; i += 1) {
      if (fn()) return true;
      await sleep(100);
    }
    return false;
  };

  const api = window.TaskFlowAPI;
  const report = { steps: [] };

  const count = async () => (await api.list()).length;
  const findBtn = (label) =>
    Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent.replace(/\s+/g, ' ').includes(label)
    );
  const toastText = () =>
    Array.from(document.querySelectorAll('.tf-toast'))
      .map((t) => t.textContent.replace(/\s+/g, ' ').trim())
      .pop();

  report.steps.push({ step: 'page', path: location.pathname, chips: document.querySelectorAll('.taskflow-chip').length });

  // --- 1. PRIMARY: + Register New Patron -------------------------------
  const primaryBtn = findBtn('Register New Patron');
  report.steps.push({ step: 'primary button found', ok: !!primaryBtn });
  if (primaryBtn) {
    const before = await count();
    primaryBtn.click();
    await waitFor(() => {
      const m = document.getElementById('tf-modal');
      return m && !m.classList.contains('hidden');
    });
    const modal = document.getElementById('tf-modal-card');
    report.steps.push({
      step: 'primary modal',
      title: modal ? modal.querySelector('h3').textContent : null,
      hint: modal ? modal.querySelector('p').textContent.replace(/\s+/g, ' ').trim() : null,
    });

    const input = document.getElementById('tf-command-input');
    if (input) {
      input.value = 'Patron registration desk';
      document
        .getElementById('tf-command-form')
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await waitFor(() => (toastText() || '').indexOf('Task created') > -1);
    }
    const after = await count();
    report.steps.push({ step: 'primary created', before, after, created: after - before, toast: toastText() });
  }

  // --- 2. ATTENTION: Batch Overdue Reminders ---------------------------
  const attBtn = findBtn('Batch Overdue Reminders');
  report.steps.push({ step: 'attention button found', ok: !!attBtn });
  if (attBtn) {
    const before = await count();
    attBtn.click();
    await waitFor(() => (toastText() || '').indexOf('queued') > -1, 250);
    const after = await count();
    report.steps.push({ step: 'attention bulk', before, after, created: after - before, toast: toastText() });
  }

  // --- 3. GHOST: Export Patron Roster ----------------------------------
  const ghostBtn = findBtn('Export Patron Roster');
  report.steps.push({ step: 'ghost button found', ok: !!ghostBtn });
  if (ghostBtn) {
    ghostBtn.click();
    await waitFor(() => (toastText() || '').indexOf('Exported') > -1);
    report.steps.push({ step: 'ghost export', toast: toastText() });
  }

  // --- button style audit ----------------------------------------------
  const h1 = document.querySelector('main h1');
  const card = h1.closest('.rounded-2xl');
  report.buttons = Array.from(card.querySelectorAll('button')).map((b) => {
    const cs = getComputedStyle(b);
    let type = 'GHOST';
    if (cs.backgroundColor === 'rgb(15, 30, 54)') type = 'PRIMARY';
    else if (cs.backgroundColor.indexOf('255, 218, 214') > -1) type = 'ATTENTION';
    return {
      label: b.textContent.replace(/\s+/g, ' ').trim().replace(/^[a-z_]+ /, ''),
      type,
      height: Math.round(b.getBoundingClientRect().height),
      wired: b.dataset.tfWired === '1',
    };
  });

  return report;
};
