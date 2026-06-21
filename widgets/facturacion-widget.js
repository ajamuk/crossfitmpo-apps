// ============================================================
// CrossFit Metropolitano — Widget de Facturación (Scriptable)
// ------------------------------------------------------------
// Muestra los datos de https://facturacion.crossfitmpo.com/v2/mobile
// en un widget de iOS usando la app Scriptable.
//
// INSTALACIÓN
//   1. Instala "Scriptable" desde la App Store (gratis).
//   2. Abre Scriptable → "+" → pega este archivo → ponle un nombre
//      (p.ej. "Facturación MPO").
//   3. Edita el TOKEN más abajo.
//   4. Añade un widget de Scriptable a la pantalla de inicio,
//      mantén pulsado → "Editar widget" → Script: "Facturación MPO".
//
// CONFIGURACIÓN ----------------------------------------------
// Pega aquí tu token / API key.
const TOKEN = "PEGA_AQUI_TU_TOKEN";

// Cómo se envía el token. Opciones:
//   "query"  -> se añade a la URL como ?token=...
//   "bearer" -> cabecera Authorization: Bearer <token>
//   "apikey" -> cabecera X-Api-Key: <token>
const AUTH_MODE = "bearer";
const QUERY_PARAM_NAME = "token"; // solo se usa si AUTH_MODE === "query"

const BASE_URL = "https://facturacion.crossfitmpo.com/v2/mobile";

// Paleta de marca (Metro Tools)
const COLORS = {
  bg: new Color("#121212"),
  brightGray: new Color("#EEE9E9"),
  green: new Color("#87B15F"),
  inkSoft: new Color("#EEE9E9", 0.72),
  line: new Color("#EEE9E9", 0.16),
};

// ------------------------------------------------------------
// FETCH
async function fetchData() {
  let url = BASE_URL;
  const headers = { Accept: "application/json" };

  if (AUTH_MODE === "query") {
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}${QUERY_PARAM_NAME}=${encodeURIComponent(TOKEN)}`;
  } else if (AUTH_MODE === "bearer") {
    headers["Authorization"] = `Bearer ${TOKEN}`;
  } else if (AUTH_MODE === "apikey") {
    headers["X-Api-Key"] = TOKEN;
  }

  const req = new Request(url);
  req.headers = headers;
  req.timeoutInterval = 15;
  return await req.loadJSON();
}

// ------------------------------------------------------------
// HELPERS de formato
function eur(n) {
  if (n == null || isNaN(n)) return "—";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function num(n) {
  if (n == null || isNaN(n)) return "—";
  return new Intl.NumberFormat("es-ES").format(n);
}

// ------------------------------------------------------------
// WIDGET UI
function addHeader(w, subtitle) {
  const row = w.addStack();
  row.centerAlignContent();
  const dot = row.addStack();
  dot.size = new Size(8, 8);
  dot.backgroundColor = COLORS.green;
  dot.cornerRadius = 4;
  row.addSpacer(6);
  const title = row.addText(subtitle || "FACTURACIÓN");
  title.font = Font.boldSystemFont(11);
  title.textColor = COLORS.green;
  row.addSpacer();
}

function addMetric(w, label, value, accent) {
  const v = w.addText(value);
  v.font = Font.boldSystemFont(30);
  v.textColor = accent ? COLORS.green : COLORS.brightGray;
  v.lineLimit = 1;
  v.minimumScaleFactor = 0.5;
  const l = w.addText(label.toUpperCase());
  l.font = Font.mediumSystemFont(10);
  l.textColor = COLORS.inkSoft;
}

function buildWidget(data) {
  const w = new ListWidget();
  w.backgroundColor = COLORS.bg;
  w.setPadding(16, 16, 16, 16);
  w.url = "https://apps.crossfitmpo.com"; // al tocar el widget abre las apps

  addHeader(w, "FACTURACIÓN");
  w.addSpacer(10);

  // ⚠️ MAPEO DE CAMPOS (ajustar a la respuesta real de /v2/mobile)
  // Estos nombres son provisionales. En cuanto tengamos el JSON real
  // se sustituyen por los campos correctos.
  const total = data.total ?? data.facturacion ?? data.revenue;
  const subLabel = data.periodo ?? data.period ?? "Este mes";

  addMetric(w, subLabel, eur(total), true);

  w.addSpacer(8);

  // Métricas secundarias (provisional)
  const grid = w.addStack();
  grid.spacing = 16;
  const colA = grid.addStack();
  colA.layoutVertically();
  const aVal = colA.addText(num(data.socios ?? data.members ?? data.altas));
  aVal.font = Font.boldSystemFont(18);
  aVal.textColor = COLORS.brightGray;
  const aLbl = colA.addText("SOCIOS");
  aLbl.font = Font.systemFont(9);
  aLbl.textColor = COLORS.inkSoft;

  const colB = grid.addStack();
  colB.layoutVertically();
  const bVal = colB.addText(num(data.bajas ?? data.churn ?? 0));
  bVal.font = Font.boldSystemFont(18);
  bVal.textColor = COLORS.brightGray;
  const bLbl = colB.addText("BAJAS");
  bLbl.font = Font.systemFont(9);
  bLbl.textColor = COLORS.inkSoft;

  w.addSpacer();

  const ts = w.addText("Actualizado " + new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }));
  ts.font = Font.systemFont(8);
  ts.textColor = COLORS.inkSoft;

  return w;
}

function buildErrorWidget(err) {
  const w = new ListWidget();
  w.backgroundColor = COLORS.bg;
  w.setPadding(16, 16, 16, 16);
  addHeader(w, "FACTURACIÓN");
  w.addSpacer(10);
  const t = w.addText("Sin datos");
  t.font = Font.boldSystemFont(20);
  t.textColor = COLORS.brightGray;
  w.addSpacer(4);
  const m = w.addText(String(err).slice(0, 90));
  m.font = Font.systemFont(10);
  m.textColor = COLORS.inkSoft;
  m.lineLimit = 3;
  return w;
}

// ------------------------------------------------------------
// MAIN
let widget;
try {
  const data = await fetchData();
  widget = buildWidget(data);
} catch (e) {
  widget = buildErrorWidget(e.message || e);
}

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();
