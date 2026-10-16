/* Werkzeuge für die UI-Tests: Browser starten, App öffnen, klicken, lesen.
   Jeder Test bekommt einen eigenen, frischen Browser-Kontext → frische Demo-Daten, keine Abhängigkeiten zwischen Tests. */
import { chromium } from 'playwright';
import { serve } from '../../tools/serve.js';
import { PRESETS } from '../../js/core/features.js';

let browser = null,
  server = null;

export async function startHarness() {
  server = await serve(0);
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  return server.url;
}
export async function stopHarness() {
  if (browser) await browser.close();
  if (server) await server.close();
}

const VIEWPORTS = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 900 } };
const IGNORE = /net::|fonts\.g|Failed to load resource/; // Schriftarten von Google sind in Tests egal

/**
 * Öffnet die App.
 *   route:     z. B. '#/p/demo1'
 *   preset:    'simple' (Standard für neue Teilnehmer) | 'all' (alle Optionen an)
 *   ownerView: 'details' (ausführliche Organisator-Ansicht, Standard in den Tests) | 'simple' (Standard in der App)
 *   view:      'phone' | 'desktop'      dark: dunkles Design
 */
export async function openApp(
  route = '#/',
  { preset = 'simple', ownerView = 'details', view = 'phone', dark = false } = {}
) {
  const ctx = await browser.newContext({
    viewport: VIEWPORTS[view],
    colorScheme: dark ? 'dark' : 'light',
    serviceWorkers: 'block',
  });
  // Einstellungen nur beim allerersten Laden setzen – spätere Umschaltungen im Test bleiben erhalten
  await ctx.addInitScript(
    ({ prefs, ownerView }) => {
      try {
        if (!localStorage.getItem('tp-test-init')) {
          if (prefs) localStorage.setItem('tp-features', JSON.stringify(prefs));
          localStorage.setItem('tp-owner-view', ownerView);
          localStorage.setItem('tp-test-init', '1');
        }
      } catch {}
    },
    { prefs: preset === 'simple' ? null : PRESETS[preset], ownerView }
  );
  const page = await ctx.newPage();
  page.setDefaultTimeout(5000); // fehlt ein Knopf, lieber schnell scheitern als 30 s warten
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => {
    if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push(m.text());
  });
  const app = new App(page, ctx, errors);
  await app.goto(route);
  return app;
}

/** Kleine Hülle um eine Playwright-Seite mit den Aktionen, die die Tests brauchen. */
class App {
  constructor(page, ctx, errors) {
    this.page = page;
    this.ctx = ctx;
    this.errors = errors;
  }
  wait(ms = 150) {
    return this.page.waitForTimeout(ms);
  }
  async goto(route) {
    // ?demo: Tests laufen immer im Demo-Modus – auch wenn config.js schon echte Firebase-Werte enthält.
    await this.page.goto(new URL('index.html?demo' + route, server.url).href);
    await this.page.waitForSelector('#app > *');
    await this.wait(400);
  }
  async reload() {
    await this.page.reload();
    await this.page.waitForSelector('#app > *');
    await this.wait(400);
  }
  /** Andere Seite öffnen, z. B. 'tests/'. */
  async open(path) {
    await this.page.goto(new URL(path, server.url).href);
  }
  async click(sel, ms = 150) {
    await this.page.click(sel);
    await this.wait(ms);
  }
  async clickIf(sel) {
    const el = await this.page.$(sel);
    if (el) {
      await el.click();
      await this.wait();
    }
    return !!el;
  }
  async fill(sel, v) {
    await this.page.fill(sel, v);
  }
  has(sel) {
    return this.page.$(sel).then(Boolean);
  }
  count(sel) {
    return this.page.$$(sel).then(l => l.length);
  }
  text(sel) {
    return this.page.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim());
  }
  texts(sel) {
    return this.page.$$eval(sel, l => l.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  }
  async toast() {
    const t = await this.page.$('#toast-root .toast');
    return t ? (await t.textContent()).replace(/\s+/g, ' ').trim() : '';
  }
  /** Beschriftungen der Pinsel unten im Dock, z. B. ['Ganztags', 'Uhrzeit']. */
  brushes() {
    return this.texts('.dock .brush span:not(.cnt)');
  }
  /** Freie (anklickbare) Tage im Kalender. */
  async freeDays() {
    return this.page.$$eval('[data-act=day]:not([disabled])', l => l.map(e => e.dataset.d));
  }
  async tapDay(ds) {
    await this.click(`[data-act=day][data-d="${ds}"]`, 80);
  }
  /** Rolle im Demo-Modus wechseln (oben in der Demo-Leiste). */
  async role(r) {
    await this.click(`[data-act=demo-role][data-v=${r}]`, 400);
  }
  /** Optionen-Fenster öffnen, etwas tun, schließen. */
  async options(fn) {
    await this.click('[data-act=features-open]');
    await fn();
    await this.click('.sheet [data-act=close-sheet]');
  }
  /** Demo-Daten aus dem Browser-Speicher (zum Prüfen, was gespeichert wurde). */
  demoData() {
    return this.page.evaluate(() => JSON.parse(localStorage.getItem('treffpunkt-demo-v3') || 'null'));
  }
  overflowX() {
    return this.page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  }
  shot(path) {
    return this.page.screenshot({ path, fullPage: true });
  }
  async close() {
    await this.ctx.close();
  }
}

/**
 * Testfunktion für mini-test: öffnet die App, führt fn(app) aus, prüft auf JavaScript-Fehler und schließt.
 *   t('Name', ui('#/p/demo1', async app => { … }, { preset: 'all' }))
 */
export const ui =
  (route, fn, opts = {}) =>
  async () => {
    const app = await openApp(route, opts);
    try {
      await fn(app);
      if (app.errors.length) throw new Error('JavaScript-Fehler auf der Seite: ' + app.errors.join(' | '));
    } catch (e) {
      if (process.env.UI_SHOTS) await app.shot(`${process.env.UI_SHOTS}/fail-${Date.now()}.png`).catch(() => {});
      throw e;
    } finally {
      await app.close();
    }
  };

/** Datum als YYYY-MM-DD, n Tage ab heute. */
export const inDays = n => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('sv-SE');
};
