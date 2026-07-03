#!/usr/bin/env node
/**
 * verify.mjs — implementation of ready_for_verification.
 *
 * Serves the file's directory over local HTTP (so dc-import/x-import siblings
 * resolve, which they never do from file://), loads the page in headless
 * Chromium, and reports console errors/warnings and load diagnostics collected
 * by support.js (or by an injected collector for plain .html files).
 *
 * Usage:
 *   node verify.mjs <File.dc.html|File.html> [--screenshot out.png] [--width 1280] [--height 900] [--budget 5000]
 *
 * Exit code 0 = clean load, 1 = errors found.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFile } from 'node:child_process';

// execFile (async) is required: a synchronous exec would block the event loop
// and deadlock the local HTTP server that Chromium is trying to load from.
function run(bin, flags) {
  return new Promise((resolve, reject) => {
    execFile(bin, flags, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 90000 }, (err, stdout) => {
      if (err) reject(err); else resolve(stdout);
    });
  });
}

function die(msg) { console.error('verify.mjs error: ' + msg); process.exit(2); }

const args = process.argv.slice(2);
const pos = [];
const opts = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) opts[args[i].slice(2)] = args[++i];
  else pos.push(args[i]);
}
const file = pos[0] || die('missing file argument');
const abs = path.resolve(file);
if (!fs.existsSync(abs)) die('no such file: ' + abs);
const dir = path.dirname(abs);
const budget = parseInt(opts.budget || '5000', 10);
const width = parseInt(opts.width || '1280', 10);
const height = parseInt(opts.height || '900', 10);

/* ---------- find chromium ---------- */
function findChrome() {
  const candidates = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium'];
  for (const base of ['/opt/pw-browsers']) {
    if (fs.existsSync(base)) {
      for (const d of fs.readdirSync(base)) {
        candidates.push(path.join(base, d, 'chrome-linux', 'chrome'));
        candidates.push(path.join(base, d, 'chrome-linux', 'headless_shell'));
      }
    }
  }
  candidates.push('/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      const st = fs.statSync(c);
      if (st.isFile() && (st.mode & 0o111)) return c;
    }
  }
  die('no Chromium/Chrome binary found (set CHROME_PATH to point at one)');
}
const chrome = findChrome();

/* ---------- diag collector injected into plain html ---------- */
const COLLECTOR = `<script>(function(){if(window.__dcDiagListeners)return;window.__dcDiagListeners=true;
var d=window.__dcDiag={errors:[],warnings:[],ready:true};var el=null;
function sync(){try{if(!el){el=document.createElement('script');el.type='application/json';el.id='__dc_diag';document.documentElement.appendChild(el);}el.textContent=JSON.stringify(d);}catch(e){}}
function rep(k,m){d[k].push(String(m).slice(0,2000));sync();}
window.addEventListener('error',function(e){rep('errors',(e.message||'Script error')+(e.filename?' @ '+e.filename+':'+e.lineno:''));});
window.addEventListener('unhandledrejection',function(e){var r=e.reason;rep('errors','Unhandled rejection: '+((r&&(r.stack||r.message))||r));});
var ce=console.error.bind(console);console.error=function(){rep('errors',Array.prototype.join.call(arguments,' '));ce.apply(null,arguments);};
var cw=console.warn.bind(console);console.warn=function(){rep('warnings',Array.prototype.join.call(arguments,' '));cw.apply(null,arguments);};
document.addEventListener('DOMContentLoaded',sync);sync();})();</script>`;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.jsx': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp4': 'video/mp4', '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const target = path.normalize(path.join(dir, urlPath));
    if (!target.startsWith(dir)) { res.writeHead(403); res.end(); return; }
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) { res.writeHead(404); res.end('not found: ' + urlPath); return; }
    const ext = path.extname(target).toLowerCase();
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    if (ext === '.html') {
      let text = fs.readFileSync(target, 'utf8');
      // Plain pages get the collector; support.js pages already have one (the guard makes double-injection harmless).
      text = text.includes('<head>') ? text.replace('<head>', '<head>' + COLLECTOR) : COLLECTOR + text;
      res.end(text);
    } else {
      res.end(fs.readFileSync(target));
    }
  } catch (e) {
    res.writeHead(500); res.end(String(e));
  }
});

server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/${encodeURIComponent(path.basename(abs))}`;
  const baseFlags = [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--no-first-run', '--disable-extensions', '--hide-scrollbars',
    // Proxy env vars must not intercept the local server (or hang the load entirely).
    '--no-proxy-server', '--proxy-bypass-list=*',
    `--window-size=${width},${height}`, `--virtual-time-budget=${budget}`,
  ];
  let failed = false;
  try {
    const dom = await run(chrome, [...baseFlags, '--dump-dom', url]);
    const m = dom.match(/<script type="application\/json" id="__dc_diag">([\s\S]*?)<\/script>/);
    let diag = null;
    if (m) { try { diag = JSON.parse(m[1]); } catch (e) { /* fall through */ } }
    const mounted = /data-dc-ready="1"/.test(dom);
    const hasXdc = /<x-dc[\s>]/.test(dom);

    if (!diag) {
      console.log('LOAD: no diagnostics found — the page may have replaced the whole document at runtime.');
    } else if (diag.errors.length === 0) {
      console.log('LOAD: clean' + (hasXdc ? (mounted ? ' — <x-dc> mounted.' : ' — WARNING: <x-dc> present but never mounted (support.js missing or crashed before render?)') : '.'));
      if (hasXdc && !mounted) failed = true;
    } else {
      console.log(`LOAD: ${diag.errors.length} error(s):`);
      for (const e of diag.errors) console.log('  ✗ ' + e);
      failed = true;
    }
    if (diag && diag.warnings.length) {
      console.log(`${diag.warnings.length} warning(s):`);
      for (const w of diag.warnings.slice(0, 20)) console.log('  ⚠ ' + w);
    }
    const bodyM = dom.match(/<body[\s\S]*<\/body>/);
    const textLen = bodyM ? bodyM[0].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().length : 0;
    console.log(`Rendered body text: ${textLen} chars.`);
    if (textLen === 0 && !failed) console.log('  ⚠ body rendered no visible text — check the page is not blank.');
  } catch (e) {
    console.log('LOAD FAILED: chromium exited abnormally: ' + (e.message || e));
    failed = true;
  }

  if (opts.screenshot) {
    const shot = path.resolve(opts.screenshot);
    try {
      await run(chrome, [...baseFlags, `--screenshot=${shot}`, url]);
      console.log('Screenshot: ' + shot);
    } catch (e) {
      console.log('Screenshot failed: ' + (e.message || e));
      failed = true;
    }
  }
  server.close();
  process.exit(failed ? 1 : 0);
});
