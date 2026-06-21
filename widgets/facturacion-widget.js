// ============================================================
// CrossFit Metropolitano — CFMP · MOBILE PULSE (Widget iOS)
// ------------------------------------------------------------
// Muestra la facturación de https://facturacion.crossfitmpo.com/v2/mobile
// en un widget de iPhone usando la app Scriptable.
//
// Datos que muestra:
//   • Facturación mensual total + facturación de hoy + crecimiento anual.
//   • Por centro (Parla / Getafe / Las Rosas): facturación del mes, socios,
//     variación vs cierre del mes pasado y altas confirmadas.
//
// Tamaños soportados:
//   • Pequeño  -> total + crecimiento anual.
//   • Mediano  -> total + 3 centros en compacto.
//   • Grande   -> total + 3 centros con detalle.
//
// INSTALACIÓN
//   1. Instala "Scriptable" desde la App Store (gratis).
//   2. Scriptable → "+" → pega este archivo → nómbralo "Facturación MPO".
//   3. Configura TOKEN y AUTH_MODE abajo.
//   4. Pantalla de inicio → mantén pulsado → "+" → Scriptable → elige tamaño
//      → "Editar widget" → Script: "Facturación MPO".
// ============================================================

// ===== CONFIGURACIÓN ========================================
// Token / API key para autenticar la petición.
const TOKEN = "PEGA_AQUI_TU_TOKEN";

// Cómo viaja el token:
//   "query"   -> ?token=...        en la URL
//   "bearer"  -> Authorization: Bearer <token>
//   "apikey"  -> X-Api-Key: <token>
//   "cookie"  -> Cookie: <token>   (pega la cookie de sesión completa)
//   "none"    -> sin auth (endpoint público / token ya en la URL)
const AUTH_MODE = "bearer";
const QUERY_PARAM_NAME = "token";

const BASE_URL = "https://facturacion.crossfitmpo.com/v2/mobile";

// Pon true para probar el diseño sin red, con datos de ejemplo.
const USE_MOCK = false;
// ============================================================

const COLORS = {
  bg: new Color("#121212"),
  card: new Color("#EEE9E9", 0.06),
  brightGray: new Color("#EEE9E9"),
  green: new Color("#87B15F"),
  red: new Color("#E5705C"),
  inkSoft: new Color("#EEE9E9", 0.72),
  inkFaint: new Color("#EEE9E9", 0.5),
  line: new Color("#EEE9E9", 0.16),
};

const MOCK = {
  periodo: "2026-06",
  actualizado: "21/6, 02:15",
  total: 73025.44,
  hoy: 0.0,
  crecimientoAnual: 64.4,
  centros: [
    { nombre: "Parla", crecimiento: -0.5, facturacion: 23007.13, socios: 260, deltaSocios: -17, altas: 13 },
    { nombre: "Getafe", crecimiento: 42373.6, facturacion: 29306.81, socios: 335, deltaSocios: -18, altas: 22 },
    { nombre: "Las Rosas", crecimiento: -2.4, facturacion: 20711.5, socios: 228, deltaSocios: -11, altas: 7 },
  ],
};

