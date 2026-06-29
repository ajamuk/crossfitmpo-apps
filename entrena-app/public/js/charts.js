// Gráficos SVG mínimos, sin dependencias (offline-friendly)
const Charts = (() => {
  const ACC = '#87B15F', GRID = '#2c2c2c', TXT = '#9a9a9a', PR = '#e9c46a';

  // Gráfico de línea. data: [{label, value}]
  function line(data, { w = 320, h = 150, pad = 28, color = ACC, unit = '' } = {}) {
    if (!data.length) return `<div class="empty">Sin datos todavía</div>`;
    if (data.length === 1) data = [{ label: '', value: data[0].value }, ...data];
    const vals = data.map(d => d.value);
    let min = Math.min(...vals), max = Math.max(...vals);
    if (min === max) { min = min * 0.95; max = max * 1.05 || 1; }
    const innerW = w - pad * 2, innerH = h - pad * 2;
    const x = i => pad + (i / (data.length - 1)) * innerW;
    const y = v => pad + innerH - ((v - min) / (max - min)) * innerH;

    let grid = '';
    for (let i = 0; i <= 3; i++) {
      const gy = pad + (i / 3) * innerH;
      const gv = max - (i / 3) * (max - min);
      grid += `<line x1="${pad}" y1="${gy}" x2="${w - pad}" y2="${gy}" stroke="${GRID}" stroke-width="1"/>`;
      grid += `<text x="2" y="${gy + 4}" fill="${TXT}" font-size="9">${fmt(gv)}</text>`;
    }
    const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
    const area = `${path} L${x(data.length - 1)},${pad + innerH} L${x(0)},${pad + innerH} Z`;
    const dots = data.map((d, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(d.value).toFixed(1)}" r="3" fill="${color}"/>`).join('');
    const labels = data.map((d, i) => (i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2))
      ? `<text x="${x(i).toFixed(1)}" y="${h - 6}" fill="${TXT}" font-size="9" text-anchor="middle">${d.label || ''}</text>` : '').join('');

    return `<svg class="chart" viewBox="0 0 ${w} ${h}">
      <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      ${grid}<path d="${area}" fill="url(#g1)"/>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}${labels}
    </svg>`;
  }

  // Barras horizontales. data: [{label, value}]
  function hbars(data, { max = null, unit = '' } = {}) {
    if (!data.length) return `<div class="empty">Sin datos todavía</div>`;
    const top = max || Math.max(...data.map(d => d.value)) || 1;
    return data.map(d => `
      <div class="bar-row">
        <span class="lbl">${d.label}</span>
        <span class="track"><span class="fill" style="width:${Math.max(3, (d.value / top) * 100)}%"></span></span>
        <span class="val">${fmt(d.value)}${unit}</span>
      </div>`).join('');
  }

  function fmt(n) {
    n = Math.round(n);
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k';
    return String(n);
  }

  return { line, hbars };
})();
