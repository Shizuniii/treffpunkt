/* UI-Tests aus Sicht eines Freundes (Teilnehmer). Jeder Test startet mit frischen Demo-Daten. */
import { suite, assert } from '../lib/mini-test.js';
import { ui } from './harness.js';

const VOTE = '#/p/demo1';
const ALL = { preset: 'all' };
/** Typischer Start: Übernehmen-Angebot wegklicken, Namen eintragen. */
const start = async app => {
  await app.clickIf('[data-act=copy-dismiss]');
  await app.fill('#v-name', 'Testi');
};
const saved = async (app, pid = 'demo1') => {
  await app.wait(1000);
  return (await app.demoData()).responses[pid]['demo-me'];
};

suite('UI · Einfach-Modus & Optionen', t => {
  t(
    'Einfach-Modus ist Standard',
    ui(VOTE, async app => {
      assert.deep(await app.brushes(), ['Ganztags', 'Uhrzeit']);
      assert.no(await app.has('.dock .seg'), 'kein Umschalter Einzeln/Mehrere');
      assert.no(await app.has('[data-help=rules]'), 'keine Wiederholungen');
      assert.no(await app.has('.emojis'), 'kein Avatar');
      assert.no(await app.has('#v-note'), 'keine Anmerkung');
      assert.ok(await app.has('.dock [data-act=features-open]'), 'Optionen-Knopf ist da');
    })
  );

  t(
    'Optionen einzeln ein- und ausschalten',
    ui(VOTE, async app => {
      await app.options(async () => {
        await app.click('[data-feat=maybe]');
        await app.click('[data-feat=favs]');
      });
      assert.deep(await app.brushes(), ['Ganztags', 'Uhrzeit', 'Vielleicht']);
      assert.deep(await app.texts('.dock .seg button'), ['Einzeln', '⭐ Top 3']);
      await app.options(() => app.click('[data-feat=maybe]'));
      assert.deep(await app.brushes(), ['Ganztags', 'Uhrzeit'], 'Vielleicht wieder aus');
    })
  );

  t(
    '„Alles“ und „Einfach“ als Voreinstellung',
    ui(VOTE, async app => {
      await app.options(() => app.click('[data-act=preset][data-v=all]'));
      assert.deep(await app.brushes(), ['Ganztags', 'Uhrzeit', 'Vielleicht', 'Kann nicht', 'Löschen']);
      assert.ok(await app.has('[data-help=rules]'));
      assert.ok(await app.has('#v-note'));
      assert.ok(await app.has('.emojis'));
      await app.options(() => app.click('[data-act=preset][data-v=simple]'));
      assert.deep(await app.brushes(), ['Ganztags', 'Uhrzeit']);
    })
  );

  t(
    'Einstellung bleibt nach Neuladen erhalten',
    ui(VOTE, async app => {
      await app.options(() => app.click('[data-feat=maybe]'));
      await app.reload();
      assert.includes(await app.brushes(), 'Vielleicht');
    })
  );

  t(
    'Funktionen, die man schon nutzt, bleiben sichtbar',
    ui('#/p/demo2', async app => {
      // In der Demo hat „Shy“ beim Bowling schon eine Wiederholung und einen Vielleicht-Tag.
      assert.ok(await app.has('[data-help=rules]'), 'Wiederholungen sichtbar');
      assert.includes(await app.brushes(), 'Vielleicht');
    })
  );

  t(
    'Kalender-Hinweise abschaltbar',
    ui(VOTE, async app => {
      await app.options(() => app.click('[data-feat=cal]'));
      assert.eq(await app.count('.cell.fer'), 0, 'keine Ferien-Markierung');
    })
  );
});

