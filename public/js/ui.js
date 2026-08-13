const THEME_KEY = 'dailyhabits-theme';

export function applyTheme(preference = localStorage.getItem(THEME_KEY) || 'system') {
  const dark = preference === 'dark' || (preference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelectorAll('.theme-toggle').forEach(button => {
    button.textContent = dark ? '☾' : '☼';
    button.setAttribute('aria-label', dark ? 'Use light theme' : 'Use dark theme');
  });
  return preference;
}

export function setTheme(preference) {
  localStorage.setItem(THEME_KEY, preference);
  applyTheme(preference);
}

export function cycleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

export function initTheme() {
  applyTheme();
  document.querySelectorAll('.theme-toggle').forEach(button => button.addEventListener('click', cycleTheme));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if ((localStorage.getItem(THEME_KEY) || 'system') === 'system') applyTheme('system');
  });
}

export function toast(title, message = '', type = 'success') {
  const region = document.querySelector('.toast-region');
  if (!region) return;
  const item = document.createElement('div');
  item.className = 'toast ' + type;
  item.setAttribute('role', type === 'error' ? 'alert' : 'status');
  const icon = type === 'error' ? '×' : type === 'warning' ? '!' : type === 'info' ? 'i' : '✓';
  const iconNode = document.createElement('b');
  iconNode.textContent = icon;
  const textNode = document.createElement('p');
  const strong = document.createElement('b');
  strong.textContent = title;
  textNode.append(strong, document.createTextNode(message ? ' ' + message : ''));
  item.append(iconNode, textNode);
  region.append(item);
  setTimeout(() => item.classList.add('fade'), 3200);
  setTimeout(() => item.remove(), 3500);
}

let activeModal = null;
let previousFocus = null;
export function openModal(modal) {
  if (!modal) return;
  previousFocus = document.activeElement;
  modal.hidden = false;
  activeModal = modal;
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => modal.querySelector('input:not([type=hidden]), textarea, select, button')?.focus());
}
export function closeModal(modal = activeModal) {
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove('modal-open');
  activeModal = null;
  previousFocus?.focus();
}
export function initModals() {
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', event => { if (event.target === modal) closeModal(modal); });
    modal.querySelectorAll('.modal-close').forEach(button => button.addEventListener('click', () => closeModal(modal)));
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && activeModal) closeModal();
    if (event.key === 'Tab' && activeModal) {
      const focusable = [...activeModal.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href]')];
      if (!focusable.length) return;
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
}

export function escapeText(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}