// ===== RED ==================================================
async function loadRaw() {
  let url = BASE_URL;
  const headers = { Accept: "application/json, text/html" };

  if (AUTH_MODE === "query") {
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}${QUERY_PARAM_NAME}=${encodeURIComponent(TOKEN)}`;
  } else if (AUTH_MODE === "bearer") {
    headers["Authorization"] = `Bearer ${TOKEN}`;
  } else if (AUTH_MODE === "apikey") {
    headers["X-Api-Key"] = TOKEN;
  } else if (AUTH_MODE === "cookie") {
    headers["Cookie"] = TOKEN;
  }

  const req = new Request(url);
  req.headers = headers;
  req.timeoutInterval = 20;
  const text = await req.loadString();

  // Si nos han redirigido al login, avisamos claramente.
  const finalUrl = req.response ? req.response.url || "" : "";
  if (/access-admin\/login|\/login/i.test(finalUrl)) {
    throw new Error("Redirigido a login: revisa el TOKEN/AUTH_MODE.");
  }
  return text;
}

// ===== PARSEO ===============================================
// Número en formato español: "73.025,44" -> 73025.44 ; "+64,4%" -> 64.4
function parseEsNumber(s) {
  if (s == null) return null;
  const m = String(s).match(/-?\+?[\d.\s]*,?\d+/);
  if (!m) return null;
  let v = m[0].replace(/\s/g, "").replace(/\./g, "").replace(",", ".").replace("+", "");
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function normalize(raw) {
  // 1) Intentar JSON.
  try {
    const j = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (j && typeof j === "object" && (j.total != null || j.centros || j.centers)) {
      return fromJson(j);
    }
  } catch (_) {
    /* no era JSON, seguimos con HTML */
  }
  // 2) Parsear como HTML/texto.
  return fromText(String(raw));
}

function fromJson(j) {
  const centros = (j.centros || j.centers || []).map((c) => ({
    nombre: c.nombre || c.name,
    crecimiento: c.crecimiento ?? c.growth ?? c.variacion ?? null,
    facturacion: c.facturacion ?? c.revenue ?? c.facturacionMes ?? null,
    socios: c.socios ?? c.members ?? null,
    deltaSocios: c.deltaSocios ?? c.variacionSocios ?? c.delta ?? null,
    altas: c.altas ?? c.altasConfirmadas ?? c.signups ?? null,
  }));
  return {
    periodo: j.periodo ?? j.period ?? "",
    actualizado: j.actualizado ?? j.updated ?? "",
    total: j.total ?? j.facturacionTotal ?? null,
    hoy: j.hoy ?? j.facturacionHoy ?? null,
    crecimientoAnual: j.crecimientoAnual ?? j.crecimientoVsAnoPasado ?? null,
    centros,
  };
}

// Parser tolerante: convierte HTML a texto y usa las etiquetas como anclas.
function fromText(html) {
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&euro;/gi, "€")
    .replace(/&nbsp;/gi, " ")
    .replace(/[ \t]+/g, " ");
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length);

  const joined = lines.join("\n");

  const after = (label) => {
    const re = new RegExp(label + "[^\\n]*\\n([^\\n]+)", "i");
    const m = joined.match(re);
    return m ? m[1] : null;
  };
  const sameOrAfter = (label) => {
    const re = new RegExp(label + "\\s*:?\\s*([^\\n]+)", "i");
    const m = joined.match(re);
    return m ? m[1] : after(label);
  };

  const total = parseEsNumber(after("FACTURACIÓN MENSUAL TOTAL"));
  const hoy = parseEsNumber(sameOrAfter("Facturación hoy"));
  const crecimientoAnual = parseEsNumber(sameOrAfter("Crecimiento vs año pasado"));
  const periodo = (joined.match(/\b(20\d{2}-\d{2})\b/) || [])[1] || "";
  const actualizado = (sameOrAfter("Actualizado") || "").trim();

  // Centros: anclamos por nombre conocido y leemos los campos siguientes.
  const NOMBRES = ["Parla", "Getafe", "Las Rosas"];
  const centros = [];
  for (const nombre of NOMBRES) {
    const idx = lines.findIndex((l) => l === nombre);
    if (idx === -1) continue;
    const block = lines.slice(idx, idx + 12);
    const grab = (label) => {
      const i = block.findIndex((l) => new RegExp(label, "i").test(l));
      if (i === -1) return null;
      // valor en la línea anterior (layout: número arriba, etiqueta abajo)
      return parseEsNumber(block[i - 1]) ?? parseEsNumber(block[i]);
    };
    const pct = block.find((l) => /[+-]?\d[\d.,]*%/.test(l));
    centros.push({
      nombre,
      crecimiento: parseEsNumber(pct),
      facturacion: grab("Facturación mes"),
      socios: grab("^Socios$|Socios"),
      deltaSocios: grab("cierre mes pasado"),
      altas: grab("Altas confirmadas"),
    });
  }

  return { periodo, actualizado, total, hoy, crecimientoAnual, centros };
}

// ===== FORMATO ==============================================
function eur(n, dec = 2) {
  if (n == null || isNaN(n)) return "—";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(n);
}
function num(n) {
  if (n == null || isNaN(n)) return "—";
  return new Intl.NumberFormat("es-ES").format(n);
}
function pct(n) {
  if (n == null || isNaN(n)) return "—";
  const s = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(n);
  return (n > 0 ? "+" : "") + s + "%";
}
function signed(n) {
  if (n == null || isNaN(n)) return "—";
  return (n > 0 ? "+" : "") + num(n);
}
function trend(n) {
  return n == null || n >= 0 ? COLORS.green : COLORS.red;
}

// ===== UI ===================================================
function header(w) {
  const row = w.addStack();
  row.centerAlignContent();
  const dot = row.addStack();
  dot.size = new Size(7, 7);
  dot.backgroundColor = COLORS.green;
  dot.cornerRadius = 3.5;
  row.addSpacer(6);
  const t = row.addText("CFMP · MOBILE PULSE");
  t.font = Font.boldSystemFont(10);
  t.textColor = COLORS.green;
  row.addSpacer();
}

function totalBlock(w, d, big) {
  const lbl = w.addText("FACTURACIÓN MENSUAL TOTAL");
  lbl.font = Font.mediumSystemFont(9);
  lbl.textColor = COLORS.inkSoft;
  const v = w.addText(eur(d.total, 2));
  v.font = Font.boldSystemFont(big ? 34 : 26);
  v.textColor = COLORS.brightGray;
  v.lineLimit = 1;
  v.minimumScaleFactor = 0.5;
  const sub = w.addText(`Hoy ${eur(d.hoy, 2)}  ·  vs año pasado ${pct(d.crecimientoAnual)}`);
  sub.font = Font.systemFont(9);
  sub.textColor = trend(d.crecimientoAnual);
}

function centerCardLarge(stack, c) {
  const card = stack.addStack();
  card.layoutVertically();
  card.backgroundColor = COLORS.card;
  card.cornerRadius = 12;
  card.setPadding(9, 10, 9, 10);

  const top = card.addStack();
  top.centerAlignContent();
  const name = top.addText(c.nombre);
  name.font = Font.boldSystemFont(13);
  name.textColor = COLORS.brightGray;
  top.addSpacer();
  const g = top.addText(pct(c.crecimiento));
  g.font = Font.boldSystemFont(11);
  g.textColor = trend(c.crecimiento);
  g.lineLimit = 1;
  g.minimumScaleFactor = 0.6;

  card.addSpacer(4);
  const fact = card.addText(eur(c.facturacion, 2));
  fact.font = Font.boldSystemFont(17);
  fact.textColor = COLORS.brightGray;

  card.addSpacer(4);
  const row = card.addStack();
  const mk = (label, value, color) => {
    const col = row.addStack();
    col.layoutVertically();
    const v = col.addText(value);
    v.font = Font.semiboldSystemFont(12);
    v.textColor = color || COLORS.brightGray;
    const l = col.addText(label);
    l.font = Font.systemFont(8);
    l.textColor = COLORS.inkFaint;
  };
  mk("Socios", num(c.socios));
  row.addSpacer();
  mk("vs mes ant.", signed(c.deltaSocios), trend(c.deltaSocios));
  row.addSpacer();
  mk("Altas", num(c.altas), COLORS.green);
}

function centerRowMedium(stack, c) {
  const row = stack.addStack();
  row.centerAlignContent();
  const name = row.addText(c.nombre);
  name.font = Font.semiboldSystemFont(11);
  name.textColor = COLORS.brightGray;
  row.addSpacer();
  const fact = row.addText(eur(c.facturacion, 0));
  fact.font = Font.semiboldSystemFont(11);
  fact.textColor = COLORS.brightGray;
  row.addSpacer(8);
  const so = row.addText(`${num(c.socios)} soc.`);
  so.font = Font.systemFont(10);
  so.textColor = COLORS.inkSoft;
  row.addSpacer(8);
  const g = row.addText(pct(c.crecimiento));
  g.font = Font.semiboldSystemFont(10);
  g.textColor = trend(c.crecimiento);
  g.lineLimit = 1;
  g.minimumScaleFactor = 0.6;
}

function footer(w, d) {
  const f = w.addText(`${d.periodo}${d.actualizado ? "  ·  Act. " + d.actualizado : ""}`);
  f.font = Font.systemFont(8);
  f.textColor = COLORS.inkFaint;
}

function buildWidget(d, family) {
  const w = new ListWidget();
  w.backgroundColor = COLORS.bg;
  w.setPadding(14, 14, 14, 14);
  w.url = "https://facturacion.crossfitmpo.com/v2/mobile";

  const size = family || config.widgetFamily || "medium";

  if (size === "small") {
    header(w);
    w.addSpacer(6);
    const lbl = w.addText("FACTURACIÓN MES");
    lbl.font = Font.mediumSystemFont(8);
    lbl.textColor = COLORS.inkSoft;
    const v = w.addText(eur(d.total, 0));
    v.font = Font.boldSystemFont(22);
    v.textColor = COLORS.brightGray;
    v.minimumScaleFactor = 0.5;
    v.lineLimit = 1;
    w.addSpacer(2);
    const g = w.addText(`vs año ${pct(d.crecimientoAnual)}`);
    g.font = Font.semiboldSystemFont(10);
    g.textColor = trend(d.crecimientoAnual);
    w.addSpacer();
    footer(w, d);
    return w;
  }

  if (size === "large" || size === "extraLarge") {
    header(w);
    w.addSpacer(8);
    totalBlock(w, d, true);
    w.addSpacer(10);
    const grid = w.addStack();
    grid.layoutVertically();
    grid.spacing = 7;
    for (const c of d.centros) centerCardLarge(grid, c);
    w.addSpacer();
    footer(w, d);
    return w;
  }

  // medium
  header(w);
  w.addSpacer(6);
  totalBlock(w, d, false);
  w.addSpacer(8);
  const list = w.addStack();
  list.layoutVertically();
  list.spacing = 5;
  for (const c of d.centros) centerRowMedium(list, c);
  w.addSpacer();
  footer(w, d);
  return w;
}

function errorWidget(err) {
  const w = new ListWidget();
  w.backgroundColor = COLORS.bg;
  w.setPadding(14, 14, 14, 14);
  header(w);
  w.addSpacer(8);
  const t = w.addText("Sin datos");
  t.font = Font.boldSystemFont(18);
  t.textColor = COLORS.brightGray;
  w.addSpacer(3);
  const m = w.addText(String(err).slice(0, 120));
  m.font = Font.systemFont(10);
  m.textColor = COLORS.inkSoft;
  m.lineLimit = 4;
  return w;
}

// ===== MAIN =================================================
let widget;
try {
  const data = USE_MOCK ? MOCK : normalize(await loadRaw());
  if (data.total == null && (!data.centros || !data.centros.length)) {
    throw new Error("No se pudieron leer los datos del endpoint.");
  }
  widget = buildWidget(data);
} catch (e) {
  widget = errorWidget(e.message || e);
}

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentLarge();
}
Script.complete();
