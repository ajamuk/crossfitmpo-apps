// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)
/* BEGIN USAGE */
/**
 * <metrics-overlay> — product-metrics overlay.
 *
 * Wraps any rendered UI and paints a metric glyph onto every descendant
 * that carries data-metric-id="…". The component owns no data: it loads a
 * static snapshot file the agent wrote (via the BigQuery / analytics
 * connector) and, when the user asks for filters the snapshot can't answer,
 * posts ONE message back to the host asking the agent to re-query and
 * append a fresh entry to that file's entries[] cache.
 *
 * Attributes:
 *   src           URL of the snapshot file. Re-fetched when this attribute
 *                 changes and on a 'metrics:reload' event. Omit only when
 *                 the host has already assigned window[<global>] itself.
 *                 .js  → loaded via <script src>, snapshot must assign
 *                        window[<global>] (see below). Lets the snapshot
 *                        ship helpers (sliceSum, fmtN) the adapter uses.
 *                 .json → fetch()ed; no helpers, no global attr needed.
 *   global        Name of the window.* key the .js snapshot assigns.
 *                 REQUIRED for .js src, ignored for .json.
 *   mode          'heat' | 'badges' | 'space'
 *                 (extensible via MetricsOverlay.registerMode). Default 'heat'.
 *                 The attribute also accepts 'off' (passthrough — see the
 *                 tweak recipe below); 'off' is not a selectable mode.
 *   window        1 | 3 | 7 | 'range' — day count. Default '7'. Presets
 *                 re-slice the loaded snapshot's daily arrays client-side;
 *                 'range' (with from/to) is answered only by an entry
 *                 fetched for exactly that range, otherwise it's a refetch.
 *   from, to      ISO datetimes (yyyy-mm-ddTHH:mm, local); read only when
 *                 window='range'. A custom range puts the overlay into
 *                 'stale' state unless an entry fetched for that exact
 *                 range is already cached.
 *   lens          Cohort key from snapshot.cohorts[].tier, or ''. Default ''.
 *   controls      'sentence' | 'none'. Default 'sentence' — renders the
 *                 serif sentence control ("Showing heat-map for all users
 *                 over the last week.") above the stage. 'none' for headless
 *                 use where the host owns the controls.
 *   adapter-opts  JSON string, merged into the createAdapter opts. Only for
 *                 the non-function bits (primaryScope etc.) — for function-
 *                 valued opts use el.configure() instead.
 *   funnel-src    URL of a funnels.json file (array of {name,def,result}).
 *                 Defaults to './funnels.json'. The pill shelf always
 *                 renders (unless controls='none' / mode='off'); when the
 *                 file is missing the shelf shows just "＋ Add user flow"
 *                 and the first add has the host create it. Re-fetched on
 *                 attribute change and on 'metrics:reload'. Also accepted
 *                 as 'funnelsrc' (DC <x-import> strips hyphens).
 *   funnel        'off' | '<name>'. Default 'off'. Reflects the active
 *                 shelf pill; setting it toggles the right panel. The
 *                 slotted template stays visible either way. Turn on
 *                 Record in the panel and template clicks append steps;
 *                 ▶ plays the flow through (real clicks).
 *   mock-funnel   When present (or when parent===window), "Get latest
 *                 numbers" resolves locally after ~1.2s with a synthetic
 *                 monotonic result — keeps the demo interactive without a
 *                 host handler. Set mock-funnel="off" to force-disable.
 *                 Also accepted as 'mockfunnel' (DC <x-import> strips hyphens).
 *
 * DOM contract on wrapped children:
 *   data-metric-id="copy-link"   REQUIRED — joins DOM element ↔ snapshot row
 *   data-metric-scope="share"    optional — nearest-ancestor scope; used as
 *                                the element's scope (real-estate grouping,
 *                                secondary-scope ring) when the snapshot row
 *                                doesn't set one
 *   data-funnel-screen="home"    optional — on a screen-level ancestor. The
 *                                Record mode tags each step with the nearest
 *                                ancestor's value so ▶ play can emit the
 *                                right metrics:navigate {screen} for steps
 *                                on another screen.
 *
 * Slots:
 *   (default)     the wrapped UI
 *
 * Snapshot file shape — ONE daily grain; every view is derived from it:
 *   { asOf: '2026-06-24',                        // last complete UTC day included
 *     query: { lens: '', from: '…', to: '…' },   // optional — which server-
 *                                                // side filter this entry answers
 *     days: ['2026-06-11', …, '2026-06-24'],     // N most-recent COMPLETE UTC
 *                                                // days (14 typical); partial today excluded
 *     viewersDaily: [...],                       // funnel-top event, one int per day,
 *                                                // aligned to days[]. For a multi-scope
 *                                                // screen, a {scope: [...]} map instead —
 *                                                // each element divides by its own scope's array.
 *     cohorts:  [{ tier, label, viewersDaily: [...] }],  // lens menu + subline only;
 *                                                // per-element lens data needs its own entry
 *     elements: [{ id, label, scope, ev, mode, inst, suggest, note,
 *                  daily: [...] }],              // one int per day, null = not yet
 *                                                // emitting (vs 0 = existed and fired
 *                                                // zero times); aligned to days[]
 *     adapterOpts: { primaryScope, ... } }       // optional — configure() overrides
 *
 * There are no authored per-window or per-element-state fields. Everything —
 * reach %, trend, totals, the ● Nd "new" badge — is a fold over daily[] and
 * viewersDaily[] at the same indices, so numerator and denominator can't
 * desync and the trend arrow is same-window (rate vs prior-period rate, not
 * raw WoW).
 *
 * The file may also be a multi-entry cache keyed by the server-side filter,
 * so flipping the sentence control back to a previously-fetched filter
 * doesn't need another round-trip:
 *   { adapterOpts: {...},
 *     entries: [ { query:{},                 asOf, days, viewersDaily, elements, cohorts },
 *                { query:{lens:'pro'},       asOf, days, viewersDaily, elements, cohorts },
 *                { query:{from:'…',to:'…'},  asOf, days, viewersDaily, … } ] }
 * A single-object snapshot is normalised to {entries:[it]} on load. When
 * the user changes the lens or picks a custom range, the overlay picks the
 * newest entry whose `query` matches and re-renders from it; if none does,
 * it goes stale and shows Refetch. A refetch should APPEND an entry with `query` set to the
 * requested filter — never overwrite existing entries (they're the cache).
 *
 * The range control in the sentence is the user's direct filter. Picking a
 * preset (yesterday / last 3 days / last week) re-slices the loaded
 * snapshot immediately — the numbers change, no refetch. Picking a custom
 * from–to range or a cohort lens the active entry isn't scoped to marks
 * the overlay stale and shows a "Get latest numbers" button so the agent
 * re-queries and appends a matching entry.
 *
 * Host protocol — the component posts exactly one message type to
 * window.parent when the user clicks "Get latest numbers" in the sentence row:
 *
 *   { type: 'metrics:refetch',
 *     src: './metrics-data.js',          // the cache file to append an entry to
 *     filter: { window, from, to, lens, mode },
 *     reason: 'filter-unsatisfiable' | 'manual',
 *     fallbackPrompt: 'Refetch metrics-data.js from …' }
 *
 * The host sends the chat turn directly (the click is the user gesture;
 * the host builds the prompt from the structured filter fields rather than
 * trusting fallbackPrompt verbatim). The component shows "Getting…" and
 * shimmers the stage for up to 90s; once the agent has appended
 * a fresh entry to the snapshot file, the preview reload (or a
 * 'metrics:reload' event) clears the asked state.
 *
 * Editing a user flow in the right panel (add/remove a step, rename,
 * relabel, delete) and clicking "Get latest numbers" both post:
 *
 *   { type: 'metrics:funnel',
 *     action: 'save' | 'delete' | 'compute',
 *     src: './funnels.json',        // the file to write
 *     name: 'Prompt → create',
 *     oldName: '…',                 // present on a rename ('save' action)
 *     def: { steps:[{screen,id,ev,label,inst}], window,
 *            splitBy, asOf, hash },  // component computes hash (djb2)
 *     funnels: [...],               // the full in-memory array
 *     snapshotSrc: './metrics-data.js',
 *     fallbackPrompt: '…' }         // only set for compute
 *
 * The host handles save/delete by writing the sanitised `funnels` array
 * straight to `src` — no agent turn, throttled at ~4/s trailing-edge. `compute` is the
 * only path that talks to the agent: the host builds the prompt from the
 * typed fields, the agent runs the per-user ordered-first-occurrence query
 * over def.steps[].ev, writes result:{defHash:def.hash, asOf, ranAt,
 * rows:[{step,users}], gaps} back into the same entry (echoing def.hash
 * verbatim), then fires 'metrics:reload'. The component re-fetches both
 * the snapshot and funnel-src and clears busy state.
 *
 * ▶ play emits 'metrics:navigate' {screen,id} (bubbling, composed) when
 * a step's element isn't visible.
 * A multi-screen template should listen for this and route to screen:
 *
 *   el.addEventListener('metrics:navigate', e => router.go(e.detail.screen));
 *
 * The component itself just scrolls and rings the element once it's
 * visible; ▶ play steps through def.steps at ~900ms/step, dispatching a
 * real click on each (so the product actually navigates), falling back to
 * navigate for off-screen steps.
 *
 * <metrics-funnel src name> — defined in the same file — is a tiny
 * read-only element that renders one user flow's result.rows as title +
 * bars + a window·asOf caption. Use it to drop a computed flow into a deck
 * or doc without the overlay stage.
 *
 * Imperative API:
 *   el.configure({ scopeOf(el, domScope), primaryScope, subline(q) })
 *     — function-valued adapter opts a JSON attr can't carry. Merges over
 *       snapshot.adapterOpts and adapter-opts attr; re-renders.
 *   el.funnels    — the loaded funnels.json array (getter).
 *   el.postFunnel(action, name, def) — same as clicking Get latest numbers in the panel.
 *   el.measure()  — re-measure [data-metric-id] rects now. Call after
 *     opening a popover/menu whose contents carry metric ids (mutations
 *     are observed, but this guarantees a prompt pass).
 *   el.refetch()  — same as clicking "Get latest numbers" in the sentence row.
 *   MetricsOverlay.registerMode(key, spec)
 *   MetricsOverlay.createAdapter(raw, opts)  — exported for hosts that
 *     want to drive the overlay without a src file.
 *
 * Usage — ALWAYS add this component as a tweak, never as an always-on
 * wrapper. In the template's data-props, expose a boolean `metrics`
 * (default false) and an enum `metricsMode` (heat / badges / space); in
 * renderVals map them to the element's attrs —
 *   mode:     props.metrics ? props.metricsMode : 'off'
 *   controls: props.metrics ? 'sentence'       : 'none'
 * — so with the tweak off the overlay is a true passthrough (no chrome,
 * no sentence, no legend) and the template looks unchanged.
 *
 *   <script src="metrics-overlay.js"></script>
 *   <metrics-overlay src="./metrics-data.js" global="HomeMetrics"
 *                    mode="{{mode}}" controls="{{controls}}">
 *     …product UI with data-metric-id attrs…
 *   </metrics-overlay>
 */
/* END USAGE */

