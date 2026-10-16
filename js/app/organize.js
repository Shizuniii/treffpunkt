/* Organisator-Werkzeuge: Vorlagen, „Nochmal mit neuem Zeitraum“, Mitorganisatoren. */
import { BUILTIN_TEMPLATES, formFromTemplate, reuseForm, templateFromPoll } from '../core/templates.js';
import { rid } from '../core/util.js';
import { $, toast } from '../ui/dom.js';
import { render } from '../ui/render.js';
import { renderSheet } from '../ui/sheets.js';
import { B, S, TODAY } from './state.js';

const scrollToForm = () =>
  setTimeout(() => $('#pollform') && $('#pollform').scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);

/* ---------- Vorlagen ---------- */
export const allTemplates = () => [
  ...BUILTIN_TEMPLATES,
  ...(S.templates || []).map(t => ({ ...t, icon: '⭐', own: true })),
];

/** Neues Event aus einer Vorlage: Formular füllen (Monate und Frist ab heute). */
export function useTemplate(id) {
  const t = allTemplates().find(x => x.id === id);
  if (!t) return;
  S.editPoll = { ...formFromTemplate(t, TODAY), from: t.name };
  render();
  scrollToForm();
}

/** „Nochmal mit neuem Zeitraum“: gleiche Einstellungen und Teilnehmer, neue Monate und Frist. */
export function reusePoll(pid) {
  const p = (S.polls || []).find(x => x.id === pid);
  if (!p) return;
  S.editPoll = reuseForm(p, TODAY);
  S.moreOpen = null;
  render();
  scrollToForm();
  toast('Prüf Zeitraum und Frist, dann „Erstellen“');
}

export async function saveTemplate(pid, name) {
  const p = (S.polls || []).find(x => x.id === pid);
  if (!p) return;
  const n = String(name || '').trim();
  if (!n) return toast('Bitte einen Namen für die Vorlage eingeben');
  await B.saveTemplate(rid(10), { ...templateFromPoll(p, n), createdAt: Date.now() });
  S.sheet = null;
  renderSheet();
  toast(`Vorlage „${n}“ gespeichert ⭐`);
}

export async function deleteTemplate(id) {
  await B.deleteTemplate(id);
  toast('Vorlage gelöscht');
}

/* ---------- Mitorganisatoren ---------- */
export const myAdmin = () => (S.admins || []).find(a => a.email === B.myEmail()) || null;
export const isLead = () => (myAdmin() || {}).role === 'owner';

export async function addAdmin(email, name) {
  const e = String(email || '')
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return toast('Bitte eine gültige Google-Adresse eingeben');
  if ((S.admins || []).some(a => a.email === e)) return toast('Diese Person ist schon Organisator');
  await B.saveAdmin(e, {
    role: 'co',
    name: String(name || '')
      .trim()
      .slice(0, 40),
    addedAt: Date.now(),
  });
  toast('Hinzugefügt. Die Person meldet sich mit genau diesem Google-Konto an.');
}

export async function removeAdmin(email) {
  await B.deleteAdmin(email);
  toast('Entfernt');
}

export async function transferLead(email) {
  await B.transferLead(email);
  S.sheet.confirm = null;
  toast('Leitung übergeben. Du bist jetzt Mitorganisator.');
}

/** Selbst austreten (nur Mitorganisatoren; die Leitung muss sie vorher abgeben). */
export async function leaveAdmins() {
  if (isLead()) return toast('Übergib zuerst die Leitung an jemand anderen');
  await B.deleteAdmin(B.myEmail());
  S.sheet = null;
  renderSheet();
  toast('Du bist kein Organisator mehr');
}
