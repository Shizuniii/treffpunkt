/* Fenster „Deine Ansicht“: Funktionen selbst ein- und ausblenden. */
import { S, lsSet } from '../app/state.js';
import { feat, forcedByUse, loadPrefs } from '../app/prefs.js';
import { FEATURES, presetOf } from '../core/features.js';
import { maybeLimit } from '../core/poll.js';
import { esc } from '../core/util.js';
import { sheetHead } from './dom.js';

export function sheetFeatures() {
  lsSet('tp-opts-seen', '1');
  const preset = presetOf(loadPrefs());
  const noMaybe = S.poll && maybeLimit(S.poll) === 0;
  const row = f => {
    const on = feat(f.id),
      forced = forcedByUse(f.id),
      disabled = f.id === 'maybe' && noMaybe;
    return `<div class="frow ${disabled ? 'dis' : ''}">
      <span class="hi">${f.icon}</span>
      <span class="stack" style="gap:1px;flex:1"><b>${esc(f.label)}</b><span class="small muted">${esc(f.desc)}</span>
        ${forced ? `<span class="small" style="color:var(--maybe)">Bleibt sichtbar, solange du es nutzt.</span>` : ''}
        ${disabled ? `<span class="small muted">Bei diesem Event ausgeschaltet.</span>` : ''}
        <button class="linkbtn small" data-act="help-topic" data-v="${f.help}" style="align-self:flex-start">Wie geht das?</button></span>
      <input type="checkbox" class="switch" data-feat="${f.id}" ${on ? 'checked' : ''} ${disabled ? 'disabled' : ''} aria-label="${esc(f.label)}">
    </div>`;
  };
  return `${sheetHead('Deine Ansicht')}
    <p class="small muted">Treffpunkt startet einfach: Tage antippen, auf Wunsch mit Uhrzeit, fertig. Alles andere kannst du hier dazuschalten oder wieder ausblenden. Gilt nur auf diesem Gerät.</p>
    <div class="seg full" role="group" aria-label="Voreinstellung"><button data-act="preset" data-v="simple" class="${preset === 'simple' ? 'on' : ''}">🧘 Einfach</button><button data-act="preset" data-v="all" class="${preset === 'all' ? 'on' : ''}">🧰 Alles</button></div>
    <div class="flist">${FEATURES.map(row).join('')}</div>`;
}