(function () {
  // ─── shared format helpers ───────────────────────────────────────────
  function fmtN(n) {
    if (n == null) return '—';
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + 'k';
    return String(n);
  }
  function pctStr(n, d) { return d ? (100 * n / d).toFixed(1) + '%' : '—'; }
  // Sum of arr[from..to) skipping nulls. All-null (or empty) → null, so a
  // not-yet-emitting element renders as '–', not 0.
  function sliceSum(arr, from, to) {
    if (!arr) return null;
    var s = 0, got = 0;
    for (var i = Math.max(0, from); i < to && i < arr.length; i++) if (arr[i] != null) { s += arr[i]; got++; }
    return got ? s : null;
  }
  // Drop a datetime-local / ISO string to its yyyy-mm-dd date part so it
  // can be compared against days[] (which is date-only, UTC).
  function isoDay(s) { return s ? String(s).slice(0, 10) : ''; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;';
    });
  }
  // djb2 of a step list + window + splitBy → def.hash. The agent echoes
  // this verbatim into result.defHash so a hash-algo change here never
  // strands old results as permanently stale (hash is an identity, not a
  // check).
  function djb2(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return 'h-' + (h >>> 0).toString(36);
  }
  function defHash(def) {
    var s = (def.steps || []).map(function (st) { return (st.screen || '') + '|' + st.id + '|' + (st.ev || ''); }).join(';');
    return djb2(s + '|' + (def.window || '') + '|' + (def.splitBy || ''));
  }
  // Fresh when result matches def; stale when it exists but the steps/
  // window changed since it was computed; null when nothing's been run yet.
  function funnelState(f) {
    if (!f || !f.result) return null;
    return f.result.defHash === f.def.hash && f.result.asOf === f.def.asOf ? 'fresh' : 'stale';
  }
  // 3-bar SVG mini-spark for the pill — reads shape at a glance.
  function miniSpark(rows) {
    if (!rows || !rows.length) return '<span class="mxo-spk">' + barIcon + '</span>';
    var max = 0; for (var i = 0; i < rows.length; i++) if (rows[i].users > max) max = rows[i].users;
    var n = Math.min(rows.length, 4), bw = 3, g = 1, h = 10;
    var b = '';
    for (var j = 0; j < n; j++) {
      var bh = max ? Math.max(1, Math.round(h * rows[j].users / max)) : 1;
      b += '<rect x="' + j * (bw + g) + '" y="' + (h - bh) + '" width="' + bw + '" height="' + bh + '" rx="0.5"/>';
    }
    return '<svg class="mxo-spk" viewBox="0 0 ' + (n * (bw + g) - g) + ' ' + h + '" width="' + (n * (bw + g) - g) + '" height="' + h + '">' + b + '</svg>';
  }
  var barIcon = '<svg viewBox="0 0 11 10" width="11" height="10"><rect x="0" y="0" width="3" height="10" rx="0.5"/><rect x="4" y="3" width="3" height="7" rx="0.5"/><rect x="8" y="6" width="3" height="4" rx="0.5"/></svg>';
  var trashIcon = '<svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2.5 3.5h9M5.5 3.5V2.3a.8.8 0 0 1 .8-.8h1.4a.8.8 0 0 1 .8.8v1.2M4 3.5l.5 8a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1l.5-8"/></svg>';
  var playIcon = '<svg viewBox="0 0 14 14" width="12" height="12" fill="currentColor"><path d="M4 2.5v9l7-4.5z"/></svg>';
  var pauseIcon = '<svg viewBox="0 0 14 14" width="12" height="12" fill="currentColor"><rect x="3.5" y="3" width="2.5" height="8" rx=".8"/><rect x="8" y="3" width="2.5" height="8" rx=".8"/></svg>';
  var restartIcon = '<svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2 7a5 5 0 1 0 1.7-3.7L2 5"/><path d="M2 2v3h3"/></svg>';
  // The one "talk to the agent" button — sentence-row refetch and the
  // panel's compute both render this. kind → the click-handler hook;
  // busy → muted "Getting…"; disabled → dimmed no-op.
  function askBtn(kind, busy, disabled) {
    return '<button type="button" class="mxo-ask" data-ask="' + kind + '"' +
      (busy ? ' data-busy' : '') + (disabled ? ' disabled' : '') + '>' +
      (busy ? 'Getting…' : 'Get latest numbers') + '</button>';
  }

  // ─── adapter ─────────────────────────────────────────────────────────
  // The snapshot has ONE grain — per-day counts aligned to days[] — and
  // every number the overlay shows is a slice-sum over the same [from,to)
  // index range applied to both the element's daily[] and the entry's
  // (per-scope) viewersDaily[]. That structural pairing is what keeps
  // numerator and denominator coherent across every sentence-window
  // setting, and makes the trend arrow (rate / prior-period rate − 1)
  // immune to allocation swings: a traffic ramp scales both periods'
  // numerator and denominator, so the rate ratio is unchanged.
  function createAdapter(raw, opts) {
    raw = raw || { elements: [], days: [], asOf: '—', cohorts: [] };
    opts = opts || {};
    var rq = raw.query || {}, rqLens = rq.lens || '';
    var days = raw.days || [], nDays = days.length;
    var byId = raw.byId || (raw.elements || []).reduce(function (m, e) { m[e.id] = e; return m; }, {});
    // viewersDaily may be a single array (one funnel-top) or a {scope: array}
    // map (multi-scope screen). Normalise so denom() can always key by scope.
    var vd = raw.viewersDaily, vdMap = vd && !Array.isArray(vd);
    var vdFirst = vdMap ? vd[Object.keys(vd)[0]] : vd;
    function vdFor(scope) { return vdMap ? vd[scope] || vd[opts.primaryScope] || vdFirst : vd; }
    var scopeOf = opts.scopeOf || function (e, domScope) { return e.scope || e.arm || domScope || 'default'; };
    // q → [from,to) indices into days[]. Presets are "last N days"; a custom
    // range is answered only by an entry fetched FOR that range (whose whole
    // days[] IS the range), so its span is all of days[].
    function span(q) {
      q = q || {};
      if (q.win === 'range') {
        var f = isoDay(q.from), t = isoDay(q.to);
        return f && t && isoDay(rq.from) === f && isoDay(rq.to) === t ? { from: 0, to: nDays } : null;
      }
      var n = typeof q.win === 'number' && q.win > 0 ? q.win : 7;
      return { from: Math.max(0, nDays - n), to: nDays };
    }
    // Same-width window immediately preceding sp, or null when days[]
    // doesn't reach back that far — trend is undefined then, not zero.
    function prior(sp) {
      var w = sp.to - sp.from, pf = sp.from - w;
      return pf >= 0 ? { from: pf, to: sp.from } : null;
    }
    function denom(sp, scope) { return sliceSum(vdFor(scope), sp.from, sp.to); }
    // Aggregate viewers + interactions for the selected window/lens — drives
    // the subline under the sentence control so the filter change is visible
    // as a number before the per-element glyphs finish re-laying out.
    function totals(q) {
      q = q || {}; var sp = span(q);
      if (!sp) return { users: null, interactions: null, elements: 0 };
      // cohorts[].viewersDaily is menu/subline only — when the user picks a
      // lens this entry isn't scoped to, the overlay goes stale, but the
      // subline can still show that cohort's viewer count under the hatch.
      var projLens = q.lens && q.lens !== rqLens ? q.lens : '';
      var users;
      if (projLens) {
        var c = (raw.cohorts || []).filter(function (x) { return x.tier === projLens; })[0];
        users = c ? sliceSum(c.viewersDaily, sp.from, sp.to) : null;
      } else {
        users = denom(sp, opts.primaryScope || 'default');
      }
      var inter = 0, got = 0;
      for (var k in byId) {
        var n = sliceSum(byId[k].daily, sp.from, sp.to);
        if (n != null) { inter += n; got++; }
      }
      return { users: users, interactions: got ? inter : null, elements: got };
    }
    return {
      asOf: raw.asOf, days: days, raw: raw,
      meta: function (id, domScope) {
        var e = byId[id]; if (!e) return null;
        return { id: id, label: e.label || id, scope: scopeOf(e, domScope), ev: e.ev, mode: e.mode, suggest: e.suggest, inst: e.inst !== false, note: e.note };
      },
      point: function (id, q, domScope) {
        var e = byId[id]; if (!e) return null;
        var sc = scopeOf(e, domScope);
        // histDays = how many days this element has been emitting — derived,
        // so "new" self-expires and can't go stale like an authored newEv flag.
        var hd = 0; if (e.daily) for (var i = 0; i < e.daily.length; i++) if (e.daily[i] != null) hd++;
        var sp = span(q || {});
        if (!sp) return { value: null, denom: null, trend: null, prior: false, histDays: hd, daily: e.daily, days: days, scope: sc };
        var v = sliceSum(e.daily, sp.from, sp.to), d = denom(sp, sc);
        var t = null, pp = prior(sp);
        if (pp && v != null && d) {
          var pv = sliceSum(e.daily, pp.from, pp.to), pd = denom(pp, sc);
          if (pv && pd) t = (v / d) / (pv / pd) - 1;
        }
        return { value: v, denom: d, trend: t, prior: !!pp, histDays: hd, daily: e.daily, days: days, scope: sc };
      },
      span: span,
      lenses: function () {
        var c = raw.cohorts || [];
        return [{ key: '', label: 'All users' }].concat(c.map(function (x) { return { key: x.tier, label: x.label }; }));
      },
      satisfiable: function (q) {
        // An entry is a cache line keyed by its server-side filter. Lenses
        // aren't projected client-side — a different lens needs its own entry.
        if ((q.lens || '') !== rqLens) return false;
        if (q.win === 'range') return span(q) != null;
        // Preset windows mean "last N days ending at asOf". A range-scoped
        // entry's days[] aren't the most recent N, so it can't answer them.
        if (rq.from || rq.to) return false;
        return nDays > 0;
      },
      primaryScope: opts.primaryScope || 'default',
      totals: totals,
      subline: opts.subline || function (q) {
        var t = totals(q);
        if (t.users == null) return '';
        // Under a lens this entry isn't scoped to, the element counts are
        // still this entry's — don't show them next to the cohort's viewers.
        var projLens = q && q.lens && q.lens !== rqLens;
        return fmtN(t.users) + ' viewers' +
          (projLens || t.interactions == null ? '' : ' · ' + fmtN(t.interactions) + ' interactions');
      },
      fmtN: fmtN, pctStr: pctStr, sliceSum: sliceSum,
    };
  }

  // ─── mode registry ───────────────────────────────────────────────────
  // glyph(ctx) → {washHTML?: string, tag?: {cls, html, style?}} | null
  // legendHTML() → string
  var MODES = {};
  function registerMode(key, spec) { MODES[key] = Object.assign({ key: key }, spec); }

  function _nilNewDashLegend() {
    return '<span class="mxo-li"><span class="mxo-tag gap mxo-lkey">⚪</span><span><b>No event</b> — hover for <code>suggest:</code></span></span>' +
      '<span class="mxo-li"><span class="mxo-tag newev mxo-lkey">●</span><span><b>Nd</b> — only N days of data</span></span>' +
      '<span class="mxo-li"><span class="mxo-tag nil mxo-lkey">–</span>No data in window</span>';
  }

  registerMode('heat', {
    label: 'Heat-map',
    explain: "Per-element reach — % of users who touched it in the selected window. Darker = higher reach.",
    glyph: function (ctx) {
      var m = ctx.meta, pt = ctx.point;
      var p = pt && pt.value != null && pt.denom ? pt.value / pt.denom : null;
      if (p == null) {
        if (m && !m.inst) return { washHTML: '<span class="mxo-wash nil"></span>', tag: { cls: 'mxo-tag gap', html: '⚪' } };
        if (pt && pt.histDays) return { tag: { cls: 'mxo-tag newev', html: '●\u2009' + pt.histDays + 'd' } };
        return { tag: { cls: 'mxo-tag nil', html: '–' } };
      }
      // The wash sits in the glyph layer (.mxo-layer) over the slotted UI —
      // the tracked element itself stays fully opaque underneath. Occlusion
      // detection in _measure() keeps washes from painting through popovers.
      var c = Math.min(1, Math.pow(p, 0.55));
      var scoped = pt && pt.scope !== ctx.adapter.primaryScope ? ' scoped' : '';
      return {
        washHTML: '<span class="mxo-wash" style="background:oklch(0.68 ' + (0.04 + c * 0.18).toFixed(3) + ' 35 / ' + (0.12 + c * 0.55).toFixed(2) + ')"></span>',
        tag: { cls: 'mxo-tag' + scoped, html: (Math.min(1, p) * 100).toFixed(p < 0.1 ? 1 : 0) + '%' },
      };
    },
    legendHTML: function () {
      return '<span class="mxo-li"><span class="mxo-lsw" style="background:oklch(0.68 0.040 35 / 0.12)"></span>' +
        '<span class="mxo-lsw" style="background:oklch(0.68 0.149 35 / 0.45)"></span>' +
        '<span class="mxo-lsw" style="background:oklch(0.68 0.204 35 / 0.62)"></span>' +
        '% reach</span>' +
        '<span class="mxo-li"><span class="mxo-tag scoped mxo-lkey">%</span>Blue ring = secondary scope</span>' +
        _nilNewDashLegend();
    },
  });

  registerMode('badges', {
    label: 'Trend',
    explain: 'Count in the window, plus same-window trend on reach rate (▲ >+4%, ▼ <−4%).',
    glyph: function (ctx) {
      var m = ctx.meta, pt = ctx.point;
      if (!pt || pt.value == null) {
        if (m && !m.inst) return { tag: { cls: 'mxo-badge nil', html: '⚪' } };
        if (pt && pt.histDays) return { tag: { cls: 'mxo-badge', html: '●\u2009' + pt.histDays + 'd', style: 'border-color:var(--accent-blue,#2A78D6);color:var(--accent-blue,#2A78D6)' } };
        return { tag: { cls: 'mxo-badge nil', html: '–' } };
      }
      var nTxt = fmtN(pt.value);
      var t = pt.trend, arrow = '▬', cls = 'flat', tt = '';
      // trend null + prior-window-exists → element-level gap (● Nd data);
      // trend null + no prior window (custom range, or win==days.length) →
      // structural, not "new" — leave the neutral ▬.
      if (t == null) { if (pt.prior) { arrow = '●'; cls = 'new'; tt = pt.histDays + 'd data'; } }
      else if (t > 0.04) { arrow = '▲'; cls = 'up'; tt = '+' + (t * 100).toFixed(0) + '%'; }
      else if (t < -0.04) { arrow = '▼'; cls = 'dn'; tt = (t * 100).toFixed(0) + '%'; }
      else tt = '±0';
      return { tag: { cls: 'mxo-badge', html: esc(nTxt) + '<span class="mxo-tr ' + cls + '">' + arrow + (tt ? '\u2009' + tt : '') + '</span>' } };
    },
    legendHTML: function () {
      return '<span><b>Count in window</b> + trend</span>' +
        '<span class="mxo-tr up">▲</span><span class="mxo-tr dn">▼</span><span class="mxo-tr flat">▬</span>' +
        _nilNewDashLegend();
    },
  });

  registerMode('space', {
    label: 'Real estate',
    explain: 'Click-share ÷ area-share within scope. ≥1.2× earns its footprint; ≤0.7× over-allocated.',
    glyph: function (ctx) {
      var pt = ctx.point, r = ctx.rect;
      if (!pt || pt.value == null) return null;
      var totA = 0, totC = 0;
      for (var i = 0; i < ctx.allRects.length; i++) {
        var p = ctx.allPoints[i]; if (!p || p.scope !== pt.scope) continue;
        totA += ctx.allRects[i].w * ctx.allRects[i].h; totC += p.value || 0;
      }
      var ap = (r.w * r.h) / Math.max(1, totA), cp = pt.value / Math.max(1, totC);
      var ratio = cp / Math.max(0.001, ap);
      var rc = ratio >= 1.2 ? 'over' : ratio <= 0.7 ? 'under' : 'mid';
      return { washHTML: '<span class="mxo-ring ' + rc + '"></span>', tag: { cls: 'mxo-ratio ' + rc, html: ratio.toFixed(1) + '×' } };
    },
    legendHTML: function () {
      return '<span class="mxo-li"><span class="mxo-lsw" style="background:var(--accent-success,#558A42)"></span>≥1.2× earns its footprint</span>' +
        '<span class="mxo-li"><span class="mxo-lsw" style="background:var(--accent-primary,#D97757)"></span>≤0.7× over-allocated</span>';
    },
  });

  // ─── tag layout — stack colliding tags into vertical lanes ───────────
  function layoutTags(rects) {
    var TAG_W = 44, TAG_H = 14, GAP = 4, LANE = TAG_H + GAP;
    var sorted = rects.slice().sort(function (a, b) { return (a.y - b.y) || (a.x - b.x); });
    var placed = [];
    sorted.forEach(function (r) {
      var cx = r.x + r.w / 2, below = r.y < 60, lane = 0;
      while (lane < 8) {
        var ty = below ? r.y + r.h + GAP + lane * LANE : r.y - TAG_H - GAP - lane * LANE;
        var hit = placed.some(function (p) { return Math.abs(p.cx - cx) < TAG_W && Math.abs(p.ty - ty) < TAG_H; });
        if (!hit || lane === 7) { r.tag = { cx: cx, ty: ty, below: below }; placed.push({ cx: cx, ty: ty }); break; }
        lane++;
      }
    });
  }

  var WINDOWS = [
    { key: 1, label: 'Yesterday', sent: 'for yesterday' },
    { key: 3, label: 'Last 3 days', sent: 'over the last 3 days' },
    { key: 7, label: 'Last week', sent: 'over the last week' },
  ];
  function fmtDay(iso) {
    if (!iso) return '—';
    var d = new Date(iso.indexOf('T') < 0 ? iso + 'T00:00:00' : iso);
    if (isNaN(d)) return iso;
    var day = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return (d.getHours() || d.getMinutes())
      ? day + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      : day;
  }
  // Normalise a yyyy-mm-dd or yyyy-mm-ddTHH:mm string to datetime-local's
  // value/max format. A bare date gets hm appended (default '23:59' — the
  // end-of-day upper-bound sense for to/max/asOf; pass '00:00' for from).
  function asDT(s, hm) { return !s ? '' : s.indexOf('T') < 0 ? s + 'T' + (hm || '23:59') : s.slice(0, 16); }
  // 'May 27 – Jun 24' from an end date and a window like '28d'.
  function windowRange(asOf, win) {
    if (!asOf) return '';
    var end = new Date(asOf.indexOf('T') < 0 ? asOf + 'T00:00:00' : asOf);
    if (isNaN(end)) return asOf;
    var m = /^(d+)s*([dw])$/i.exec(win || '28d');
    var days = m ? (parseInt(m[1], 10) * (m[2].toLowerCase() === 'w' ? 7 : 1)) : 28;
    var start = new Date(end.getTime() - days * 864e5);
    var f = function (d) { return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
    return f(start) + ' – ' + f(end);
  }

  // ─── stylesheet (scoped to shadow) ───────────────────────────────────
  var CSS =
    ':host{display:block;padding:18px 20px;font-family:var(--font-ui,-apple-system,BlinkMacSystemFont,sans-serif);color:var(--text-primary,rgba(15,12,8,.92))}' +
    '.mxo-sent{font:420 19px/1.55 var(--font-display,ui-serif,Georgia,serif);letter-spacing:-0.2px;color:var(--text-secondary,rgba(15,12,8,.64));margin:0 0 4px}' +
    '.mxo-tok{position:relative;display:inline-block;color:var(--text-primary,rgba(15,12,8,.92));border-bottom:1.5px dotted var(--border-strong,rgba(15,12,8,.32));padding:0 2px 1px;cursor:default}' +
    '.mxo-tok:hover{border-bottom-color:currentColor}' +
    '.mxo-tcar{font-size:10px;margin-left:3px;color:var(--text-tertiary,rgba(15,12,8,.48))}' +
    '.mxo-isel{position:absolute;inset:0;opacity:0;cursor:default;width:100%;font:500 12px/1 var(--font-ui,-apple-system,sans-serif);border:0}' +
    '.mxo-sentsub{font:400 11.5px/1.5 var(--font-ui,-apple-system,sans-serif);color:var(--text-tertiary,rgba(15,12,8,.48));margin:0 0 14px}' +
    '.mxo-rpop{position:absolute;z-index:200;top:calc(100% + 8px);left:0;min-width:280px;padding:12px;background:var(--bg-surface,#fff);border:1px solid var(--border-default,rgba(15,12,8,.14));border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.16);font:400 12px/1.5 var(--font-ui,-apple-system,sans-serif);color:var(--text-primary,rgba(15,12,8,.92))}' +
    '.mxo-rpop:not([data-open]){display:none}' +
    '.mxo-presets{display:flex;gap:6px;margin-bottom:10px}' +
    '.mxo-preset{flex:1;height:28px;padding:0 8px;border:1px solid var(--border-default,rgba(15,12,8,.14));border-radius:7px;background:var(--bg-surface,#fff);font:500 11.5px/1 var(--font-ui,-apple-system,sans-serif);color:inherit;cursor:default}' +
    '.mxo-preset:hover{background:rgba(15,12,8,.04)}' +
    '.mxo-preset[data-on]{background:var(--accent-black,#191915);border-color:var(--accent-black,#191915);color:var(--text-inverse,#FAF9F5)}' +
    '.mxo-custom{display:flex;align-items:center;gap:8px;padding-top:10px;border-top:1px solid var(--border-subtle,rgba(15,12,8,.08))}' +
    '.mxo-custom label{font-size:11px;color:var(--text-tertiary,rgba(15,12,8,.48))}' +
    '.mxo-idate{font:500 12px/1 var(--font-ui,-apple-system,sans-serif);color:inherit;background:var(--bg-surface,#fff);border:1px solid var(--border-default,rgba(15,12,8,.14));border-radius:6px;padding:5px 6px;width:168px}' +
    '.mxo-apply{height:28px;padding:0 10px;border:0;border-radius:7px;background:var(--accent-black,#191915);color:var(--text-inverse,#FAF9F5);font:550 11.5px/1 var(--font-ui,-apple-system,sans-serif);cursor:default}' +
    '.mxo-apply:disabled{opacity:.4}' +
    '.mxo-ask{display:inline-flex;align-items:center;justify-content:center;height:26px;padding:0 11px;margin-left:8px;border:0;border-radius:8px;background:var(--accent-primary,#D97757);color:#fff;font:400 12.5px/1 var(--font-ui,-apple-system,sans-serif);cursor:default;vertical-align:2px}' +
    '.mxo-ask:not([data-busy]):not(:disabled):hover{filter:brightness(0.94)}' +
    '.mxo-ask[data-busy]{background:rgba(15,12,8,.08);color:var(--text-secondary,rgba(15,12,8,.64))}' +
    '.mxo-ask:disabled{opacity:.4}' +
    '.mxo-facts .mxo-ask{height:34px;margin-left:0;border-radius:9px;font-weight:550}' +
    '@keyframes mxo-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}' +
    ':host([data-state=loading]) .mxo-layer{background:linear-gradient(90deg,rgba(15,12,8,.02) 0%,rgba(15,12,8,.07) 50%,rgba(15,12,8,.02) 100%);background-size:200% 100%;animation:mxo-shimmer 1.4s linear infinite}' +
    '@media (prefers-reduced-motion:reduce){:host([data-state=loading]) .mxo-layer{animation:none}}' +
    '.mxo-split{display:grid;grid-template-columns:minmax(0,1fr);gap:24px;align-items:start}' +
    '.mxo-stage{position:relative;background:var(--bg-surface,#fff);border:1px solid var(--border-subtle,rgba(15,12,8,.08));border-radius:14px;box-shadow:var(--shadow-sm,0 1px 3px rgba(20,20,19,.06));overflow:hidden}' +
    '.mxo-layer{position:absolute;inset:0;pointer-events:none;z-index:100}' +
    ':host([data-state=stale]) .mxo-layer{opacity:.6;background:repeating-linear-gradient(45deg,rgba(15,12,8,.04) 0 6px,transparent 6px 12px)}' +
    // mode=off + controls=none → true passthrough (the tweak-off state).
    ':host([mode=off][controls=none]){font:inherit;color:inherit;padding:0}' +
    ':host([mode=off][controls=none]) .mxo-split{gap:0}' +
    ':host([mode=off][controls=none]) .mxo-stage{border:0;border-radius:0;box-shadow:none;background:transparent;overflow:visible}' +
    ':host([mode=off][controls=none]) .mxo-legend{display:none}' +
    ':host([mode=off][controls=none]) .mxo-layer{display:none}' +
    '.mxo-box{position:absolute;border-radius:6px}' +
    '.mxo-wash{position:absolute;inset:-1px;border-radius:inherit;mix-blend-mode:multiply}' +
    '.mxo-wash.nil{background:repeating-linear-gradient(45deg,rgba(15,12,8,.10) 0 4px,transparent 4px 8px);outline:1px dashed rgba(15,12,8,.25)}' +
    '.mxo-tag{position:absolute;min-width:30px;padding:2px 5px;border-radius:5px;background:var(--accent-black,#191915);color:var(--text-inverse,#FAF9F5);font:700 9.5px/1 var(--font-ui,-apple-system,sans-serif);font-variant-numeric:tabular-nums;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.2);pointer-events:auto}' +
    '.mxo-tag.nil{background:rgba(15,12,8,.5)}' +
    '.mxo-tag.gap{background:rgba(15,12,8,.28)}' +
    '.mxo-tag.newev{background:var(--accent-blue,#2A78D6)}' +
    '.mxo-tag.scoped{box-shadow:0 0 0 1.5px var(--accent-blue,#2A78D6),0 1px 3px rgba(0,0,0,.2)}' +
    '.mxo-lead{position:absolute;width:1px;background:rgba(15,12,8,.35)}' +
    '.mxo-badge{position:absolute;display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:5px;background:var(--bg-surface,#fff);border:1px solid var(--border-default,rgba(15,12,8,.14));font:600 10px/1 var(--font-ui,-apple-system,sans-serif);box-shadow:0 1px 3px rgba(0,0,0,.12);pointer-events:auto;font-variant-numeric:tabular-nums}' +
    '.mxo-badge.nil{opacity:.6;border-style:dashed}' +
    '.mxo-tr{font-size:9px;font-weight:700}.mxo-tr.up{color:var(--accent-success,#558A42)}.mxo-tr.dn{color:var(--accent-error,#A63244)}.mxo-tr.flat{color:var(--text-tertiary,rgba(15,12,8,.48))}.mxo-tr.new{color:var(--accent-blue,#2A78D6)}' +
    '.mxo-ring{position:absolute;inset:-2px;border-radius:7px;border:2px solid}.mxo-ring.over{border-color:var(--accent-success,#558A42)}.mxo-ring.under{border-color:var(--accent-primary,#D97757)}.mxo-ring.mid{border-color:var(--border-default,rgba(15,12,8,.14))}' +
    '.mxo-ratio{position:absolute;padding:2px 5px;border-radius:5px;font:700 9.5px/1 var(--font-ui,-apple-system,sans-serif);color:#fff;pointer-events:auto}.mxo-ratio.over{background:var(--accent-success,#558A42)}.mxo-ratio.under{background:var(--accent-primary,#D97757)}.mxo-ratio.mid{background:rgba(15,12,8,.5)}' +
    '.mxo-empty{position:absolute;border:1.5px dashed rgba(15,12,8,.3);border-radius:6px;box-sizing:border-box}' +
    '.mxo-cta{position:absolute;inset:0;display:grid;place-items:center;font:500 13px/1.4 var(--font-ui,-apple-system,sans-serif);color:var(--text-tertiary,rgba(15,12,8,.48));pointer-events:auto;text-align:center;padding:20px}' +
    '.mxo-legend{display:flex;align-items:center;flex-wrap:wrap;gap:10px 18px;padding:12px 2px;font:400 11.5px/1.4 var(--font-ui,-apple-system,sans-serif);color:var(--text-secondary,rgba(15,12,8,.64))}' +
    '.mxo-legend code{font:500 10.5px/1 var(--font-mono,ui-monospace,monospace);background:rgba(15,12,8,.06);padding:1px 4px;border-radius:4px}' +
    '.mxo-li{display:inline-flex;align-items:center;gap:7px}' +
    '.mxo-lsw{width:13px;height:13px;border-radius:3px;display:inline-block}' +
    '.mxo-lkey{position:static;display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:13px;transform:none;box-shadow:none}' +
    // ─── user-flow shelf ─────────────────────────────────────────────
    '.mxo-shelf{display:flex;align-items:center;gap:8px;margin:0 0 14px;overflow-x:auto;scrollbar-width:none}' +
    ':host([mode=off]) .mxo-shelf,:host([controls=none]) .mxo-shelf{display:none}' +
    '.mxo-shelf::-webkit-scrollbar{display:none}' +
    '.mxo-pill{display:inline-flex;align-items:center;gap:7px;flex:none;height:28px;padding:0 12px;border-radius:14px;border:1px solid var(--border-default,rgba(15,12,8,.14));background:var(--bg-surface,#fff);font:500 12px/1 var(--font-ui,-apple-system,sans-serif);color:var(--text-primary,rgba(15,12,8,.92));cursor:default;white-space:nowrap}' +
    '.mxo-pill:hover{background:rgba(15,12,8,.04)}' +
    '.mxo-pill[data-on]{background:var(--accent-black,#191915);border-color:var(--accent-black,#191915);color:var(--text-inverse,#FAF9F5)}' +
    '.mxo-spk{fill:currentColor;opacity:.6}.mxo-pill[data-on] .mxo-spk{opacity:.9}' +
    '.mxo-chip{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:5px;font:650 9.5px/1 var(--font-ui,-apple-system,sans-serif);letter-spacing:.06em;text-transform:uppercase;flex:none}' +
    '.mxo-chip.stale{background:rgba(200,130,30,.16);color:#B0761A}' +

    // ─── right panel ─────────────────────────────────────────────────
    ':host([data-funnel-view=panel]) .mxo-split{grid-template-columns:minmax(0,1fr) 340px}' +
    '@keyframes mxo-pulse{0%{box-shadow:0 0 0 0 rgba(217,119,87,.5)}100%{box-shadow:0 0 0 10px rgba(217,119,87,0)}}' +
    '.mxo-ping{position:absolute;border:2px solid var(--accent-primary,#D97757);border-radius:8px;pointer-events:none;z-index:120;animation:mxo-pulse .5s ease-out}' +
    '.mxo-frow[data-active]{border-radius:8px;box-shadow:inset 0 0 0 2px var(--accent-primary,#D97757);animation:mxo-pulse .5s ease-out;margin-left:-10px;padding-left:36px;margin-right:-10px;padding-right:10px}' +
    '.mxo-frow[data-active] .mxo-fn,.mxo-smark[data-active]{background:var(--accent-primary,#D97757);border-color:var(--accent-primary,#D97757);color:#fff}' +
    // ─── right panel ─────────────────────────────────────────────────
    '.mxo-rail{display:none}' +
    // Sticky so the panel stays in view when the wrapped template is taller
    // than the viewport — the template scrolls, the panel doesn't.
    ':host([data-funnel-view=panel]) .mxo-rail{display:flex;flex-direction:column;position:sticky;top:16px;max-height:var(--mxo-panel-max-h,calc(100vh - 32px));overflow-y:auto;background:var(--bg-surface,#fff);border:1px solid var(--border-subtle,rgba(15,12,8,.08));border-radius:14px;box-shadow:var(--shadow-sm,0 1px 3px rgba(20,20,19,.06));padding:18px 16px;min-height:200px;box-sizing:border-box}' +
    '.mxo-fhdr{display:flex;align-items:start;gap:8px;margin:0 0 10px}' +
    '.mxo-pctl{display:flex;align-items:center;gap:4px;flex:none}' +
    '.mxo-play{flex:none;display:grid;place-items:center;width:26px;height:26px;margin-top:1px;border:0;border-radius:6px;background:var(--accent-black,#191915);color:var(--text-inverse,#FAF9F5);cursor:default}' +
    '.mxo-play:hover{filter:brightness(1.2)}.mxo-play:disabled{opacity:.3}' +
    '.mxo-play[data-on]{background:var(--accent-primary,#D97757)}' +
    '.mxo-restart{flex:none;display:grid;place-items:center;width:26px;height:26px;margin-top:1px;border:1px solid var(--border-default,rgba(15,12,8,.14));border-radius:6px;background:var(--bg-surface,#fff);color:var(--text-secondary,rgba(15,12,8,.64));cursor:default}' +
    '.mxo-restart:hover{background:rgba(15,12,8,.04);color:var(--text-primary,rgba(15,12,8,.92))}' +
    '.mxo-pn{font:550 11px/26px var(--font-ui,-apple-system,sans-serif);color:var(--text-tertiary,rgba(15,12,8,.48));padding:0 2px}' +
    '.mxo-rec{display:flex;align-items:center;justify-content:center;width:100%;height:34px;margin:0 0 14px;border:1px solid var(--border-default,rgba(15,12,8,.14));border-radius:9px;font:550 12.5px/1 var(--font-ui,-apple-system,sans-serif);cursor:default;background:var(--bg-surface,#fff);color:var(--text-primary,rgba(15,12,8,.92))}' +
    '.mxo-rec:hover{background:rgba(15,12,8,.04)}' +
    '.mxo-rec[data-on]{background:var(--accent-error,#A63244);border-color:var(--accent-error,#A63244);color:#fff}' +
    ':host([data-recording]) .mxo-stage{box-shadow:inset 0 0 0 2px var(--accent-error,#A63244),var(--shadow-sm,0 1px 3px rgba(20,20,19,.06))}' +
    '.mxo-ftitle{flex:1;min-width:0;font:500 17px/1.3 var(--font-display,ui-serif,Georgia,serif);outline:none;border-radius:4px;padding:2px 4px;margin-left:-4px;overflow-wrap:anywhere}' +
    '.mxo-ftitle:hover{background:rgba(15,12,8,.04)}.mxo-ftitle:focus{background:rgba(15,12,8,.06);box-shadow:0 0 0 2px rgba(15,12,8,.12)}' +
    '.mxo-fdel{flex:none;display:grid;place-items:center;width:26px;height:26px;margin-top:1px;border:0;border-radius:6px;background:none;color:var(--text-tertiary,rgba(15,12,8,.48));cursor:default}' +
    '.mxo-fdel:hover{background:rgba(15,12,8,.06);color:var(--accent-error,#A63244)}' +

    '.mxo-smark{position:absolute;min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;border-radius:9px;background:var(--bg-surface,#fff);border:1px solid rgba(15,12,8,.15);color:var(--text-secondary,rgba(15,12,8,.64));font:600 10px/16px var(--font-ui,-apple-system,sans-serif);text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.12);z-index:110}' +
    '.mxo-frow{position:relative;padding:0 0 6px 26px;margin-bottom:10px}' +
    '.mxo-fn{position:absolute;left:0;top:0;min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;border-radius:9px;background:var(--bg-surface,#fff);border:1px solid rgba(15,12,8,.15);color:var(--text-secondary,rgba(15,12,8,.64));font:600 10px/16px var(--font-ui,-apple-system,sans-serif);text-align:center}' +
    '.mxo-fhd{display:flex;align-items:center;gap:7px;font:550 12.5px/1.3 var(--font-ui,-apple-system,sans-serif)}' +
    '.mxo-flbl{outline:none;border-radius:3px;padding:1px 3px;margin:-1px -3px;min-width:1ch}' +
    '.mxo-flbl:hover{background:rgba(15,12,8,.04)}.mxo-flbl:focus{background:rgba(15,12,8,.06);box-shadow:0 0 0 2px rgba(15,12,8,.12)}' +
    '.mxo-fx{margin-left:auto;border:0;background:none;padding:2px 4px;font:400 13px/1 var(--font-ui,-apple-system,sans-serif);color:var(--text-tertiary,rgba(15,12,8,.48));cursor:default}' +
    '.mxo-fx:hover{color:var(--accent-error,#A63244)}' +
    '.mxo-fev{font:500 10.5px/1.4 var(--font-mono,ui-monospace,monospace);color:var(--text-tertiary,rgba(15,12,8,.48));margin:2px 0 5px}' +
    '.mxo-fev.gap{color:rgba(15,12,8,.4)}' +
    '.mxo-fdata{display:flex;align-items:center;gap:10px;margin-top:4px}' +
    '.mxo-fbar{flex:1;position:relative;height:7px;border-radius:4px;background:rgba(15,12,8,.06);overflow:hidden}' +
    '.mxo-fbar>span{position:absolute;inset:0 auto 0 0;border-radius:4px;background:var(--accent-primary,#D97757)}' +
    '.mxo-fbar.gap{background:repeating-linear-gradient(45deg,rgba(15,12,8,.10) 0 4px,transparent 4px 8px)}' +
    '.mxo-fbar.gap>span{display:none}' +
    '.mxo-fdrop{font:650 12px/1 var(--font-ui,-apple-system,sans-serif);font-variant-numeric:tabular-nums;min-width:40px;text-align:right}' +
    '.mxo-fnum{font:500 10.5px/1 var(--font-ui,-apple-system,sans-serif);color:var(--text-tertiary,rgba(15,12,8,.48));font-variant-numeric:tabular-nums;min-width:36px;text-align:right}' +
    '.mxo-fnote{font:400 11px/1.45 var(--font-ui,-apple-system,sans-serif);color:var(--text-tertiary,rgba(15,12,8,.48));margin:8px 0 0}' +
    '.mxo-fnote b{color:var(--text-secondary,rgba(15,12,8,.64));font-weight:600}' +
    '.mxo-fempty{font:400 12.5px/1.5 var(--font-ui,-apple-system,sans-serif);color:var(--text-tertiary,rgba(15,12,8,.48));padding:32px 12px;text-align:center}' +
    '.mxo-fempty b{color:var(--text-secondary,rgba(15,12,8,.64));font-weight:600}' +
    '.mxo-facts{display:flex;flex-direction:column;gap:8px;margin-top:auto;padding-top:14px}' +
    '.mxo-ffoot{display:flex;align-items:center;gap:8px;font:400 11px/1.4 var(--font-ui,-apple-system,sans-serif);color:var(--text-tertiary,rgba(15,12,8,.48))}';

  // ─── <metrics-overlay> ───────────────────────────────────────────────
  class MetricsOverlay extends HTMLElement {
    static get observedAttributes() {
      return ['src', 'global', 'mode', 'window', 'lens', 'from', 'to', 'controls', 'adapter-opts',
        'funnel-src', 'funnelsrc', 'funnel', 'mock-funnel', 'mockfunnel'];
    }

    constructor() {
      super();
      var root = this.attachShadow({ mode: 'open' });
      root.innerHTML =
        '<style>' + CSS + '</style>' +
        '<div class="mxo-sent" part="sentence"></div>' +
        '<div class="mxo-sentsub" part="subline"></div>' +
        '<div class="mxo-shelf" part="shelf"></div>' +
        '<div class="mxo-split">' +
        '  <div>' +
        '    <div class="mxo-stage" part="stage"><slot></slot><div class="mxo-layer"></div></div>' +
        '    <div class="mxo-legend" part="legend"></div>' +
        '  </div>' +
        '  <div class="mxo-rail" part="funnel"></div>' +
        '</div>';
      this._sent = root.querySelector('.mxo-sent');
      this._sub = root.querySelector('.mxo-sentsub');
      this._shelf = root.querySelector('.mxo-shelf');
      this._stage = root.querySelector('.mxo-stage');
      this._layer = root.querySelector('.mxo-layer');
      this._rail = root.querySelector('.mxo-rail');
      this._legend = root.querySelector('.mxo-legend');
      this._opts = {};    // configure()
      this._rpopOpen = false;
      this._rects = [];
      this._snapshot = null;  // {entries:[…], adapters:[…], adapterOpts} — normalised multi-entry cache
      this._raw = null;       // the currently-active entry of _snapshot.entries
      this._adapter = null;
      this._loadGen = 0;
      var self = this;
      // sentence-builder delegated handlers (survive _renderSentence rebuilds)
      this._sent.addEventListener('change', function (e) {
        var k = e.target && e.target.getAttribute('data-k');
        if (k === 'mode' || k === 'lens') self.setAttribute(k, e.target.value);
      });
      this._sent.addEventListener('input', function (e) {
        // Filling the from-date enables Apply without re-rendering (which
        // would close the popover); to defaults to the snapshot's asOf.
        if (e.target.getAttribute('data-k') !== 'from') return;
        var ap = self._sent.querySelector('.mxo-apply');
        if (ap) ap.disabled = !e.target.value;
      });
      var closeRpop = function () {
        self._rpopOpen = false;
        var p = self._sent.querySelector('.mxo-rpop');
        if (p) p.removeAttribute('data-open');
      };
      this._sent.addEventListener('click', function (e) {
        var pre = e.target.closest('.mxo-preset');
        if (pre) {
          closeRpop();
          self.removeAttribute('from'); self.removeAttribute('to');
          self.setAttribute('window', pre.getAttribute('data-win'));
          return;
        }
        if (e.target.closest('.mxo-apply')) {
          var f = self._sent.querySelector('.mxo-idate[data-k=from]');
          var t = self._sent.querySelector('.mxo-idate[data-k=to]');
          if (!f || !f.value) return;
          var fv = f.value, tv = (t && t.value) || asDT(self._adapter ? self._adapter.asOf : '');
          if (tv && fv > tv) { var x = fv; fv = tv; tv = x; }
          closeRpop();
          self.setAttribute('from', fv);
          self.setAttribute('to', tv);
          self.setAttribute('window', 'range');
          return;
        }
        // Clicks inside the popover (on a date input, on whitespace) mustn't
        // re-toggle it — only the token label itself does that.
        if (e.target.closest('.mxo-rpop')) return;
        var rt = e.target.closest('.mxo-tok[data-k=range]');
        if (rt) {
          var p = rt.querySelector('.mxo-rpop');
          self._rpopOpen = !self._rpopOpen;
          if (p) { if (self._rpopOpen) p.setAttribute('data-open', ''); else p.removeAttribute('data-open'); }
          return;
        }
        if (!e.target.closest('[data-ask=refetch]')) return;
        // Clicking the muted "Getting…" chip reverts immediately (the chat turn
        // is already in flight — nothing to abort; this is the "I changed my
        // mind" / "it's been a while" reset).
        if (self.getAttribute('data-state') === 'loading') {
          clearTimeout(self._askTimeout);
          self._setState(self._stale ? 'stale' : self._hasData() ? null : 'empty');
          return;
        }
        self.refetch(self._staleReason || 'manual');
      });
      // Close the popover on outside click / Escape.
      this._onDoc = function (e) {
        if (!self._rpopOpen) return;
        if (e.type === 'keydown' && e.key !== 'Escape') return;
        if (e.type === 'click' && e.composedPath().indexOf(self._sent) >= 0) return;
        self._rpopOpen = false;
        var p = self._sent.querySelector('.mxo-rpop');
        if (p) p.removeAttribute('data-open');
      };
      this.addEventListener('metrics:reload', function () { self._load(); self._loadFunnels(); });
      // Host → preview reload nudge (so <metrics-funnel> widgets also sync).
      this._onMsg = function (e) {
        if (!e.data || e.data.type !== 'metrics:reload') return;
        // scope:'funnels' is the echo of our OWN save — this element is the
        // source of truth for _funnels, so re-reading the file here would
        // clobber optimistic edits / mid-type contenteditables / the Getting…
        // state. <metrics-funnel> widgets DO re-read on it.
        if (e.data.scope === 'funnels') return;
        self._load(); self._loadFunnels();
      };

      // ─── funnels ─────────────────────────────────────────────────
      this._funnels = null;  // loaded array (or null while funnel-src loads)
      this._fBusy = null;    // name of the flow currently being (re)computed
      // Shelf: pill clicks toggle the right panel via the 'funnel' attr.
      this._shelf.addEventListener('click', function (e) {
        var p = e.target.closest('.mxo-pill');
        if (!p) return;
        if (p.classList.contains('mxo-add')) { self._flushSave(); self._addFlow(); return; }
        var to = p.getAttribute('data-funnel');
        var cur = self.getAttribute('funnel') || 'off';
        self.setAttribute('funnel', to === cur ? 'off' : to);
      });
      // Record mode: capture-phase click on the stage watches the slotted
      // light DOM. Clicks on data-metric-id append a step AND fire through
      // (so multi-screen flows record themselves as you use the product).
      this._stage.addEventListener('click', function (e) {
        if (self.getAttribute('mode') === 'off') return;  // tweak-off passthrough
        var cur = self._curFunnel();
        if (!cur || !self._recording) return;
        var t = e.target.closest && e.target.closest('[data-metric-id]');
        if (!t || !self.contains(t)) return;
        var id = t.getAttribute('data-metric-id');
        // Already recorded → plain click just fires (navigation), no-op here.
        if (cur.def.steps.some(function (s) { return s.id === id; })) return;
        var m = self._adapter ? self._adapter.meta(id) : null;
        var scr = t.closest('[data-funnel-screen]');
        cur.def.steps.push({
          id: id,
          screen: scr ? scr.getAttribute('data-funnel-screen') : '',
          label: (m && m.label) || t.textContent.trim().slice(0, 40) || id,
          ev: m ? m.ev : null,
          inst: !m || m.inst !== false,
        });
        self._flash(id);
        self._commitDef(cur);
      }, true);
      // Right panel: title / label edit · ▶⏸⟲ · Record · × · delete · Get latest numbers.
      this._rail.addEventListener('keydown', function (e) {
        if ((e.target.classList.contains('mxo-ftitle') || e.target.classList.contains('mxo-flbl')) && e.key === 'Enter') {
          e.preventDefault(); e.target.blur();
        }
      });
      // Title + step-label edits commit on blur: optimistic in-memory edit
      // then a debounced metrics:funnel {action:'save'} so the host rewrites
      // funnels.json. Labels aren't part of def.hash so a label-only edit
      // keeps result fresh.
      this._rail.addEventListener('focusout', function (e) {
        var cur = self._curFunnel();
        if (!cur) return;
        if (e.target.classList.contains('mxo-ftitle')) {
          var nm = e.target.textContent.trim().slice(0, 80) || 'Untitled flow';
          // 'off' is the funnel attr's routing token — unreachable as a name.
          if (nm === 'off') nm = 'off (flow)';
          nm = self._dedupeName(nm, cur);
          if (nm === cur.name) { self._renderFunnel(); return; }
          clearTimeout(self._saveT); self._saveF = null;
          var old = cur.name, wasRec = self._recording;
          cur.name = nm;
          self.setAttribute('funnel', nm);  // keeps pill + panel in sync; resets recording →
          if (wasRec) self._setRecording(true);  // …restore
          self.postFunnel('save', nm, cur.def, { oldName: old });
        } else if (e.target.classList.contains('mxo-flbl')) {
          var li = parseInt(e.target.getAttribute('data-ix'), 10);
          var s = cur.def.steps[li];
          if (!s) return;
          var lbl = e.target.textContent.trim().slice(0, 60) || s.id;
          if (lbl === (s.label || s.id)) return;
          s.label = lbl;
          self._commitDef(cur, false);  // label-only: don't re-hash
        }
      });
      this._rail.addEventListener('click', function (e) {
        var cur = self._curFunnel();
        var x = e.target.closest('.mxo-fx');
        if (x && cur) {
          var ix = parseInt(x.getAttribute('data-ix'), 10);
          if (ix >= 0) { cur.def.steps.splice(ix, 1); self._commitDef(cur); }
          return;
        }
        if (e.target.closest('.mxo-play') && cur) {
          if (self._playing === 'playing') self._pause();
          else if (self._playing === 'paused' && self._playFlow === cur) self._play(cur, self._playIx);
          else self._play(cur, 0);
          return;
        }
        if (e.target.closest('.mxo-restart') && cur) {
          self._play(cur, 0);
          return;
        }
        if (e.target.closest('.mxo-rec')) {
          self._setRecording(!self._recording);
          return;
        }
        if (e.target.closest('.mxo-fdel') && cur) {
          clearTimeout(self._saveT); self._saveF = null;
          // Optimistic remove + post delete so the host drops it from
          // funnels.json. No confirm — the file's recoverable.
          var ix2 = self._funnels.indexOf(cur);
          if (ix2 >= 0) self._funnels.splice(ix2, 1);
          self.setAttribute('funnel', 'off');
          self.postFunnel('delete', cur.name, cur.def);
          return;
        }
        var ask = e.target.closest('.mxo-ask');
        if (!ask || ask.disabled || ask.hasAttribute('data-busy') || !cur) return;
        self._flushSave();
        self.postFunnel('compute', cur.name, cur.def);
      });
    }

    connectedCallback() {
      var self = this;
      // Geometry probe — slotted content is light DOM, so query on the host.
      // A single rAF isn't enough for late-mounting content (popovers,
      // transitions): the MutationObserver fires, but on that first frame the
      // new nodes are still width/height < 2 and get skipped. So each schedule
      // also runs a short trailing chain (~80ms apart, up to 3 retries while
      // any [data-metric-id] node is still under-size).
      var schedule = this._schedule = function () {
        cancelAnimationFrame(self._raf); clearTimeout(self._trail);
        self._retries = 0;
        self._raf = requestAnimationFrame(function () { self._measure(); });
        self._trail = setTimeout(function trail() {
          if (self._measure() && self._retries < 3) { self._retries++; self._trail = setTimeout(trail, 80); }
        }, 80);
      };
      this._mo = new MutationObserver(schedule);
      this._mo.observe(this, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'data-metric-id', 'data-metric-scope'] });
      this._ro = new ResizeObserver(schedule);
      this._ro.observe(this._stage);
      window.addEventListener('resize', this._onWin = schedule);
      document.addEventListener('click', this._onDoc, true);
      document.addEventListener('keydown', this._onDoc, true);
      window.addEventListener('message', this._onMsg);
      // initial burst — child DC/x-import content may stream in
      var n = 0; this._burst = setInterval(function () { self._measure(); if (++n > 12) clearInterval(self._burst); }, 120);
      this._load();
      this._loadFunnels();
      this._render();
    }

    disconnectedCallback() {
      if (this._mo) this._mo.disconnect();
      if (this._ro) this._ro.disconnect();
      window.removeEventListener('resize', this._onWin);
      document.removeEventListener('click', this._onDoc, true);
      document.removeEventListener('keydown', this._onDoc, true);
      window.removeEventListener('message', this._onMsg);
      clearInterval(this._burst);
      cancelAnimationFrame(this._raf);
      clearTimeout(this._trail);
      clearTimeout(this._askTimeout);
      clearTimeout(this._fBusyT);
      clearTimeout(this._saveT);
      clearTimeout(this._playT);
      clearTimeout(this._locateT);
      this._playing = null; this._playFlow = null;
      clearTimeout(this._mockT);
      if (this._scriptEl) this._scriptEl.remove();
      this._loadGen++; this._fLoadGen = (this._fLoadGen || 0) + 1;  // discard any in-flight _load/_loadFunnels so a late resolution can't revive a detached element
    }

    attributeChangedCallback(name, prev, next) {
      if (!this.shadowRoot || prev === next) return;
      if (name === 'src' || name === 'global') this._load();
      else if (name === 'funnel-src' || name === 'funnelsrc') this._loadFunnels();
      else if (name === 'funnel') { this._flushSave(); this._stopPlay(); this._setRecording(false); this._render(); }
      else if (name === 'adapter-opts') this._rebuildAdapter();
      else this._render();
    }

    configure(opts) {
      this._opts = Object.assign({}, this._opts, opts || {});
      this._rebuildAdapter();
      return this;
    }

    measure() {
      if (this._schedule) this._schedule(); else this._measure();
      return this;
    }

    get funnels() { return this._funnels; }

    postFunnel(action, name, def, opts) {
      opts = opts || {};
      var src = this._funnelSrc();
      // Preserve an existing hash so a djb2 change here can't strand a
      // previously-computed result as permanently stale (the agent echoes
      // defHash verbatim, so old-hash result + new-hash recompute = mismatch).
      def = Object.assign({}, def, { hash: def.hash || defHash(def) });
      var steps = (def.steps || []).filter(function (s) { return s.inst !== false && s.ev; });
      // Only compute reaches the agent; save/delete are host file writes.
      var fallbackPrompt = '';
      if (action !== 'save' && action !== 'delete') {
        fallbackPrompt = 'In ' + (src || 'funnels.json') + ', ' +
          (action === 'compute' ? 'recompute' : 'upsert {name:"' + name + '",def} and compute') +
          ' the "' + name + '" user flow: per-user ordered first-occurrence of ' +
          steps.map(function (s) { return s.ev; }).join(' → ') +
          ' over ' + (def.window || '28d') + ' ending ' + def.asOf +
          '. Write result {defHash:"' + def.hash + '",asOf,ranAt,rows:[{step,users}],gaps} back into that entry (echo defHash verbatim), then reload the overlay.';
      }
      var msg = { type: 'metrics:funnel', action: action, src: src, name: name, def: def,
        oldName: opts.oldName || undefined,
        // Full current array so a host with project-file access can write
        // funnels.json directly without a read (save/delete are just file
        // writes — no agent turn).
        funnels: (this._funnels || []).map(function (f) { return { name: f.name, def: f.def, result: f.result || null }; }),
        snapshotSrc: this.getAttribute('src') || '', fallbackPrompt: fallbackPrompt };
      try { window.parent.postMessage(msg, '*'); } catch (e) {}
      this.dispatchEvent(new CustomEvent('metrics:funnel', { detail: msg, bubbles: true, composed: true }));
      // save/delete don't wait on a query — the optimistic in-memory edit
      // already rendered; the host just rewrites the file. No re-render
      // here (would wipe an active contenteditable caret).
      if (action === 'delete' || action === 'save') return;
      this._fBusy = name;
      this._renderShelf(); this._renderFunnel();
      // Mock round-trip keeps the demo page interactive when no host is
      // listening. Auto-on when parent===window (standalone preview); the
      // mock-funnel attr forces it either way when embedded.
      var mockAttr = this.getAttribute('mock-funnel');
      if (mockAttr == null) mockAttr = this.getAttribute('mockfunnel');
      var mock = mockAttr != null ? mockAttr !== 'off' && mockAttr !== 'false' : window.parent === window;
      var self = this;
      if (mock) {
        clearTimeout(this._mockT);
        this._mockT = setTimeout(function () { self._mockResult(name, def); }, 1200);
      }
      // Same 90s cap as refetch — if nothing ever rewrites funnel-src.
      clearTimeout(this._fBusyT);
      this._fBusyT = setTimeout(function () {
        if (self._fBusy === name) { self._fBusy = null; self._renderShelf(); self._renderFunnel(); }
      }, 90000);
    }

    refetch(reason) {
      var src = this.getAttribute('src') || '';
      var win = this._win();
      var filter = { window: win, lens: this.getAttribute('lens') || '', mode: this.getAttribute('mode') || 'heat',
        from: this.getAttribute('from') || '', to: this.getAttribute('to') || '' };
      var had = this._raw && this._raw.asOf ? ' (current entry is as of ' + this._raw.asOf + ')' : '';
      var when = win === 'range' ? 'the range ' + filter.from + ' to ' + filter.to
        : (WINDOWS.filter(function (w) { return String(w.key) === String(win); })[0] || WINDOWS[2]).sent.replace(/^(over|for) /, '');
      var qKeys = [];
      if (filter.lens) qKeys.push('lens:"' + filter.lens + '"');
      if (win === 'range') qKeys.push('from:"' + filter.from + '",to:"' + filter.to + '"');
      var fallbackPrompt = 'Refetch ' + (src || 'the metrics snapshot') + ' from the analytics source for ' + when + had +
        (filter.lens ? ', cohort lens ' + filter.lens : '') +
        '. Append a new entry to the snapshot file\'s entries[] array (same ids; fresh days[]/viewersDaily and per-element daily[]; set asOf; set query:{' +
        qKeys.join(',') + '}) so the overlay knows which filter it answers. The file is a cache keyed by query — append, don\'t overwrite the existing entries — then reload the overlay.';
      var msg = { type: 'metrics:refetch', src: src, filter: filter, reason: reason || 'manual', fallbackPrompt: fallbackPrompt };
      try { window.parent.postMessage(msg, '*'); } catch (e) {}
      this.dispatchEvent(new CustomEvent('metrics:refetch', { detail: msg, bubbles: true, composed: true }));
      this._setState('loading');
      // Cap the "Getting…" state — if the chat turn errors or never rewrites
      // the snapshot, the shimmer would run forever. 90s matches the
      // DS-thumbnail Ask-Claude cap (DesignSystemPane).
      clearTimeout(this._askTimeout);
      var self = this;
      this._askTimeout = setTimeout(function () {
        if (self.getAttribute('data-state') === 'loading') self._setState(self._stale ? 'stale' : self._hasData() ? null : 'empty');
      }, 90000);
    }

    _win() {
      var w = this.getAttribute('window') || '7';
      return w === 'range' ? 'range' : (parseInt(w, 10) || 7);
    }

    _setState(s) {
      if (s) this.setAttribute('data-state', s); else this.removeAttribute('data-state');
      this._renderSentence();
    }

    _hasData() {
      return !!(this._snapshot && this._snapshot.entries.some(function (e) { return e && e.elements && e.elements.length; }));
    }

    _load() {
      // attributeChangedCallback fires per-attr during parse, before
      // connectedCallback — skip until mounted so the initial warn/empty
      // flash and redundant script injections don't happen.
      if (!this.isConnected) return;
      var src = this.getAttribute('src');
      var gen = ++this._loadGen;
      var self = this;
      var done = function (raw) {
        if (gen !== self._loadGen) return;
        // Normalise to the multi-entry cache shape. A single-object snapshot
        // becomes a one-entry cache; adapterOpts is lifted to the top level.
        self._snapshot = !raw ? null
          : (Array.isArray(raw.entries) && raw.entries.length)
            ? { entries: raw.entries, adapterOpts: raw.adapterOpts }
            : { entries: [raw], adapterOpts: raw.adapterOpts };
        self._raw = null; self._adapter = null;
        self._rebuildAdapter();
        self._setState(self._hasData() ? null : 'empty');
        self._render();
      };
      var fail = function () { if (gen === self._loadGen) done(null); };
      // No src → host pre-loaded the snapshot onto window[global] (demo/SSR).
      if (!src) {
        var pg = this.getAttribute('global');
        return done(pg && window[pg] ? window[pg] : null);
      }
      // Resolve relative src against the document's base so it works inside
      // preview iframes (srcdoc / blob-URL documents), where a bare './x.js'
      // resolves against the wrong origin.
      var abs; try { abs = new URL(src, document.baseURI).href; } catch (e) { abs = src; }
      if (/\.json(\?|$)/i.test(src)) {
        fetch(abs, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(done).catch(fail);
      } else {
        var g = this.getAttribute('global');
        if (!g) { console.warn('<metrics-overlay> src=".js" requires a global= attribute.'); return fail(); }
        // Preserve any pre-loaded global so a src error can fall back to it
        // instead of dropping to 'empty'.
        var pre = window[g];
        try { delete window[g]; } catch (e) { window[g] = undefined; }
        // re-inject with cache-buster so metrics:reload sees the fresh file
        if (this._scriptEl) this._scriptEl.remove();
        var s = document.createElement('script');
        s.src = abs + (abs.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now();
        s.onload = function () { done(window[g] || null); };
        s.onerror = function () {
          if (gen !== self._loadGen) return;
          if (pre != null) window[g] = pre;
          done(pre || null);
        };
        this._scriptEl = s;
        document.head.appendChild(s);
      }
    }

    _rebuildAdapter() {
      var snap = this._snapshot;
      var attrOpts = {};
      var a = this.getAttribute('adapter-opts');
      if (a) { try { attrOpts = JSON.parse(a); } catch (e) { console.warn('<metrics-overlay> adapter-opts is not valid JSON:', e); } }
      var rawOpts = (snap && snap.adapterOpts) || {};
      var opts = Object.assign({}, rawOpts, attrOpts, this._opts);
      // One adapter per cache entry — _selectEntry() picks the active one.
      snap && (snap.adapters = snap.entries.map(function (e) { return createAdapter(e, opts); }));
      this._adapter = null; this._raw = null;
      this._render();
    }

    _selectEntry() {
      var snap = this._snapshot;
      if (!snap || !snap.adapters) return false;
      var q = { win: this._win(), lens: this.getAttribute('lens') || '',
        from: this.getAttribute('from') || '', to: this.getAttribute('to') || '' };
      // Newest satisfiable entry wins — satisfiable() already requires an
      // exact lens/range key match, so this is a single backward scan.
      for (var i = snap.entries.length - 1; i >= 0; i--) {
        if (snap.adapters[i].satisfiable(q)) {
          this._adapter = snap.adapters[i]; this._raw = snap.entries[i];
          return true;
        }
      }
      // No entry satisfies — keep the last active adapter so the stale hatch
      // overlays the numbers the user was just looking at (or fall back to
      // entries[0] on first render).
      if (!this._adapter) { this._adapter = snap.adapters[0]; this._raw = snap.entries[0]; }
      return false;
    }

    _lenses() {
      // Union cohorts across all entries so the lens <select> doesn't lose
      // options when the active entry is itself lens-scoped.
      var out = [{ key: '', label: 'All users' }], seen = { '': 1 };
      var snap = this._snapshot;
      if (snap) for (var i = 0; i < snap.entries.length; i++) {
        var cs = snap.entries[i] && snap.entries[i].cohorts || [];
        for (var j = 0; j < cs.length; j++) {
          if (seen[cs[j].tier]) continue; seen[cs[j].tier] = 1;
          out.push({ key: cs[j].tier, label: cs[j].label });
        }
      }
      return out;
    }

    _measure() {
      var sb = this._stage.getBoundingClientRect();
      var seen = {}, out = [], skipped = 0;
      // Slotted light-DOM — query on the host, not the shadow root.
      var els = this.querySelectorAll('[data-metric-id]');
      for (var i = 0; i < els.length; i++) {
        var el = els[i], id = el.getAttribute('data-metric-id');
        if (!id) continue;
        var r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) { skipped++; continue; }
        // Occlusion — centre covered by a sibling modal/popover inside the
        // overlay? The glyph layer sits at one z-index above all slotted
        // content, so painting a glyph for an occluded element would render
        // it on top of the occluder. Keep the rect in the set (space-mode's
        // per-scope denominators sum over it) and have _renderLayer skip
        // only the paint. (elementFromPoint ignores the layer — it's
        // pointer-events:none — and retargets shadow-DOM hits to the host.)
        var top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        var occ = !!(top && top !== this && top !== el && !el.contains(top) && !top.contains(el) && this.contains(top));
        var scopeEl = el.closest('[data-metric-scope]');
        var rect = { id: id, x: r.left - sb.left, y: r.top - sb.top, w: r.width, h: r.height, domScope: scopeEl ? scopeEl.getAttribute('data-metric-scope') : null, occluded: occ };
        // Dedup by id. A later visible instance replaces an earlier occluded
        // one (same action mirrored inside the popover that's occluding the
        // first); otherwise first-sized wins as before.
        var at = seen[id];
        if (at != null) { if (!occ && out[at].occluded) out[at] = rect; continue; }
        seen[id] = out.length;
        out.push(rect);
      }
      var prev = this._rects;
      var same = prev.length === out.length && out.every(function (r, j) {
        var p = prev[j];
        return p && p.id === r.id && p.domScope === r.domScope && p.occluded === r.occluded && Math.abs(p.x - r.x) < 0.5 && Math.abs(p.y - r.y) < 0.5 && Math.abs(p.w - r.w) < 0.5 && Math.abs(p.h - r.h) < 0.5;
      });
      if (!same) {
        this._rects = out; this._renderLayer();
        if (this._playing) this._setActiveStep(this._playIx - 1);
      }
      return skipped;
    }

    _render() {
      this._stale = false;
      this._staleReason = null;
      if (this._snapshot) {
        if (!this._selectEntry()) { this._stale = true; this._staleReason = 'filter-unsatisfiable'; }
        var s = this.getAttribute('data-state');
        if (s !== 'loading' && s !== 'empty') {
          if (this._stale) this.setAttribute('data-state', 'stale');
          else if (s === 'stale') this.removeAttribute('data-state');
        }
      }
      // The template is always visible; 'funnel' just toggles a right panel.
      // mode='off' is the tweak-off passthrough — no shelf, no panel,
      // regardless of the funnel attr.
      var mode = this.getAttribute('mode') || 'heat';
      var fv = mode === 'off' ? 'off' : this.getAttribute('funnel') || 'off';
      if (fv !== 'off') this.setAttribute('data-funnel-view', 'panel'); else this.removeAttribute('data-funnel-view');
      this._renderSentence();
      if (mode === 'off') {
        this._shelf.innerHTML = ''; this._rail.innerHTML = '';
        this._renderLayer();  // blanks for mode=off
      } else {
        this._renderShelf();
        this._renderFunnel();  // fills the rail (and calls _renderLayer)
      }
      var spec = MODES[mode] || MODES.heat;
      this._legend.innerHTML = mode !== 'off' && spec.legendHTML ? spec.legendHTML() : '';
    }

    _renderSentence() {
      var controls = this.getAttribute('controls') || 'sentence';
      var mode = this.getAttribute('mode') || 'heat';
      // mode='off' is the tweak-off passthrough — hide the sentence too,
      // regardless of controls, so a template that maps `mode` but forgets
      // `controls` doesn't show "Showing heat-map…" over an empty stage.
      if (controls === 'none' || mode === 'off') { this._sent.style.display = 'none'; this._sub.style.display = 'none'; return; }
      this._sent.style.display = ''; this._sub.style.display = '';
      var A = this._adapter;
      var win = this._win();
      var lens = this.getAttribute('lens') || '';
      var state = this.getAttribute('data-state');

      var modeSpec = MODES[mode] || MODES.heat;
      var lenses = this._lenses();
      var curLens = lenses.filter(function (l) { return l.key === lens; })[0] || lenses[0];

      var tok = function (label, k, opts, val) {
        var o = '';
        for (var i = 0; i < opts.length; i++) {
          o += '<option value="' + esc(opts[i].key) + '"' + (String(opts[i].key) === String(val) ? ' selected' : '') + '>' + esc(opts[i].label) + '</option>';
        }
        return '<span class="mxo-tok">' + esc(label) + '<span class="mxo-tcar">▾</span>' +
          '<select class="mxo-isel" data-k="' + k + '">' + o + '</select></span>';
      };
      var modeOpts = Object.keys(MODES).map(function (k) { return { key: k, label: MODES[k].label }; });

      // Range token: collapses window + as-of into one control. Presets
      // re-slice the loaded snapshot client-side; a custom from/to needs
      // an exact-match entry, otherwise it's a refetch. The popover's
      // datetime inputs are visible so they open natively cross-origin
      // (showPicker() is same-origin-only).
      var from = this.getAttribute('from') || '', to = this.getAttribute('to') || '';
      var curWin = WINDOWS.filter(function (w) { return String(w.key) === String(win); })[0];
      var rangeLabel = win === 'range'
        ? 'from ' + fmtDay(from) + ' to ' + fmtDay(to)
        : (curWin || WINDOWS[2]).sent;
      var asOf = A ? A.asOf : '';
      var presets = WINDOWS.map(function (w) {
        return '<button type="button" class="mxo-preset" data-win="' + esc(w.key) + '"' +
          (String(w.key) === String(win) ? ' data-on' : '') + '>' + esc(w.label) + '</button>';
      }).join('');
      var rangeTok = '<span class="mxo-tok" data-k="range">' + esc(rangeLabel) + '<span class="mxo-tcar">▾</span>' +
        '<div class="mxo-rpop">' +
        '<div class="mxo-presets">' + presets + '</div>' +
        '<div class="mxo-custom"><label>From</label>' +
        '<input type="datetime-local" class="mxo-idate" data-k="from" value="' + esc(asDT(from, '00:00')) + '" max="' + esc(asDT(to || asOf)) + '">' +
        '<label>to</label>' +
        '<input type="datetime-local" class="mxo-idate" data-k="to" value="' + esc(asDT(to || asOf)) + '" max="' + esc(asDT(asOf)) + '">' +
        '<button type="button" class="mxo-apply"' + (from ? '' : ' disabled') + '>Apply</button>' +
        '</div></div></span>';

      var ask = (this._stale || state === 'loading' || state === 'empty')
        ? askBtn('refetch', state === 'loading', false)
        : '';

      this._sent.innerHTML = 'Showing ' + tok(modeSpec.label.toLowerCase(), 'mode', modeOpts, mode) +
        ' for ' + tok(curLens.label.toLowerCase(), 'lens', lenses, lens) +
        ' ' + rangeTok + '.' + ask;
      if (this._rpopOpen) { var p = this._sent.querySelector('.mxo-rpop'); if (p) p.setAttribute('data-open', ''); }
      var s = A ? A.subline({ win: win, lens: lens, from: from, to: to }) : '';
      this._sub.textContent = (s ? s + ' — ' : '') + (modeSpec.explain || '');
    }

    _renderLayer() {
      var mode = this.getAttribute('mode') || 'heat';
      var A = this._adapter;
      var state = this.getAttribute('data-state');
      var rects = this._rects;

      // mode="off" is not a registered mode — it's the tweak-off passthrough
      // attr value (see the [mode=off][controls=none] CSS above).
      if (mode === 'off') { this._layer.innerHTML = ''; return; }
      var spec = MODES[mode] || MODES.heat;
      if (state === 'empty') {
        var h = '';
        for (var i = 0; i < rects.length; i++) {
          var r = rects[i];
          h += '<span class="mxo-empty" style="left:' + r.x + 'px;top:' + r.y + 'px;width:' + r.w + 'px;height:' + r.h + 'px"></span>';
        }
        h += '<div class="mxo-cta">No snapshot at <code>' + esc(this.getAttribute('src') || '') + '</code><br>Click <b>Get latest numbers</b> to have the agent query the analytics source.</div>';
        this._layer.innerHTML = h;
        return;
      }
      if (!A) { this._layer.innerHTML = ''; return; }

      // Unsatisfied custom range → paint last-week glyphs under the stale
      // hatch as "last-known numbers". Satisfied → span() slices days[] by
      // the requested dates and point() reads from that slice.
      var win = this._win();
      var q = { win: win === 'range' && this._stale ? 7 : win, lens: this.getAttribute('lens') || '',
        from: this.getAttribute('from') || '', to: this.getAttribute('to') || '' };
      var allPoints = rects.map(function (r) { return A.point(r.id, q, r.domScope); });
      var laid = rects.map(function (r) { return Object.assign({}, r); });
      layoutTags(laid);

      var html = '';
      for (var j = 0; j < laid.length; j++) {
        var r = laid[j];
        // Occluded rects stay in allRects/allPoints (space-mode denominators)
        // but don't paint — their glyph would sit on top of the occluder.
        if (r.occluded) continue;
        var meta = A.meta(r.id, r.domScope); if (!meta) continue;
        var pt = allPoints[j];
        var g = spec.glyph({ id: r.id, rect: r, meta: meta, point: pt, adapter: A, q: q, allRects: rects, allPoints: allPoints });
        if (!g) continue;
        var tip = r.id + ' — ' + meta.label + ' [' + meta.scope + ']' +
          (meta.ev ? '\nevent: ' + meta.ev : meta.suggest ? '\nsuggest: ' + meta.suggest : '\nuninstrumented') +
          (meta.note ? '\n' + meta.note : '');
        var t = r.tag;
        var leadH = t.below ? t.ty - (r.y + r.h) : r.y - (t.ty + 14);
        if (g.washHTML) html += '<div class="mxo-box" style="left:' + r.x + 'px;top:' + r.y + 'px;width:' + r.w + 'px;height:' + r.h + 'px">' + g.washHTML + '</div>';
        if (leadH > 2) html += '<span class="mxo-lead" style="left:' + t.cx + 'px;top:' + (t.below ? r.y + r.h : t.ty + 14) + 'px;height:' + leadH + 'px"></span>';
        if (g.tag) html += '<span class="' + g.tag.cls + '" style="left:' + t.cx + 'px;top:' + t.ty + 'px;transform:translateX(-50%);' + (g.tag.style || '') + '" title="' + esc(tip) + '">' + g.tag.html + '</span>';
      }
      // Step markers for the open flow — small white pills tucked top-left
      // of each element. Display-only; Play is how you walk the flow.
      var cf2 = this._curFunnel();
      var fsteps = cf2 ? cf2.def.steps : [];
      if (fsteps.length) {
        var byId = {};
        for (var s = 0; s < rects.length; s++) byId[rects[s].id] = rects[s];
        for (var d = 0; d < fsteps.length; d++) {
          var rr = byId[fsteps[d].id]; if (!rr || rr.occluded) continue;
          html += '<span class="mxo-smark" data-ix="' + d + '" style="left:' + (rr.x - 6) + 'px;top:' + (rr.y - 6) + 'px">' + (d + 1) + '</span>';
        }
      }
      this._layer.innerHTML = html;
    }

    // ─── funnels ───────────────────────────────────────────────────────

    _funnelSrc() {
      // Defaults so a template with no attr still gets the shelf + can save
      // its first flow (the host creates the file on first ＋Add).
      return this.getAttribute('funnel-src') || this.getAttribute('funnelsrc') || './funnels.json';
    }

    _loadFunnels() {
      if (!this.isConnected) return;
      var gen = this._fLoadGen = (this._fLoadGen || 0) + 1;
      var src = this._funnelSrc();
      var abs; try { abs = new URL(src, document.baseURI).href; } catch (e) { abs = src; }
      var self = this;
      fetch(abs, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (raw) {
          if (gen !== self._fLoadGen) return;
          var arr = raw == null ? [] : Array.isArray(raw) ? raw : [raw];
          // Fill def.hash for any entry the author didn't pre-hash.
          for (var i = 0; i < arr.length; i++) if (arr[i] && arr[i].def) arr[i].def.hash = arr[i].def.hash || defHash(arr[i].def);
          self._funnels = arr;
          self._fBusy = null; clearTimeout(self._fBusyT);
          self._render();
        })
        .catch(function () { if (gen !== self._fLoadGen) return; self._funnels = []; self._render(); });
    }

    _dedupeName(nm, skip) {
      var fs = this._funnels || [], out = nm, n = 2;
      while (fs.some(function (f) { return f !== skip && f.name === out; })) out = nm + ' ' + n++;
      return out;
    }

    // ＋Add → append a fresh empty entry, open it in record mode, and post
    // 'save' so the host stubs it into funnels.json.
    _addFlow() {
      if (!this._funnels) this._funnels = [];
      var A = this._adapter;
      var def = { steps: [], window: '28d', splitBy: '',
        asOf: (A && A.asOf) || new Date().toISOString().slice(0, 10), hash: '' };
      def.hash = defHash(def);
      var f = { name: this._dedupeName('Untitled flow'), def: def, result: null };
      this._funnels.push(f);
      this.setAttribute('funnel', f.name);
      this._setRecording(true);  // after the attr change (which defaults it off)
      this.postFunnel('save', f.name, f.def);
    }

    // Optimistic def edit: re-hash (unless rehash===false), re-render, and
    // post a debounced 'save' so rapid step-clicking lands as one file write.
    _commitDef(f, rehash) {
      this._stopPlay();
      if (rehash !== false) f.def.hash = defHash(f.def);
      this._renderShelf(); this._renderFunnel();
      var self = this;
      clearTimeout(this._saveT);
      this._saveF = f;
      this._saveT = setTimeout(function () { self._flushSave(); }, 500);
    }

    _flushSave() {
      clearTimeout(this._saveT);
      var f = this._saveF; this._saveF = null;
      if (f && this._funnels && this._funnels.indexOf(f) >= 0) {
        this.postFunnel('save', f.name, f.def);
      }
    }

    _curFunnel() {
      var fv = this.getAttribute('funnel') || 'off';
      if (fv === 'off' || !this._funnels) return null;
      for (var i = 0; i < this._funnels.length; i++) if (this._funnels[i].name === fv) return this._funnels[i];
      return null;
    }

    _mockResult(name, def) {
      var self = this, arr = (this._funnels || []).slice();
      var base = null, steps = def.steps || [];
      var rows = [], gaps = [];
      for (var i = 0; i < steps.length; i++) {
        var s = steps[i];
        if (s.inst === false || !s.ev) { gaps.push(s.id); continue; }
        var n = base == null ? 1000 : Math.round(base * (0.55 + Math.random() * 0.3));
        if (base == null) base = n; else n = Math.min(n, base);
        base = n;
        rows.push({ step: i, users: n });
      }
      var result = { defHash: def.hash, asOf: def.asOf, ranAt: new Date().toISOString(), rows: rows, gaps: gaps };
      var ix = -1;
      for (var j = 0; j < arr.length; j++) if (arr[j].name === name) { ix = j; break; }
      if (ix >= 0) arr[ix] = Object.assign({}, arr[ix], { result: result });
      else arr.push({ name: name, def: def, result: result });
      this._funnels = arr;
      this._fBusy = null; clearTimeout(this._fBusyT);
      this._render();
    }

    _setActiveStep(ix) {
      var set = function (els) {
        for (var i = 0; i < els.length; i++) {
          if (els[i].getAttribute('data-ix') === String(ix)) els[i].setAttribute('data-active', '');
          else els[i].removeAttribute('data-active');
        }
      };
      set(this._rail.querySelectorAll('.mxo-frow'));
      set(this._layer.querySelectorAll('.mxo-smark'));
    }

    _flash(id) {
      // Bare 'CSS' in this IIFE is the stylesheet string above; call the
      // global explicitly (with a no-op fallback for very old UAs).
      var cssEsc = window.CSS && window.CSS.escape ? window.CSS.escape : function (s) { return s; };
      var t = id ? this.querySelector('[data-metric-id="' + cssEsc(id) + '"]') : null;
      if (!t) return;
      try { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
      var sb = this._stage.getBoundingClientRect(), r = t.getBoundingClientRect();
      var ping = document.createElement('span');
      ping.className = 'mxo-ping';
      ping.setAttribute('style', 'left:' + (r.left - sb.left - 3) + 'px;top:' + (r.top - sb.top - 3) + 'px;width:' + (r.width + 2) + 'px;height:' + (r.height + 2) + 'px');
      this._stage.appendChild(ping);
      setTimeout(function () { ping.remove(); }, 1600);
    }

    // Scroll+flash a step's element; optionally click it (▶ Play). If it's
    // not visible (off-screen route), emit metrics:navigate so the host can
    // route there, then retry once. On a miss, pulse the panel row.
    _locate(id, screen, rowEl, doClick) {
      var self = this;
      var cssEsc = window.CSS && window.CSS.escape ? window.CSS.escape : function (s) { return s; };
      var find = function () {
        var t = id ? self.querySelector('[data-metric-id="' + cssEsc(id) + '"]') : null;
        // offsetParent is null for position:fixed too — use layout boxes.
        return t && t.isConnected && t.getClientRects().length ? t : null;
      };
      var hit = function (t) {
        self._flash(id);
        if (doClick) try { t.click(); } catch (e) {}
      };
      var t0 = find();
      if (t0) { hit(t0); return; }
      this.dispatchEvent(new CustomEvent('metrics:navigate',
        { detail: { screen: screen, id: id }, bubbles: true, composed: true }));
      clearTimeout(this._locateT);
      this._locateT = setTimeout(function () {
        var t1 = find();
        if (t1) { hit(t1); return; }
        if (rowEl) {
          rowEl.style.animation = 'mxo-pulse .6s ease-out';
          setTimeout(function () { rowEl.style.animation = ''; }, 600);
        }
      }, 250);
    }

    _play(f, fromIx) {
      var self = this, steps = f.def.steps;
      if (!steps.length) return;
      clearTimeout(this._playT); clearTimeout(this._locateT);
      this._playFlow = f; this._playing = 'playing';
      this._playIx = fromIx != null ? fromIx : 0;
      this._setRecording(false);
      var tick = function () {
        if (self._playing !== 'playing' || self._playFlow !== f) return;
        var s = steps[self._playIx];
        if (!s) { self._stopPlay(); return; }
        self._setActiveStep(self._playIx);
        var row = self._rail.querySelector('.mxo-frow[data-ix="' + self._playIx + '"]');
        self._locate(s.id, s.screen || '', row, true);
        self._playIx++;
        self._renderPlay();
        self._playT = setTimeout(tick, 900);
      };
      tick();
    }

    _pause() {
      if (this._playing !== 'playing') return;
      this._playing = 'paused';
      clearTimeout(this._playT); clearTimeout(this._locateT);
      this._renderPlay();
    }

    _setRecording(on) {
      this._recording = !!on;
      if (on) this.setAttribute('data-recording', ''); else this.removeAttribute('data-recording');
      this._renderFunnel();
    }

    _stopPlay() {
      if (!this._playing) return;
      this._playing = null; this._playFlow = null; this._playIx = 0;
      clearTimeout(this._playT); clearTimeout(this._locateT);
      this._setActiveStep(-1);
      this._renderFunnel();
    }

    // Re-render just the play controls (cheap; avoids wiping contenteditables).
    _renderPlay() {
      var f = this._curFunnel(); if (!f) return;
      var on = this._playing && this._playFlow === f;
      var h = '<button type="button" class="mxo-play"' + (on && this._playing === 'playing' ? ' data-on' : '') +
        (f.def.steps.length ? '' : ' disabled') + ' title="' +
        (on && this._playing === 'playing' ? 'Pause' : 'Play through the flow') + '">' +
        (on && this._playing === 'playing' ? pauseIcon : playIcon) + '</button>' +
        (on ? '<button type="button" class="mxo-restart" title="Restart">' + restartIcon + '</button>' +
          '<span class="mxo-pn">' + Math.min(this._playIx, f.def.steps.length) + '/' + f.def.steps.length + '</span>' : '');
      var slot = this._rail.querySelector('.mxo-pctl');
      if (slot) slot.innerHTML = h;
    }

    _renderShelf() {
      var fv = this.getAttribute('funnel') || 'off';
      var fs = this._funnels || [], h = '';
      for (var i = 0; i < fs.length; i++) {
        var f = fs[i];
        h += '<button type="button" class="mxo-pill" data-funnel="' + esc(f.name) + '"' + (fv === f.name ? ' data-on' : '') + '>' +
          miniSpark(f.result && f.result.rows) + esc(f.name) + '</button>';
      }
      h += '<button type="button" class="mxo-pill mxo-add">＋ Add user flow</button>';
      this._shelf.innerHTML = h;
    }

    _stepRows(steps, result) {
      // Walks steps in def order; result.rows may omit gap steps, so a
      // separate cursor tracks it. When there's no result yet the data
      // block (bar · drop% · count) is omitted.
      var A = this._adapter, rows = result && result.rows || null;
      var ri = 0, first = null, prev = null, h = '';
      for (var i = 0; i < steps.length; i++) {
        var s = steps[i], m = A ? A.meta(s.id) : null;
        var hasEv = s.ev || (m && m.ev);
        var gap = s.inst === false || !hasEv || (result && result.gaps && result.gaps.indexOf(s.id) >= 0);
        var n = null;
        if (!gap && rows) { var row = rows[ri]; if (row && (row.step === i || row.step == null)) { n = row.users; ri++; } }
        if (first == null && n != null) first = n || 1;
        var pct = n != null && first ? Math.min(1, n / first) : 0;
        var drop = (prev != null && n != null && prev)
          ? '−' + Math.max(0, Math.round(100 * (1 - n / prev))) + '%' : '';
        if (n != null) prev = n;
        var ev = gap ? '○ suggest: ' + esc((m && m.suggest) || s.ev || '—')
          : esc(s.ev || (m && m.ev) || '—');
        h += '<div class="mxo-frow" data-ix="' + i + '">' +
          '<span class="mxo-fn">' + (i + 1) + '</span>' +
          '<div class="mxo-fhd">' +
          '<span class="mxo-flbl" contenteditable spellcheck="false" data-ix="' + i + '">' + esc(s.label || s.id) + '</span>' +
          '<button type="button" class="mxo-fx" data-ix="' + i + '" title="Remove">×</button></div>' +
          '<div class="mxo-fev' + (gap ? ' gap' : '') + '">' + ev + '</div>' +
          (rows ? '<div class="mxo-fdata"><div class="mxo-fbar' + (gap ? ' gap' : '') + '"><span style="width:' + (pct * 100).toFixed(1) + '%"></span></div>' +
            '<span class="mxo-fdrop">' + (gap ? '' : drop) + '</span>' +
            '<span class="mxo-fnum">' + (gap ? '—' : fmtN(n)) + '</span></div>' : '') +
          '</div>';
      }
      return h;
    }

    _renderFunnel() {
      var fv = this.getAttribute('funnel') || 'off';
      if (fv === 'off') { this._rail.innerHTML = ''; this._renderLayer(); return; }
      var f = this._curFunnel();
      if (!f) { this._rail.innerHTML = '<div class="mxo-fempty">No user flow named "' + esc(fv) + '".</div>'; this._renderLayer(); return; }
      var A = this._adapter;
      var st = funnelState(f), busy = this._fBusy === f.name;
      var rec = this._recording;
      var empty = !f.def.steps.length;
      var rows = empty
        ? '<div class="mxo-fempty">' + (rec
            ? 'Click elements on the template to add steps.'
            : 'No steps yet — click <b>Record steps</b>, then click elements on the template.') + '</div>'
        : this._stepRows(f.def.steps, f.result);
      this._rail.innerHTML =
        '<div class="mxo-fhdr"><span class="mxo-pctl"></span>' +
        '<div class="mxo-ftitle" contenteditable spellcheck="false">' + esc(f.name) + '</div>' +
        '<button type="button" class="mxo-fdel" title="Delete user flow">' + trashIcon + '</button></div>' +
        '<button type="button" class="mxo-rec"' + (rec ? ' data-on' : '') + '>' +
        (rec ? 'Recording — click to stop' : 'Record steps') + '</button>' +
        rows +
        (empty ? '' : '<div class="mxo-facts">' +
          '<div class="mxo-ffoot">' +
          (st === 'stale' ? '<span class="mxo-chip stale">stale</span> ' : '') +
          (st ? esc(windowRange(f.result.asOf || f.def.asOf, f.def.window)) : 'No data yet') +
          '</div>' + askBtn('compute', busy, false) + '</div>');
      this._renderPlay();
      this._renderLayer();
      if (this._playing && this._playFlow === f) this._setActiveStep(this._playIx - 1);
    }
  }

  // statics
  MetricsOverlay.createAdapter = createAdapter;
  MetricsOverlay.registerMode = registerMode;
  MetricsOverlay.modes = function () { return Object.keys(MODES).map(function (k) { return { key: k, label: MODES[k].label, explain: MODES[k].explain }; }); };
  MetricsOverlay.util = { fmtN: fmtN, pctStr: pctStr, sliceSum: sliceSum };

  // ─── <metrics-funnel> — standalone read-only chart ───────────────────
  // Drop a computed funnel into a deck or doc without the overlay stage.
  // Reads the same funnels.json; renders title + bars + window·asOf caption.
  var FCSS =
    ':host{display:block;font-family:var(--font-ui,-apple-system,sans-serif);color:var(--text-primary,rgba(15,12,8,.92))}' +
    '.mf-title{font:500 18px/1.3 var(--font-display,ui-serif,Georgia,serif);margin:0 0 10px}' +
    '.mf-row{display:grid;grid-template-columns:minmax(100px,auto) 1fr 44px 44px;gap:12px;align-items:center;margin-bottom:6px;font:400 12px/1.3 var(--font-ui,-apple-system,sans-serif)}' +
    '.mf-bar{height:10px;border-radius:5px;background:rgba(15,12,8,.06);position:relative;overflow:hidden}' +
    '.mf-bar>span{position:absolute;inset:0 auto 0 0;border-radius:5px;background:var(--accent-primary,#D97757)}' +
    '.mf-drop{text-align:right;font-variant-numeric:tabular-nums;font-weight:650}' +
    '.mf-n{text-align:right;font-variant-numeric:tabular-nums;font-weight:500;color:var(--text-tertiary,rgba(15,12,8,.48))}' +
    '.mf-cap{font:400 11px/1 var(--font-ui,-apple-system,sans-serif);color:var(--text-tertiary,rgba(15,12,8,.48));margin-top:8px}';

  class MetricsFunnel extends HTMLElement {
    static get observedAttributes() { return ['src', 'name']; }
    constructor() {
      super();
      this.attachShadow({ mode: 'open' }).innerHTML = '<style>' + FCSS + '</style><div class="mf-body"></div>';
      this._body = this.shadowRoot.querySelector('.mf-body');
    }
    connectedCallback() {
      var self = this;
      this._onMsg = function (e) { if (e.data && e.data.type === 'metrics:reload') self._load(); };
      window.addEventListener('message', this._onMsg);
      this._load();
    }
    disconnectedCallback() { window.removeEventListener('message', this._onMsg); }
    attributeChangedCallback() { if (this.isConnected) this._load(); }
    _load() {
      var src = this.getAttribute('src'), name = this.getAttribute('name'), self = this;
      if (!src) { this._body.textContent = ''; return; }
      var abs; try { abs = new URL(src, document.baseURI).href; } catch (e) { abs = src; }
      fetch(abs, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (raw) {
        var arr = raw == null ? [] : Array.isArray(raw) ? raw : [raw];
        var f = null; for (var i = 0; i < arr.length; i++) if (!name || arr[i].name === name) { f = arr[i]; break; }
        if (!f) { self._body.innerHTML = '<div class="mf-cap">No user flow named "' + esc(name || '') + '"</div>'; return; }
        if (!f.result || !f.result.rows) { self._body.innerHTML = '<h3 class="mf-title">' + esc(f.name) + '</h3><div class="mf-cap">Not computed yet.</div>'; return; }
        var rows = f.result.rows, max = 0; for (var j = 0; j < rows.length; j++) if (rows[j].users > max) max = rows[j].users;
        var steps = f.def && f.def.steps || [], h = '<h3 class="mf-title">' + esc(f.name) + '</h3>';
        var prev = null;
        for (var k = 0; k < steps.length; k++) {
          var s = steps[k], row = null;
          for (var r2 = 0; r2 < rows.length; r2++) if (rows[r2].step === k) { row = rows[r2]; break; }
          var n = row ? row.users : null, w = n != null && max ? (100 * n / max).toFixed(1) : 0;
          var drop = (prev != null && n != null && prev)
            ? '−' + Math.max(0, Math.round(100 * (1 - n / prev))) + '%' : '';
          if (n != null) prev = n;
          h += '<div class="mf-row"><span>' + (k + 1) + '. ' + esc(s.label || s.id) + '</span>' +
            '<span class="mf-bar"><span style="width:' + w + '%"></span></span>' +
            '<span class="mf-drop">' + drop + '</span>' +
            '<span class="mf-n">' + (n == null ? '—' : fmtN(n)) + '</span></div>';
        }
        h += '<div class="mf-cap">' + esc(windowRange(f.result.asOf || '', (f.def && f.def.window) || '28d')) + '</div>';
        self._body.innerHTML = h;
      }).catch(function () { self._body.innerHTML = '<div class="mf-cap">Failed to load ' + esc(src) + '</div>'; });
    }
  }

  if (!customElements.get('metrics-overlay')) {
    customElements.define('metrics-overlay', MetricsOverlay);
  }
  if (!customElements.get('metrics-funnel')) {
    customElements.define('metrics-funnel', MetricsFunnel);
  }
  // Expose for hosts that want to drive it without a src file.
  window.MetricsOverlay = MetricsOverlay;
})();