suite('UI · Abstimmen', t => {
  t(
    'Tag antippen speichert automatisch, nochmal tippen nimmt zurück',
    ui(VOTE, async app => {
      await start(app);
      const [d] = await app.freeDays();
      await app.tapDay(d);
      let me = await saved(app);
      assert.eq(me.name, 'Testi');
      assert.deep(me.days[d], { s: 0, e: 1440 });
      await app.tapDay(d);
      me = await saved(app);
      assert.no(me.days[d], 'wieder entfernt');
    })
  );

  t(
    'ohne Namen wird nicht gespeichert',
    ui(VOTE, async app => {
      await app.clickIf('[data-act=copy-dismiss]');
      await app.fill('#v-name', ''); // in der Demo ist „Shy“ vorausgefüllt
      const [d] = await app.freeDays();
      await app.tapDay(d);
      assert.includes(await app.text('#savestate'), 'Namen');
      await app.click('[data-act=done]');
      assert.includes(await app.toast(), 'Namen');
    })
  );

  t(
    'Uhrzeit eintragen',
    ui(VOTE, async app => {
      await start(app);
      await app.click('[data-act=brush][data-v=time]');
      await app.fill('#b-s', '18:00');
      const [d] = await app.freeDays();
      await app.tapDay(d);
      assert.ok(await app.has(`[data-d="${d}"].st-part`));
      assert.deep((await saved(app)).days[d], { s: 1080, e: 1440 });
    })
  );

  t(
    'Mehrere Tage auf einmal + Rückgängig',
    ui(
      VOTE,
      async app => {
        await start(app);
        await app.click('[data-act=selmode][data-v="1"]');
        const days = (await app.freeDays()).slice(0, 3);
        for (const d of days) await app.tapDay(d);
        assert.includes(await app.text('.quick'), '3 ausgewählt');
        await app.click('[data-act=brush][data-v=all]');
        assert.includes(await app.toast(), '3 Tage ganztags eingetragen');
        for (const d of days) assert.ok(await app.has(`[data-d="${d}"].st-all`), d);
        await app.click('.dock [data-act=undo]');
        for (const d of days) assert.no(await app.has(`[data-d="${d}"].st-all`), 'rückgängig: ' + d);
      },
      ALL
    )
  );

  t(
    'Schnellauswahl „Wochenenden“',
    ui(
      VOTE,
      async app => {
        await app.click('[data-act=selmode][data-v="1"]');
        await app.click('[data-act=qsel][data-v=weekend]');
        const n = +(await app.text('.quick b')).split(' ')[0];
        assert.ok(n >= 4, `${n} Tage ausgewählt`);
      },
      ALL
    )
  );

  t(
    'Vielleicht ist begrenzt',
    ui(
      VOTE,
      async app => {
        await start(app);
        await app.click('[data-act=brush][data-v=maybe]');
        const days = (await app.freeDays()).slice(0, 5);
        for (const d of days.slice(0, 4)) await app.tapDay(d);
        assert.eq(await app.text('.brush[data-v=maybe] .cnt'), '4/4');
        await app.tapDay(days[4]);
        assert.includes(await app.toast(), 'Limit');
        assert.no(await app.has(`[data-d="${days[4]}"].st-maybe`), '5. Tag nicht gesetzt');
      },
      ALL
    )
  );

  t(
    'Top 3 wählen und sortieren',
    ui(
      VOTE,
      async app => {
        await start(app);
        const days = (await app.freeDays()).slice(0, 4);
        for (const d of days) await app.tapDay(d);
        await app.click('[data-act=selmode][data-v=fav]');
        for (const d of days.slice(0, 3)) await app.tapDay(d);
        assert.includes(await app.toast(), 'Top 3 komplett');
        await app.tapDay(days[3]);
        assert.includes(await app.toast(), 'schon 3 Favoriten');
        await app.click('[data-act=fav-move][data-v="1,-1"]');
        assert.deep((await saved(app)).favs, [days[1], days[0], days[2]]);
      },
      ALL
    )
  );

  t(
    'Top 3 nur an Tagen, an denen man kann',
    ui(
      VOTE,
      async app => {
        await start(app);
        await app.click('[data-act=selmode][data-v=fav]');
        const [d] = await app.freeDays();
        await app.tapDay(d);
        assert.includes(await app.toast(), 'nur an Tagen');
      },
      ALL
    )
  );

  t(
    'Neuen Zeitraum vorschlagen',
    ui(VOTE, async app => {
      await start(app);
      const before = await app.count('.month');
      await app.click('[data-act=propose-open]');
      await app.click('[data-act=pr-month]');
      await app.click('[data-act=pr-send]', 400);
      assert.includes(await app.text('.sheet h2'), 'Zeitraum hinzugefügt');
      await app.click('.sheet [data-act=close-sheet]');
      assert.eq(await app.count('.month'), before + 1, 'ein Monat mehr');
    })
  );

  t(
    '„Fertig“ ohne einen einzigen Tag bietet einen Vorschlag an',
    ui(VOTE, async app => {
      await start(app);
      await app.click('[data-act=done]', 300);
      assert.includes(await app.text('.sheet h2'), 'Zeitraum');
      await app.click('[data-act=pr-skip]', 300);
      assert.ok((await saved(app)).done, 'trotzdem als fertig gespeichert');
    })
  );

  t(
    'Mehrere Events in einem Link',
    ui('#/p/demo1,demo2', async app => {
      assert.eq(await app.count('.tabs .tab'), 2);
      await app.click('.tabs .tab:nth-child(2)', 400);
      assert.includes(await app.text('.hero h1'), 'Bowling');
    })
  );

  t(
    'Offline eintragen: wird gemerkt und später gesendet',
    ui(VOTE, async app => {
      await start(app);
      await app.ctx.setOffline(true);
      await app.wait(200);
      assert.includes(await app.text('#app'), 'Du bist offline');
      const [d] = await app.freeDays();
      await app.tapDay(d);
      await app.wait(1000);
      assert.includes(await app.text('#savestate'), 'wieder Netz');
      await app.ctx.setOffline(false);
      await app.wait(500);
      assert.includes(await app.text('#savestate'), 'Gespeichert');
      assert.no((await app.text('#app')).includes('Du bist offline'));
      assert.ok((await saved(app)).days[d], 'Antwort ist da');
    })
  );
});
