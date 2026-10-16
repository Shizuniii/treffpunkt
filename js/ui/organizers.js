/* Fenster und Bausteine für Organisator-Werkzeuge: Schnellstart mit Vorlagen, Vorlage speichern, Organisatoren. */
import { allTemplates, isLead, myAdmin } from '../app/organize.js';
import { B, S } from '../app/state.js';
import { esc } from '../core/util.js';
import { sheetHead } from './dom.js';

/** Schnellstart über dem Formular „Neues Event“. */
export function quickstartRow() {
  const list = allTemplates();
  return `<div class="stack" style="gap:6px"><span style="font-weight:600;font-size:.9rem">Schnellstart</span>
    <div class="chips">${list.map(t => `<button class="chip" data-act="tpl-use" data-id="${esc(t.id)}">${esc(t.icon || '⭐')} ${esc(t.name)}</button>`).join('')}</div>
    <span class="small muted">Füllt alles Wichtige aus, Monate und Frist ab heute. Du kannst danach alles ändern.${(S.templates || []).length ? ` <button class="linkbtn" data-act="tpl-manage">Eigene Vorlagen verwalten</button>` : ''}</span></div>`;
}

export function sheetTemplateSave() {
  const p = (S.polls || []).find(x => x.id === S.sheet.pid) || {};
  return `${sheetHead('Als Vorlage speichern')}
    <p class="small muted">Gespeichert werden Titel, Beschreibung, Wochentage, Teilnehmerliste und Einstellungen. Monate und Frist werden beim Benutzen ab dem jeweiligen Tag neu gesetzt.</p>
    <form class="stack" data-submit="tpl-save" novalidate><label class="field" for="tpl-name"><span>Name der Vorlage</span><input type="text" id="tpl-name" maxlength="40" value="${esc(p.title || '')}"></label>
    <div><button type="submit" class="btn primary">Speichern</button></div></form>`;
}

export function sheetTemplates() {
  const own = S.templates || [];
  return `${sheetHead('Eigene Vorlagen')}
    ${own.length ? own.map(t => `<div class="rule"><span><b>${esc(t.name)}</b></span><button class="btn sm ghost" data-act="tpl-del" data-id="${esc(t.id)}">Löschen</button></div>`).join('') : '<p class="muted">Noch keine eigenen Vorlagen. Bei einem Event unter „Mehr …“ → „Als Vorlage speichern“.</p>'}`;
}

/** Organisatoren verwalten – eine Zusatzfunktion, Treffpunkt funktioniert auch allein. */
export function sheetAdmins() {
  const list = [...(S.admins || [])].sort((a, b) =>
    a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : a.email.localeCompare(b.email)
  );
  const lead = isLead(),
    me = myAdmin(),
    confirm = S.sheet.confirm;
  let h = sheetHead('Organisatoren');
  h += `<p class="small muted">Ganz optional: Mitorganisatoren sehen alle Events und Antworten und können alles bearbeiten, genau wie du. Die Leitung verwaltet zusätzlich, wer Organisator ist.</p>`;
  if (confirm) {
    const who = list.find(a => a.email === confirm) || {};
    h += `<div class="banner warn" role="alert"><span>Leitung wirklich an <b>${esc(who.name || who.email)}</b> übergeben? Du bleibst Mitorganisator.</span>
      <div class="row"><button class="btn sm primary" data-act="adm-lead-yes" data-id="${esc(confirm)}">Ja, übergeben</button><button class="btn sm ghost" data-act="adm-lead-no">Abbrechen</button></div></div>`;
  }
  h += list
    .map(a => {
      const self = me && a.email === me.email;
      const actions =
        lead && !self
          ? `<button class="btn sm" data-act="adm-lead" data-id="${esc(a.email)}">Leitung übergeben</button><button class="btn sm ghost" data-act="adm-del" data-id="${esc(a.email)}">Entfernen</button>`
          : !lead && self
            ? `<button class="btn sm ghost" data-act="adm-leave">Austreten</button>`
            : '';
      return `<div class="rule" style="flex-wrap:wrap"><div class="stack" style="gap:1px;min-width:0"><b>${esc(a.name || a.email)}${self ? ' <span class="muted small">(du)</span>' : ''}</b><span class="small muted" style="overflow-wrap:anywhere">${esc(a.email)}</span></div>
        <div class="row" style="flex-wrap:wrap;justify-content:flex-end"><span class="pill ${a.role === 'owner' ? 'ok' : ''}">${a.role === 'owner' ? 'Leitung' : 'Mitorganisator'}</span>${actions}</div></div>`;
    })
    .join('');
  if (lead)
    h += `<form class="stack" data-submit="adm-add" novalidate><h3>Organisator hinzufügen</h3>
      <label class="field" for="adm-name"><span>Name</span><input type="text" id="adm-name" maxlength="40" placeholder="z. B. Ben"></label>
      <label class="field" for="adm-email"><span>Google-Adresse</span><input type="email" id="adm-email" autocomplete="off" placeholder="name@gmail.com"></label>
      <div><button type="submit" class="btn primary">Hinzufügen</button></div>
      <span class="small muted">Die Person öffnet danach Treffpunkt und meldet sich mit genau diesem Google-Konto an.</span></form>`;
  else if (!me) h += `<p class="small muted">Lädt …</p>`;
  return h;
}
