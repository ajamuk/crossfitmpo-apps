// ============================ Entrena · App ============================
const App = (() => {
  const root = document.getElementById('app');
  let user = null;
  let exercises = [];          // caché de la biblioteca
  let active = null;           // entrenamiento en curso (persistido en localStorage)
  let restTimer = null, restRemaining = 0;
  let workoutTick = null;

  const TYPES = ['hipertrofia', 'fuerza', 'metcon', 'cardio'];
  const MUSCLES = ['Pecho', 'Espalda', 'Pierna', 'Hombro', 'Bíceps', 'Tríceps', 'Core', 'Olímpico', 'Full body', 'Otro'];

  // ---------- helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const unit = () => (user && user.unit) || 'kg';
  const fmtNum = (n) => { n = Math.round(n); return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n); };
  const todayISO = () => new Date().toISOString().slice(0, 10);

  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.remove('oculto');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.add('oculto'), 2400);
  }
  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso.replace(' ', 'T') + (iso.includes('Z') || iso.length <= 10 ? '' : 'Z'));
    return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function relDay(iso) {
    const d = new Date((iso || '').replace(' ', 'T') + 'Z');
    const diff = Math.round((Date.now() - d.getTime()) / 86400000);
    if (diff <= 0) return 'hoy';
    if (diff === 1) return 'ayer';
    if (diff < 7) return `hace ${diff} días`;
    return fmtDate(iso);
  }
  function pill(type) { return `<span class="pill ${esc(type)}">${esc(type)}</span>`; }

  // ---------- modal ----------
  function openModal(html) {
    const ov = document.getElementById('modal-overlay');
    document.getElementById('modal').innerHTML = `<div class="modal-handle"></div>` + html;
    ov.classList.remove('oculto');
    ov.onclick = (e) => { if (e.target === ov) closeModal(); };
  }
  function closeModal() { document.getElementById('modal-overlay').classList.add('oculto'); }

  // ============================ AUTH ============================
  function renderAuth(mode = 'login') {
    stopWorkoutTick();
    document.querySelector('.tabbar')?.remove();
    root.innerHTML = `
      <div class="auth-wrap">
        <div class="auth-logo">
          <div class="big">ENTRENA</div>
          <div class="sub">CrossFit Metropolitano</div>
        </div>
        <div class="card">
          <h3>${mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h3>
          <label class="field">Usuario</label>
          <input id="au-user" autocomplete="username" autocapitalize="off" placeholder="tu nombre" />
          <label class="field">Contraseña</label>
          <input id="au-pass" type="password" autocomplete="current-password" placeholder="••••••" />
          <div class="error-msg" id="au-err"></div>
          <button class="btn" id="au-go" style="margin-top:14px">${mode === 'login' ? 'Entrar' : 'Registrarme'}</button>
        </div>
        <div class="auth-toggle">
          ${mode === 'login'
            ? '¿Sin cuenta? <a id="au-toggle">Regístrate</a>'
            : '¿Ya tienes cuenta? <a id="au-toggle">Inicia sesión</a>'}
        </div>
      </div>`;
    const go = async () => {
      const username = $('#au-user').value.trim();
      const password = $('#au-pass').value;
      const err = $('#au-err');
      err.textContent = '';
      if (!username || !password) { err.textContent = 'Rellena usuario y contraseña'; return; }
      try {
        const res = await API.post('/auth/' + (mode === 'login' ? 'login' : 'register'), { username, password });
        API.setToken(res.token);
        user = res.user;
        await boot();
      } catch (e) { err.textContent = e.message; }
    };
    $('#au-go').onclick = go;
    $('#au-pass').onkeydown = (e) => { if (e.key === 'Enter') go(); };
    $('#au-toggle').onclick = () => renderAuth(mode === 'login' ? 'register' : 'login');
  }

  // ============================ SHELL / NAV ============================
  function shell(viewHtml) {
    root.innerHTML = `
      <div class="topbar">
        <div class="brand">ENTRE<b>NA</b><small>CrossFit Metropolitano</small></div>
        <button class="chip" id="profile-chip">👤 <b>${esc(user.username)}</b></button>
      </div>
      <div id="view-container">${viewHtml}</div>
      <nav class="tabbar">
        <button data-tab="home"><span class="ico">🏠</span>Inicio</button>
        <button data-tab="history"><span class="ico">📅</span>Historial</button>
        <button class="fab" data-tab="train"><span class="ico">＋</span></button>
        <button data-tab="routines"><span class="ico">📋</span>Rutinas</button>
        <button data-tab="progress"><span class="ico">📈</span>Progreso</button>
      </nav>`;
    $('#profile-chip').onclick = renderProfile;
    document.querySelectorAll('.tabbar button').forEach(b => b.onclick = () => navigate(b.dataset.tab));
    highlightTab();
  }
  function highlightTab() {
    const tab = (location.hash.replace('#', '').split('/')[0]) || 'home';
    document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  }

  function navigate(tab) {
    if (tab === 'train') { startOrResume(); return; }
    location.hash = tab;
  }

  // ============================ ROUTER ============================
  async function route() {
    if (!API.isAuthed) { renderAuth(); return; }
    if (!user) { try { user = (await API.get('/auth/me')).user; } catch { renderAuth(); return; } }
    const [base, arg] = location.hash.replace('#', '').split('/');
    switch (base) {
      case '': case 'home': await renderHome(); break;
      case 'history': await renderHistory(); break;
      case 'routines': await renderRoutines(); break;
      case 'progress': await renderProgress(); break;
      case 'workout': await renderActiveLogger(); break;
      case 'view': await renderWorkoutDetail(arg); break;
      case 'routine-edit': await renderRoutineEditor(arg); break;
      case 'exercise': await renderExerciseProgress(arg); break;
      default: location.hash = 'home';
    }
    highlightTab();
  }

  // ============================ INICIO (dashboard) ============================
  async function renderHome() {
    shell(`<div class="view"><div class="empty">Cargando…</div></div>`);
    const [sum, cal, workouts] = await Promise.all([
      API.get('/progress/summary'),
      API.get('/progress/calendar'),
      API.get('/workouts'),
    ]);
    const trainedSet = new Set(cal.map(c => c.date));
    const typeByDate = {}; cal.forEach(c => typeByDate[c.date] = c.type);
    const last = workouts[0];
    const resumeBanner = active ? `
      <div class="card tap" style="border-color:var(--acento)" onclick="App.go('workout')">
        <div class="card-row"><div><h3 style="color:var(--acento)">⏱ Entrenamiento en curso</h3>
        <div class="muted">${esc(active.name)} · ${active.exercises.length} ejercicios · toca para continuar</div></div><div>▶</div></div>
      </div>` : '';

    const html = `
    <div class="view">
      <h1 class="view-title">Hola, ${esc(user.username)}</h1>
      <div class="view-sub">${sum.week} entreno(s) esta semana · ${sum.month} este mes</div>
      ${resumeBanner}
      <button class="btn" onclick="App.startOrResume()" style="margin-bottom:16px">＋ Empezar entrenamiento</button>

      <div class="stats">
        <div class="stat"><div class="num">${sum.total}</div><div class="lbl">Entrenos totales</div></div>
        <div class="stat"><div class="num">${sum.week}</div><div class="lbl">Esta semana</div></div>
        <div class="stat"><div class="num">${fmtNum(sum.volume)}</div><div class="lbl">Volumen total (${unit()})</div></div>
        <div class="stat"><div class="num">${sum.trained_days}</div><div class="lbl">Días entrenados</div></div>
      </div>

      <div class="section-title">Calendario · ${new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</div>
      ${calendarHtml(new Date(), trainedSet, typeByDate)}

      <div class="section-title">Último entrenamiento</div>
      ${last ? workoutCard(last) : `<div class="empty"><span class="big-ico">🏋️</span>Aún no has registrado nada.<br>¡Empieza tu primer entreno!</div>`}
    </div>`;
    $('#view-container').innerHTML = html;
  }

  function calendarHtml(refDate, trainedSet, typeByDate) {
    const y = refDate.getFullYear(), m = refDate.getMonth();
    const first = new Date(y, m, 1);
    let startDow = (first.getDay() + 6) % 7; // lunes=0
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const todayStr = todayISO();
    let cells = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => `<div class="dow">${d}</div>`);
    for (let i = 0; i < startDow; i++) cells.push(`<div class="day other"></div>`);
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const cls = ['day'];
      if (trainedSet.has(ds)) cls.push('trained');
      if (ds === todayStr) cls.push('today');
      cells.push(`<div class="${cls.join(' ')}" title="${typeByDate[ds] || ''}">${d}</div>`);
    }
    return `<div class="cal">${cells.join('')}</div>`;
  }

  function workoutCard(w) {
    return `<div class="card tap" onclick="App.go('view/${w.id}')">
      <div class="card-row">
        <div><h3>${esc(w.name)}</h3><div class="muted">${relDay(w.started_at)} · ${w.exercises || 0} ejercicios · ${w.sets || 0} series</div></div>
        ${pill(w.type)}
      </div>
      <div class="card-row" style="margin-top:8px">
        <span class="muted">Volumen: <b style="color:var(--texto)">${fmtNum(w.volume || 0)} ${unit()}</b></span>
        ${w.duration_seconds ? `<span class="muted">⏱ ${Math.round(w.duration_seconds / 60)} min</span>` : ''}
      </div>
    </div>`;
  }

  // ============================ HISTORIAL ============================
  async function renderHistory() {
    shell(`<div class="view"><h1 class="view-title">Historial</h1><div class="empty">Cargando…</div></div>`);
    const workouts = await API.get('/workouts');
    let html = `<div class="view"><h1 class="view-title">Historial</h1>
      <div class="view-sub">${workouts.length} entrenamientos registrados</div>`;
    if (!workouts.length) {
      html += `<div class="empty"><span class="big-ico">📅</span>Sin entrenamientos todavía.</div>`;
    } else {
      // agrupar por mes
      let curMonth = '';
      for (const w of workouts) {
        const month = new Date((w.started_at || '').replace(' ', 'T') + 'Z')
          .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        if (month !== curMonth) { html += `<div class="section-title">${month}</div>`; curMonth = month; }
        html += workoutCard(w);
      }
    }
    html += `</div>`;
    $('#view-container').innerHTML = html;
  }

  async function renderWorkoutDetail(id) {
    shell(`<div class="view"><div class="empty">Cargando…</div></div>`);
    const w = await API.get('/workouts/' + id);
    const byEx = {};
    for (const s of w.sets) { (byEx[s.exercise_id] ||= { name: s.name, mg: s.muscle_group, sets: [] }).sets.push(s); }
    let exHtml = Object.values(byEx).map(g => `
      <div class="logger-ex">
        <header><div><div class="ex-name">${esc(g.name)}</div><div class="ex-mg">${esc(g.mg)}</div></div></header>
        <div class="set-table">
          <div class="set-head"><span>#</span><span>Tipo</span><span>${unit()}</span><span>Reps</span><span>RPE</span><span>Vol</span></div>
          ${g.sets.map(s => `<div class="set-row">
            <span class="set-num ${s.set_type !== 'normal' ? s.set_type : ''}">${s.set_number}</span>
            <span class="muted" style="text-align:left">${setTypeLabel(s.set_type)}</span>
            <span style="text-align:center">${s.weight}</span>
            <span style="text-align:center">${s.reps}</span>
            <span style="text-align:center">${s.rpe ?? '–'}</span>
            <span class="muted" style="text-align:center">${fmtNum(s.weight * s.reps)}</span>
          </div>`).join('')}
        </div>
      </div>`).join('');

    $('#view-container').innerHTML = `
      <div class="view">
        <button class="btn ghost sm" onclick="history.back()" style="margin-bottom:12px">← Volver</button>
        <h1 class="view-title">${esc(w.name)}</h1>
        <div class="view-sub">${fmtDate(w.started_at)} · ${pill(w.type)}</div>
        <div class="stats" style="margin-bottom:8px">
          <div class="stat"><div class="num">${fmtNum(w.volume)}</div><div class="lbl">Volumen ${unit()}</div></div>
          <div class="stat"><div class="num">${w.total_sets}</div><div class="lbl">Series</div></div>
          <div class="stat"><div class="num">${w.total_reps}</div><div class="lbl">Reps totales</div></div>
          <div class="stat"><div class="num">${Math.round(w.duration_seconds / 60)}</div><div class="lbl">Minutos</div></div>
        </div>
        ${w.notes ? `<div class="card"><div class="muted">Notas</div>${esc(w.notes)}</div>` : ''}
        <div class="section-title">Ejercicios</div>
        ${exHtml}
        <button class="btn danger" onclick="App.deleteWorkout(${w.id})" style="margin-top:8px">Eliminar entrenamiento</button>
      </div>`;
  }

  async function deleteWorkout(id) {
    if (!confirm('¿Eliminar este entrenamiento? No se puede deshacer.')) return;
    await API.del('/workouts/' + id);
    toast('Entrenamiento eliminado');
    location.hash = 'history';
  }

  function setTypeLabel(t) {
    return { normal: 'Efectiva', warmup: 'Calentam.', drop: 'Drop set', fallo: 'Al fallo' }[t] || t;
  }

  // ============================ ENTRENAMIENTO ACTIVO (logger) ============================
  function loadActive() {
    try { active = JSON.parse(localStorage.getItem('entrena_active') || 'null'); } catch { active = null; }
  }
  function saveActive() { localStorage.setItem('entrena_active', JSON.stringify(active)); }
  function clearActive() { active = null; localStorage.removeItem('entrena_active'); stopWorkoutTick(); }

  async function startOrResume() {
    if (active) { location.hash = 'workout'; return; }
    // diálogo: vacío o desde rutina
    const routines = await API.get('/routines');
    openModal(`
      <h3>Empezar entrenamiento</h3>
      <button class="btn" onclick="App.newEmptyWorkout()">Entrenamiento vacío</button>
      ${routines.length ? `<div class="section-title">Desde una rutina</div>` : ''}
      ${routines.map(r => `<div class="card tap" onclick="App.newFromRoutine(${r.id})">
        <div class="card-row"><div><b>${esc(r.name)}</b><div class="muted">${r.exercise_count} ejercicios</div></div>${pill(r.type)}</div>
      </div>`).join('')}
    `);
  }

  function newEmptyWorkout() {
    active = { name: 'Entreno ' + new Date().toLocaleDateString('es-ES'), type: 'hipertrofia', notes: '', started_at: new Date().toISOString(), exercises: [], routine_id: null };
    saveActive(); closeModal(); location.hash = 'workout';
  }

  async function newFromRoutine(id) {
    const r = await API.get('/routines/' + id);
    active = {
      name: r.name, type: r.type, notes: '', started_at: new Date().toISOString(), routine_id: r.id,
      exercises: r.exercises.map(re => ({
        exercise_id: re.exercise_id, name: re.name, muscle_group: re.muscle_group,
        sets: Array.from({ length: re.target_sets }, () => ({ set_type: 'normal', weight: '', reps: '', rpe: '', done: false })),
        target_reps: re.target_reps, rest_seconds: re.rest_seconds, prev: null,
      })),
    };
    saveActive(); closeModal();
    location.hash = 'workout';
    // precargar "última vez" para autocompletar
    for (const ex of active.exercises) await loadPrev(ex);
    saveActive(); if (location.hash.includes('workout')) renderActiveLogger();
  }

  async function loadPrev(ex) {
    try {
      const last = await API.get('/workouts/last/' + ex.exercise_id);
      ex.prev = last;
    } catch { ex.prev = null; }
  }

  async function renderActiveLogger() {
    if (!active) { location.hash = 'home'; return; }
    if (!exercises.length) exercises = await API.get('/exercises');
    const elapsed = Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000);
    let totalVol = 0, totalSets = 0;
    active.exercises.forEach(ex => ex.sets.forEach(s => {
      if (s.done && s.set_type !== 'warmup') { totalVol += (+s.weight || 0) * (+s.reps || 0); totalSets++; }
    }));

    const exHtml = active.exercises.map((ex, ei) => loggerExercise(ex, ei)).join('');
    root.innerHTML = `
      <div class="topbar">
        <button class="chip" onclick="App.cancelWorkout()">✕ Cancelar</button>
        <div class="brand" style="font-size:20px">${esc(active.name)}</div>
        <button class="chip" onclick="App.editWorkoutMeta()">⚙</button>
      </div>
      <div class="view" style="padding-bottom:90px">
        ${exHtml || `<div class="empty"><span class="big-ico">🏋️</span>Añade tu primer ejercicio</div>`}
        <button class="btn ghost" onclick="App.pickExercises()" style="margin-top:6px">＋ Añadir ejercicio</button>
      </div>
      <div class="logger-bar">
        <span class="timer" id="wk-timer">${fmtClock(elapsed)}</span>
        <div style="flex:1"><div class="meta"><b id="wk-sets">${totalSets}</b> series · <b id="wk-vol">${fmtNum(totalVol)}</b> ${unit()}</div></div>
        <button class="btn sm" onclick="App.finishWorkout()">Finalizar</button>
      </div>`;
    startWorkoutTick();
  }

  function loggerExercise(ex, ei) {
    const prev = ex.prev;
    const rows = ex.sets.map((s, si) => {
      const prevSet = prev && prev.last_sets && prev.last_sets[si];
      const prevTxt = prevSet ? `${prevSet.weight}×${prevSet.reps}` : '–';
      const isPR = s.done && prev && (+s.weight) > 0 && est1rm(+s.weight, +s.reps) > (prev.best_1rm || 0) + 0.01;
      return `<div class="set-row ${s.done ? 'done' : ''}">
        <span class="set-num ${s.set_type !== 'normal' ? s.set_type : ''}" onclick="App.cycleSetType(${ei},${si})">${s.set_type === 'warmup' ? 'C' : s.set_type === 'drop' ? 'D' : s.set_type === 'fallo' ? 'F' : s.set_number}</span>
        <span class="prev" onclick="App.useprev(${ei},${si})" title="Última vez">${prevTxt}</span>
        <input type="number" inputmode="decimal" class="${isPR ? 'set-input-pr' : ''}" placeholder="${prevSet ? prevSet.weight : '0'}" value="${s.weight}" onchange="App.setVal(${ei},${si},'weight',this.value)" />
        <input type="number" inputmode="numeric" placeholder="${prevSet ? prevSet.reps : '0'}" value="${s.reps}" onchange="App.setVal(${ei},${si},'reps',this.value)" />
        <input type="number" inputmode="decimal" placeholder="–" value="${s.rpe}" onchange="App.setVal(${ei},${si},'rpe',this.value)" />
        <button class="set-check ${s.done ? 'on' : ''}" onclick="App.toggleDone(${ei},${si})">✓</button>
      </div>`;
    }).join('');
    return `<div class="logger-ex">
      <header>
        <div><div class="ex-name">${esc(ex.name)}</div><div class="ex-mg">${esc(ex.muscle_group)}${ex.target_reps ? ' · obj. ' + esc(ex.target_reps) : ''}${prev && prev.best_1rm ? ' · PR 1RM ' + prev.best_1rm + unit() : ''}</div></div>
        <button class="chip" onclick="App.removeExercise(${ei})">🗑</button>
      </header>
      <div class="set-table">
        <div class="set-head"><span>#</span><span>Ant.</span><span>${unit()}</span><span>Reps</span><span>RPE</span><span>✓</span></div>
        ${rows}
      </div>
      <div class="logger-actions"><button class="add-set" onclick="App.addSet(${ei})">＋ Añadir serie</button></div>
    </div>`;
  }

  const est1rm = (w, r) => (r > 0 && w > 0 ? w * (1 + r / 30) : 0);
  const fmtClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  function startWorkoutTick() {
    stopWorkoutTick();
    workoutTick = setInterval(() => {
      const el = document.getElementById('wk-timer');
      if (!el || !active) return stopWorkoutTick();
      el.textContent = fmtClock(Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000));
    }, 1000);
  }
  function stopWorkoutTick() { if (workoutTick) { clearInterval(workoutTick); workoutTick = null; } }

  function refreshLoggerStats() {
    let v = 0, n = 0;
    active.exercises.forEach(ex => ex.sets.forEach(s => {
      if (s.done && s.set_type !== 'warmup') { v += (+s.weight || 0) * (+s.reps || 0); n++; }
    }));
    const sv = document.getElementById('wk-vol'), ss = document.getElementById('wk-sets');
    if (sv) sv.textContent = fmtNum(v); if (ss) ss.textContent = n;
  }

  // --- acciones del logger ---
  function setVal(ei, si, field, val) { active.exercises[ei].sets[si][field] = val; saveActive(); refreshLoggerStats(); }
  function useprev(ei, si) {
    const ex = active.exercises[ei]; const p = ex.prev && ex.prev.last_sets && ex.prev.last_sets[si];
    if (!p) return; ex.sets[si].weight = p.weight; ex.sets[si].reps = p.reps; saveActive(); renderActiveLogger();
  }
  function toggleDone(ei, si) {
    const s = active.exercises[ei].sets[si];
    s.done = !s.done;
    // autocompletar con placeholder (última vez) si está vacío al marcar
    if (s.done) {
      const p = active.exercises[ei].prev?.last_sets?.[si];
      if (p) { if (s.weight === '') s.weight = p.weight; if (s.reps === '') s.reps = p.reps; }
      if (s.done && active.exercises[ei].rest_seconds) startRest(active.exercises[ei].rest_seconds);
      else if (s.done) startRest(120);
    }
    saveActive(); renderActiveLogger();
  }
  function cycleSetType(ei, si) {
    const order = ['normal', 'warmup', 'drop', 'fallo'];
    const s = active.exercises[ei].sets[si];
    s.set_type = order[(order.indexOf(s.set_type) + 1) % order.length];
    renumber(ei); saveActive(); renderActiveLogger();
  }
  function renumber(ei) {
    let n = 0; active.exercises[ei].sets.forEach(s => { if (s.set_type !== 'warmup') s.set_number = ++n; });
  }
  function addSet(ei) {
    const ex = active.exercises[ei]; const last = ex.sets[ex.sets.length - 1];
    ex.sets.push({ set_type: 'normal', weight: last ? last.weight : '', reps: last ? last.reps : '', rpe: '', done: false });
    renumber(ei); saveActive(); renderActiveLogger();
  }
  function removeExercise(ei) { active.exercises.splice(ei, 1); saveActive(); renderActiveLogger(); }

  function editWorkoutMeta() {
    openModal(`
      <h3>Ajustes del entreno</h3>
      <label class="field">Nombre</label>
      <input id="wm-name" value="${esc(active.name)}" />
      <label class="field">Tipo</label>
      <select id="wm-type">${TYPES.map(t => `<option ${t === active.type ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <label class="field">Notas</label>
      <textarea id="wm-notes" rows="3">${esc(active.notes || '')}</textarea>
      <button class="btn" onclick="App.saveWorkoutMeta()" style="margin-top:14px">Guardar</button>
    `);
  }
  function saveWorkoutMeta() {
    active.name = $('#wm-name').value || active.name;
    active.type = $('#wm-type').value; active.notes = $('#wm-notes').value;
    saveActive(); closeModal(); renderActiveLogger();
  }

  function cancelWorkout() {
    if (!confirm('¿Descartar este entrenamiento sin guardar?')) return;
    clearActive(); location.hash = 'home';
  }

  async function finishWorkout() {
    const hasData = active.exercises.some(ex => ex.sets.some(s => s.done && (+s.weight || +s.reps)));
    if (!hasData) { toast('Marca al menos una serie como completada (✓)'); return; }
    const payload = {
      name: active.name, type: active.type, notes: active.notes,
      started_at: active.started_at, routine_id: active.routine_id,
      duration_seconds: Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000),
      exercises: active.exercises.map(ex => ({
        exercise_id: ex.exercise_id,
        sets: ex.sets.filter(s => s.done && (+s.weight || +s.reps))
          .map(s => ({ set_type: s.set_type, weight: +s.weight || 0, reps: +s.reps || 0, rpe: s.rpe })),
      })).filter(ex => ex.sets.length),
    };
    try {
      const saved = await API.post('/workouts', payload);
      clearActive(); stopRest();
      toast('💪 ¡Entrenamiento guardado!');
      location.hash = 'view/' + saved.id;
    } catch (e) { toast(e.message); }
  }

  // --- selector de ejercicios ---
  async function pickExercises() {
    if (!exercises.length) exercises = await API.get('/exercises');
    let filter = 'todos', search = '';
    const selected = new Set();
    const render = () => {
      const list = exercises.filter(e =>
        (filter === 'todos' || e.muscle_group === filter) &&
        (!search || e.name.toLowerCase().includes(search.toLowerCase())));
      $('#ex-list').innerHTML = list.map(e => `
        <div class="ex-pick ${selected.has(e.id) ? 'sel' : ''}" data-id="${e.id}">
          <div><div>${esc(e.name)}</div><div class="mg">${esc(e.muscle_group)} · ${esc(e.category)}</div></div>
          <div>${selected.has(e.id) ? '✓' : '＋'}</div>
        </div>`).join('') || `<div class="empty">Sin resultados</div>`;
      $('#ex-list').querySelectorAll('.ex-pick').forEach(el => el.onclick = () => {
        const id = +el.dataset.id; selected.has(id) ? selected.delete(id) : selected.add(id);
        $('#ex-count').textContent = selected.size; render();
      });
    };
    openModal(`
      <h3>Añadir ejercicios</h3>
      <input id="ex-search" placeholder="Buscar…" />
      <div class="filter-row" id="ex-filters" style="margin-top:10px">
        ${['todos', ...MUSCLES].map(m => `<button class="filter-chip ${m === 'todos' ? 'on' : ''}" data-m="${m}">${m}</button>`).join('')}
      </div>
      <div id="ex-list" style="max-height:46vh;overflow-y:auto;margin:0 -4px"></div>
      <button class="btn ghost sm" onclick="App.newExerciseForm()" style="margin:10px 0">＋ Crear ejercicio nuevo</button>
      <button class="btn" onclick="App.confirmPick()" style="margin-top:6px">Añadir (<span id="ex-count">0</span>)</button>
    `);
    App._pickState = { selected, getFilter: () => filter, setFilter: (f) => filter = f, render };
    $('#ex-search').oninput = (e) => { search = e.target.value; render(); };
    $('#ex-filters').querySelectorAll('.filter-chip').forEach(c => c.onclick = () => {
      filter = c.dataset.m;
      $('#ex-filters').querySelectorAll('.filter-chip').forEach(x => x.classList.toggle('on', x === c));
      render();
    });
    render();
  }

  async function confirmPick() {
    const sel = App._pickState.selected;
    for (const id of sel) {
      const e = exercises.find(x => x.id === id);
      const ex = {
        exercise_id: e.id, name: e.name, muscle_group: e.muscle_group,
        sets: [{ set_type: 'normal', weight: '', reps: '', rpe: '', done: false }],
        rest_seconds: 120, prev: null,
      };
      active.exercises.push(ex);
      loadPrev(ex).then(() => { saveActive(); if (location.hash.includes('workout')) renderActiveLogger(); });
    }
    saveActive(); closeModal(); renderActiveLogger();
  }

  function newExerciseForm() {
    openModal(`
      <h3>Nuevo ejercicio</h3>
      <label class="field">Nombre</label><input id="ne-name" />
      <label class="field">Grupo muscular</label>
      <select id="ne-mg">${MUSCLES.map(m => `<option>${m}</option>`).join('')}</select>
      <label class="field">Material</label>
      <select id="ne-cat">${['barra', 'mancuerna', 'maquina', 'polea', 'peso corporal', 'kettlebell'].map(c => `<option>${c}</option>`).join('')}</select>
      <button class="btn" onclick="App.createExercise()" style="margin-top:14px">Crear</button>
    `);
  }
  async function createExercise() {
    const name = $('#ne-name').value.trim();
    if (!name) { toast('Pon un nombre'); return; }
    const e = await API.post('/exercises', { name, muscle_group: $('#ne-mg').value, category: $('#ne-cat').value });
    exercises.push(e); exercises.sort((a, b) => a.muscle_group.localeCompare(b.muscle_group) || a.name.localeCompare(b.name));
    toast('Ejercicio creado');
    pickExercises(); // reabre con el nuevo en la lista
  }

  // ============================ RUTINAS ============================
  async function renderRoutines() {
    shell(`<div class="view"><h1 class="view-title">Rutinas</h1><div class="empty">Cargando…</div></div>`);
    const routines = await API.get('/routines');
    let html = `<div class="view"><h1 class="view-title">Rutinas</h1>
      <div class="view-sub">Plantillas reutilizables de entrenamiento</div>
      <button class="btn" onclick="App.go('routine-edit/new')" style="margin-bottom:14px">＋ Nueva rutina</button>`;
    if (!routines.length) html += `<div class="empty"><span class="big-ico">📋</span>Crea tu primera rutina<br>para empezar más rápido.</div>`;
    html += routines.map(r => `
      <div class="card">
        <div class="card-row">
          <div onclick="App.go('routine-edit/${r.id}')" style="flex:1;cursor:pointer">
            <h3>${esc(r.name)}</h3><div class="muted">${r.exercise_count} ejercicios</div>
          </div>${pill(r.type)}
        </div>
        <div class="btn-row" style="margin-top:12px">
          <button class="btn sm" onclick="App.newFromRoutine(${r.id})">▶ Empezar</button>
          <button class="btn ghost sm" onclick="App.go('routine-edit/${r.id}')">Editar</button>
        </div>
      </div>`).join('');
    html += `</div>`;
    $('#view-container').innerHTML = html;
  }

  // editor de rutina (estado en memoria)
  let routineDraft = null;
  async function renderRoutineEditor(id) {
    if (!exercises.length) exercises = await API.get('/exercises');
    if (id === 'new') routineDraft = { name: '', type: 'hipertrofia', notes: '', exercises: [] };
    else { const r = await API.get('/routines/' + id); routineDraft = { id: r.id, name: r.name, type: r.type, notes: r.notes || '', exercises: r.exercises.map(e => ({ ...e })) }; }
    drawRoutineEditor();
  }
  function drawRoutineEditor() {
    shell('');
    const d = routineDraft;
    $('#view-container').innerHTML = `
      <div class="view">
        <button class="btn ghost sm" onclick="App.go('routines')" style="margin-bottom:12px">← Rutinas</button>
        <h1 class="view-title">${d.id ? 'Editar rutina' : 'Nueva rutina'}</h1>
        <label class="field">Nombre</label>
        <input id="rd-name" value="${esc(d.name)}" placeholder="Push A, Pierna, Full body…" oninput="App.rdSet('name',this.value)" />
        <label class="field">Tipo</label>
        <select id="rd-type" onchange="App.rdSet('type',this.value)">${TYPES.map(t => `<option ${t === d.type ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <div class="section-title">Ejercicios (${d.exercises.length})</div>
        ${d.exercises.map((e, i) => `
          <div class="card">
            <div class="card-row"><b>${esc(e.name)}</b><button class="chip" onclick="App.rdRemove(${i})">🗑</button></div>
            <div class="inline" style="margin-top:8px">
              <div><label class="field">Series</label><input type="number" value="${e.target_sets || 3}" onchange="App.rdEx(${i},'target_sets',+this.value)"></div>
              <div><label class="field">Reps</label><input value="${esc(e.target_reps || '8-12')}" onchange="App.rdEx(${i},'target_reps',this.value)"></div>
              <div><label class="field">Descanso(s)</label><input type="number" value="${e.rest_seconds || 120}" onchange="App.rdEx(${i},'rest_seconds',+this.value)"></div>
            </div>
          </div>`).join('')}
        <button class="btn ghost" onclick="App.rdPick()">＋ Añadir ejercicio</button>
        <button class="btn" onclick="App.rdSave()" style="margin-top:14px">${d.id ? 'Guardar cambios' : 'Crear rutina'}</button>
        ${d.id ? `<button class="btn danger" onclick="App.rdDelete()" style="margin-top:8px">Eliminar rutina</button>` : ''}
      </div>`;
  }
  function rdSet(k, v) { routineDraft[k] = v; }
  function rdEx(i, k, v) { routineDraft.exercises[i][k] = v; }
  function rdRemove(i) { routineDraft.exercises.splice(i, 1); drawRoutineEditor(); }
  async function rdPick() {
    if (!exercises.length) exercises = await API.get('/exercises');
    let filter = 'todos', search = '';
    const render = () => {
      const list = exercises.filter(e => (filter === 'todos' || e.muscle_group === filter) && (!search || e.name.toLowerCase().includes(search.toLowerCase())));
      $('#rdex-list').innerHTML = list.map(e => `<div class="ex-pick" data-id="${e.id}"><div><div>${esc(e.name)}</div><div class="mg">${esc(e.muscle_group)}</div></div><div>＋</div></div>`).join('');
      $('#rdex-list').querySelectorAll('.ex-pick').forEach(el => el.onclick = () => {
        const e = exercises.find(x => x.id === +el.dataset.id);
        routineDraft.exercises.push({ exercise_id: e.id, name: e.name, muscle_group: e.muscle_group, target_sets: 3, target_reps: '8-12', rest_seconds: 120 });
        closeModal(); drawRoutineEditor();
      });
    };
    openModal(`<h3>Añadir ejercicio</h3><input id="rdex-search" placeholder="Buscar…"/>
      <div class="filter-row" id="rdex-filters" style="margin-top:10px">${['todos', ...MUSCLES].map(m => `<button class="filter-chip ${m === 'todos' ? 'on' : ''}" data-m="${m}">${m}</button>`).join('')}</div>
      <div id="rdex-list" style="max-height:50vh;overflow-y:auto;margin:0 -4px"></div>`);
    $('#rdex-search').oninput = e => { search = e.target.value; render(); };
    $('#rdex-filters').querySelectorAll('.filter-chip').forEach(c => c.onclick = () => { filter = c.dataset.m; $('#rdex-filters').querySelectorAll('.filter-chip').forEach(x => x.classList.toggle('on', x === c)); render(); });
    render();
  }
  async function rdSave() {
    const d = routineDraft;
    if (!d.name.trim()) { toast('Pon un nombre a la rutina'); return; }
    if (!d.exercises.length) { toast('Añade al menos un ejercicio'); return; }
    const payload = { name: d.name, type: d.type, notes: d.notes, exercises: d.exercises.map(e => ({ exercise_id: e.exercise_id, target_sets: e.target_sets, target_reps: e.target_reps, rest_seconds: e.rest_seconds })) };
    if (d.id) await API.put('/routines/' + d.id, payload); else await API.post('/routines', payload);
    toast('Rutina guardada'); location.hash = 'routines';
  }
  async function rdDelete() {
    if (!confirm('¿Eliminar esta rutina?')) return;
    await API.del('/routines/' + routineDraft.id); toast('Rutina eliminada'); location.hash = 'routines';
  }

  // ============================ PROGRESO ============================
  async function renderProgress() {
    shell(`<div class="view"><h1 class="view-title">Progreso</h1><div class="empty">Cargando…</div></div>`);
    const [sum, trend, muscle, prs] = await Promise.all([
      API.get('/progress/summary'),
      API.get('/progress/volume-trend'),
      API.get('/progress/muscle-volume?days=30'),
      API.get('/progress/prs'),
    ]);
    const trendData = trend.map(t => ({ label: (t.week_start || '').slice(5), value: t.volume }));
    const muscleData = muscle.map(m => ({ label: m.muscle_group, value: m.sets }));

    let html = `<div class="view"><h1 class="view-title">Progreso</h1>
      <div class="view-sub">Tu evolución y récords</div>
      <div class="stats" style="margin-bottom:12px">
        <div class="stat"><div class="num">${sum.total}</div><div class="lbl">Entrenos</div></div>
        <div class="stat"><div class="num">${fmtNum(sum.volume)}</div><div class="lbl">Volumen ${unit()}</div></div>
      </div>

      <div class="chart-wrap"><h4>Volumen por semana (${unit()})</h4>${Charts.line(trendData, { color: '#87B15F' })}</div>
      <div class="chart-wrap"><h4>Series por grupo muscular · últimos 30 días</h4>${Charts.hbars(muscleData)}</div>

      <div class="section-title">Récords personales (1RM estimado)</div>
      ${prs.length ? prs.map(p => `
        <div class="card tap" onclick="App.go('exercise/${p.exercise_id}')">
          <div class="card-row">
            <div><b>${esc(p.name)}</b><div class="muted">${esc(p.muscle_group)}</div></div>
            <div style="text-align:right">
              <div class="pr-badge" style="font-family:Oswald;font-size:18px">${p.best_1rm} ${unit()}</div>
              <div class="muted">Máx: ${p.best_weight}×${p.best_weight_reps}</div>
            </div>
          </div>
        </div>`).join('') : `<div class="empty">Registra entrenamientos para ver tus récords.</div>`}
    </div>`;
    $('#view-container').innerHTML = html;
  }

  async function renderExerciseProgress(id) {
    shell(`<div class="view"><div class="empty">Cargando…</div></div>`);
    const ex = exercises.find(e => e.id === +id) || (exercises = await API.get('/exercises'), exercises.find(e => e.id === +id));
    const series = await API.get('/progress/exercise/' + id);
    const d1rm = series.map(s => ({ label: (s.date || '').slice(5), value: s.best_1rm }));
    const dweight = series.map(s => ({ label: (s.date || '').slice(5), value: s.top_weight }));
    $('#view-container').innerHTML = `
      <div class="view">
        <button class="btn ghost sm" onclick="App.go('progress')" style="margin-bottom:12px">← Progreso</button>
        <h1 class="view-title">${esc(ex ? ex.name : 'Ejercicio')}</h1>
        <div class="view-sub">${ex ? esc(ex.muscle_group) : ''} · ${series.length} sesiones</div>
        <div class="chart-wrap"><h4>1RM estimado (${unit()})</h4>${Charts.line(d1rm, { color: '#e9c46a' })}</div>
        <div class="chart-wrap"><h4>Peso máximo por sesión (${unit()})</h4>${Charts.line(dweight, { color: '#87B15F' })}</div>
      </div>`;
  }

  // ============================ PERFIL / PESO CORPORAL ============================
  async function renderProfile() {
    const body = await API.get('/body');
    const bwData = body.filter(b => b.bodyweight != null).reverse().map(b => ({ label: b.date.slice(5), value: b.bodyweight }));
    openModal(`
      <h3>👤 ${esc(user.username)}</h3>
      <label class="field">Unidad de peso</label>
      <select id="pf-unit" onchange="App.setUnit(this.value)">
        <option value="kg" ${unit() === 'kg' ? 'selected' : ''}>Kilogramos (kg)</option>
        <option value="lb" ${unit() === 'lb' ? 'selected' : ''}>Libras (lb)</option>
      </select>

      <div class="section-title">Peso corporal</div>
      ${bwData.length ? `<div class="chart-wrap"><h4>Evolución (${unit()})</h4>${Charts.line(bwData, { color: '#87B15F' })}</div>` : ''}
      <div class="inline">
        <div><label class="field">Peso (${unit()})</label><input id="bw-weight" type="number" inputmode="decimal" placeholder="${bwData.length ? bwData[bwData.length - 1].value : '–'}"></div>
        <div><label class="field">Cintura (cm)</label><input id="bw-waist" type="number" inputmode="decimal"></div>
      </div>
      <button class="btn sm" onclick="App.saveBody()" style="margin-top:10px">Registrar medida</button>

      ${body.length ? `<div class="section-title">Historial</div>` + body.slice(0, 8).map(b => `
        <div class="list-item"><span>${b.date}</span><span>${b.bodyweight != null ? b.bodyweight + ' ' + unit() : '–'}${b.waist ? ' · cintura ' + b.waist + 'cm' : ''}</span></div>`).join('') : ''}

      <hr class="sep">
      <button class="btn danger" onclick="App.logout()">Cerrar sesión</button>
    `);
  }
  async function setUnit(u) {
    const res = await API.patch('/auth/me', { unit: u }); user = res.user; toast('Unidad: ' + u);
  }
  async function saveBody() {
    const bw = $('#bw-weight').value, waist = $('#bw-waist').value;
    if (!bw && !waist) { toast('Introduce algún dato'); return; }
    await API.post('/body', { date: todayISO(), bodyweight: bw, waist });
    toast('Medida registrada'); renderProfile();
  }

  // ============================ REST TIMER ============================
  function startRest(seconds) {
    stopRest();
    restRemaining = seconds || 120;
    const box = document.getElementById('rest-timer');
    box.classList.remove('oculto');
    document.getElementById('rest-skip').onclick = stopRest;
    const upd = () => {
      document.getElementById('rest-count').textContent = fmtClock(restRemaining);
      if (restRemaining <= 0) { stopRest(); if (navigator.vibrate) navigator.vibrate(300); toast('⏱ ¡Descanso terminado!'); }
      restRemaining--;
    };
    upd(); restTimer = setInterval(upd, 1000);
  }
  function stopRest() { if (restTimer) clearInterval(restTimer); restTimer = null; document.getElementById('rest-timer').classList.add('oculto'); }

  // ============================ BOOT ============================
  function logout() { API.setToken(null); user = null; clearActive(); closeModal(); renderAuth(); }

  async function boot() {
    loadActive();
    try { user = (await API.get('/auth/me')).user; } catch { renderAuth(); return; }
    if (!location.hash || location.hash === '#login') location.hash = 'home';
    route();
  }

  window.addEventListener('hashchange', route);
  window.addEventListener('entrena:logout', () => { user = null; renderAuth(); });

  // arranque
  if (API.isAuthed) boot(); else renderAuth();

  // API pública para los onclick inline
  return {
    go: (h) => { location.hash = h; },
    startOrResume, newEmptyWorkout, newFromRoutine,
    setVal, useprev, toggleDone, cycleSetType, addSet, removeExercise,
    editWorkoutMeta, saveWorkoutMeta, cancelWorkout, finishWorkout,
    pickExercises, confirmPick, newExerciseForm, createExercise,
    deleteWorkout, logout, setUnit, saveBody,
    rdSet, rdEx, rdRemove, rdPick, rdSave, rdDelete,
    _pickState: null,
  };
})();
