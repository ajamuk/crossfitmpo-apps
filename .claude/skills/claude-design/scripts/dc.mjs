#!/usr/bin/env node
/**
 * dc.mjs — CLI implementation of the Design Component tools:
 *   dc_write, dc_html_str_replace, dc_js_str_replace, dc_set_props,
 *   copy_starter_component.
 *
 * Usage:
 *   node dc.mjs write <File.dc.html> --html-file <tpl.html> [--js-file <logic.js>] [--props-file <props.json>]
 *   node dc.mjs html-replace <File.dc.html> (--find <str> | --find-file <f>) (--replace <str> | --replace-file <f>) [--multi]
 *   node dc.mjs js-replace   <File.dc.html> (--find <str> | --find-file <f>) (--replace <str> | --replace-file <f>) [--multi]
 *   node dc.mjs set-props    <File.dc.html> (--props-file <p.json> | --clear)
 *   node dc.mjs starter      <kind> [directory]        # e.g. deck_stage.js, ios_frame.jsx
 *   node dc.mjs support      [directory]               # copy/refresh support.js
 *
 * An empty --find ('') appends the replacement at the end of the section.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ASSETS = path.join(SKILL_DIR, 'assets');

const STARTERS = {
  'deck_stage.js': { file: 'deck-stage.js', note: 'Slide-deck shell web component. Mount from the template:\n  <x-import component-from-global-scope="deck-stage" from="./deck-stage.js" width="1920" height="1080" hint-size="100%,100%">\n    <section data-label="Title" data-speaker-notes="..." style="...">…</section>\n  </x-import>\nSlides are inline-styled <section data-label> children; do not position them yourself. Programmatic nav: document.querySelector(\'deck-stage\').goTo(n).' },
  'ios_frame.jsx': { file: 'ios-frame.jsx', note: 'iOS device bezel with status bar/keyboard. Mount via <x-import component="..." from="./ios-frame.jsx" hint-size="390px,844px">…</x-import> (check the file header for the exported component name).' },
  'android_frame.jsx': { file: 'android-frame.jsx', note: 'Android device bezel. Mount via <x-import component="..." from="./android-frame.jsx" hint-size="360px,800px">…</x-import>.' },
  'macos_window.jsx': { file: 'macos-window.jsx', note: 'macOS window chrome (traffic lights). Mount via <x-import component="..." from="./macos-window.jsx" hint-size="100%,600px">…</x-import>.' },
  'browser_window.jsx': { file: 'browser-window.jsx', note: 'Browser window chrome with tab bar. Mount via <x-import component="..." from="./browser-window.jsx" hint-size="100%,600px">…</x-import>.' },
  'animations.jsx': { file: 'animations.jsx', note: 'Timeline animation engine (Stage + Sprite + scrubber + Easing). Use for any standalone animation. Mount via <x-import> from "./animations.jsx".' },
  'tweaks_panel.jsx': { file: 'tweaks-panel.jsx', note: 'Tweaks panel shell: <TweaksPanel>, useTweaks(defaults), and TweakSection/Slider/Toggle/Radio/Select/Text/Number/Color/Button controls. .jsx — mount via <x-import> (Babel transpiles lazily; needs network on first view).' },
  'image_slot.js': { file: 'image-slot.js', note: '<image-slot> drag-and-drop image placeholder the USER fills in. Shape via shape/radius/clip-path attrs; give every slot a distinct id and a placeholder text. Plain web component — mount via <x-import component-from-global-scope="image-slot" from="./image-slot.js" …>.' },
  'metrics_overlay.js': { file: 'metrics-overlay.js', note: 'Metrics overlay web component. Plain JS — mount via <x-import component-from-global-scope="…" from="./metrics-overlay.js">.' },
};

function die(msg) { console.error('dc.mjs error: ' + msg); process.exit(1); }

function parseArgs(argv) {
  const pos = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (key === 'multi' || key === 'clear') { opts[key] = true; continue; }
      if (i + 1 >= argv.length) die(`--${key} needs a value`);
      opts[key] = argv[++i];
    } else pos.push(a);
  }
  return { pos, opts };
}

function readOpt(opts, name, { required = false } = {}) {
  if (opts[name] !== undefined) return opts[name];
  if (opts[name + '-file'] !== undefined) {
    const p = opts[name + '-file'];
    if (!fs.existsSync(p)) die(`--${name}-file: no such file: ${p}`);
    return fs.readFileSync(p, 'utf8');
  }
  if (required) die(`missing --${name} or --${name}-file`);
  return undefined;
}

function ensureSupport(dir) {
  const src = path.join(ASSETS, 'support.js');
  const dst = path.join(dir, 'support.js');
  const content = fs.readFileSync(src);
  if (!fs.existsSync(dst) || !fs.readFileSync(dst).equals(content)) {
    fs.writeFileSync(dst, content);
    console.log('wrote ' + dst);
  }
}

function escAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function assemble(name, tpl, logic, propsJson) {
  if (tpl.includes('</x-dc>')) die('template must not contain </x-dc>');
  if (/<\/script/i.test(logic)) die('logic must not contain "</script" (break the string up if you need it)');
  if (propsJson) {
    try { JSON.parse(propsJson); } catch (e) { die('props JSON is invalid: ' + e.message); }
  }
  const title = path.basename(name).replace(/\.dc\.html$/, '');
  const propsAttr = propsJson && propsJson.trim() ? ` data-props="${escAttr(propsJson.trim())}"` : '';
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escAttr(title)}</title>
<script src="support.js"></script>
</head>
<body>
<x-dc>
${tpl.replace(/\s+$/, '')}
</x-dc>
<script data-dc-script type="text/dc-logic"${propsAttr}>
${logic.replace(/\s+$/, '')}
</script>
</body>
</html>
`;
}

function locateParts(text, file) {
  const tplStart = text.indexOf('<x-dc>');
  const tplEnd = text.lastIndexOf('</x-dc>');
  if (tplStart < 0 || tplEnd < 0) die(`${file} has no <x-dc>…</x-dc> template — is it a .dc.html written by dc.mjs?`);
  const openTag = text.match(/<script[^>]*data-dc-script[^>]*>/);
  if (!openTag) die(`${file} has no <script data-dc-script> logic block`);
  const logicStart = openTag.index + openTag[0].length;
  const logicEnd = text.indexOf('</script>', logicStart);
  if (logicEnd < 0) die(`${file}: logic <script> is never closed`);
  return {
    tpl: { start: tplStart + '<x-dc>'.length, end: tplEnd },
    logic: { start: logicStart, end: logicEnd },
    openTag,
  };
}

function sectionReplace(file, section, find, replace, multi) {
  if (!fs.existsSync(file)) die('no such file: ' + file);
  const text = fs.readFileSync(file, 'utf8');
  const parts = locateParts(text, file);
  const range = parts[section];
  let body = text.slice(range.start, range.end);
  if (find === '') {
    body = body.replace(/\s+$/, '') + '\n' + replace + '\n';
  } else {
    const count = body.split(find).length - 1;
    if (count === 0) die(`find string not found in the ${section === 'tpl' ? 'template' : 'logic class'} of ${file}`);
    if (count > 1 && !multi) die(`find string occurs ${count}× in the ${section === 'tpl' ? 'template' : 'logic class'}; make it unique or pass --multi`);
    body = multi ? body.split(find).join(replace) : body.replace(find, replace);
  }
  fs.writeFileSync(file, text.slice(0, range.start) + body + text.slice(range.end));
  console.log(`edited ${section === 'tpl' ? 'template' : 'logic'} of ${file}`);
}

const { pos, opts } = parseArgs(process.argv.slice(2));
const cmd = pos[0];

switch (cmd) {
  case 'write': {
    const file = pos[1] || die('write: missing <File.dc.html>');
    if (!file.endsWith('.dc.html')) die('filename must end in .dc.html');
    const tpl = readOpt(opts, 'html', { required: true });
    const logic = readOpt(opts, 'js') ?? '';
    const props = readOpt(opts, 'props');
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    fs.writeFileSync(file, assemble(file, tpl, logic, props));
    ensureSupport(path.dirname(path.resolve(file)));
    console.log('wrote ' + file);
    break;
  }
  case 'html-replace':
  case 'js-replace': {
    const file = pos[1] || die(cmd + ': missing <File.dc.html>');
    const find = readOpt(opts, 'find');
    const replace = readOpt(opts, 'replace');
    if (find === undefined || replace === undefined) die('need --find/--find-file and --replace/--replace-file (use --find "" to append)');
    sectionReplace(file, cmd === 'html-replace' ? 'tpl' : 'logic', find, replace, !!opts.multi);
    break;
  }
  case 'set-props': {
    const file = pos[1] || die('set-props: missing <File.dc.html>');
    if (!fs.existsSync(file)) die('no such file: ' + file);
    const text = fs.readFileSync(file, 'utf8');
    const parts = locateParts(text, file);
    let props = '';
    if (!opts.clear) {
      props = readOpt(opts, 'props', { required: true }).trim();
      try { JSON.parse(props); } catch (e) { die('props JSON is invalid: ' + e.message); }
    }
    const oldTag = parts.openTag[0];
    const typeMatch = oldTag.match(/type="[^"]*"/);
    const newTag = `<script data-dc-script ${typeMatch ? typeMatch[0] : 'type="text/dc-logic"'}${props ? ` data-props="${escAttr(props)}"` : ''}>`;
    fs.writeFileSync(file, text.slice(0, parts.openTag.index) + newTag + text.slice(parts.openTag.index + oldTag.length));
    console.log((props ? 'set' : 'cleared') + ' data-props on ' + file);
    break;
  }
  case 'starter': {
    const kind = pos[1] || die('starter: missing <kind>. Available: ' + Object.keys(STARTERS).join(', '));
    const entry = STARTERS[kind];
    if (!entry) die(`unknown kind "${kind}" (the extension is part of the name). Available: ` + Object.keys(STARTERS).join(', '));
    const dir = pos[2] || '.';
    fs.mkdirSync(dir, { recursive: true });
    const dst = path.join(dir, entry.file);
    fs.copyFileSync(path.join(ASSETS, 'starters', entry.file), dst);
    console.log('wrote ' + dst + '\n\nUsage:\n' + entry.note);
    break;
  }
  case 'support': {
    ensureSupport(pos[1] || '.');
    break;
  }
  default:
    die('unknown command "' + (cmd || '') + '". Commands: write, html-replace, js-replace, set-props, starter, support');
}
