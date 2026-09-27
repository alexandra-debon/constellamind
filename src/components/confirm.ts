// In-app confirmation dialog. Native browser dialogs look out of place in the
// iOS/Android apps and are blocked in some embedded web views.

export function askConfirm(message: string, ok = 'OK', cancel = 'Annuler'): Promise<boolean> {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'confirm-backdrop';
    back.innerHTML = `<div class="confirm" role="alertdialog" aria-modal="true"><p></p><div class="confirm-actions"><button type="button" class="btn ghost" data-v="0"></button><button type="button" class="btn primary" data-v="1"></button></div></div>`;
    back.querySelector('p')!.textContent = message;
    const [no, yes] = back.querySelectorAll('button');
    no.textContent = cancel;
    if (!cancel) no.remove();
    yes.textContent = ok;
    const done = (v: boolean) => {
      back.remove();
      resolve(v);
    };
    back.addEventListener('click', (e) => {
      const b = (e.target as Element).closest('button');
      if (b) done(b.dataset.v === '1');
      else if (e.target === back) done(false);
    });
    document.body.appendChild(back);
    yes.focus();
  });
}

/** A message with a single OK button. */
export function notify(message: string): Promise<boolean> {
  return askConfirm(message, 'OK', '');
}
