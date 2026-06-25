// app.js — Logica de la SPA "Metro Verano" (JS vanilla, sin frameworks)
// Pantallas: onboarding, catalogo, entreno+timer, registro y ranking.

'use strict';

// ---------------------------------------------------------------------------
// Estado global de la app
// ---------------------------------------------------------------------------
const estado = {
  usuario: null,        // { id, nombre_usuario, box }
  boxElegido: '',       // box seleccionado en el onboarding
  entrenos: [],         // catalogo cargado
  hechos: new Set(),    // ids de entrenamientos ya completados por el usuario
  filtroCat: '',        // filtro de categoria activo
  filtroBox: '',        // filtro de box en ranking
  entrenoActivo: null,  // entrenamiento abierto en la pantalla de timer
};

const CLAVE_LS = 'metroVeranoUsuario'; // clave de localStorage

// Atajos para seleccionar en el DOM
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
// Convierte segundos a formato mm:ss (o hh:mm:ss si pasa de una hora)
function formatoTiempo(seg) {
  seg = Math.max(0, Math.floor(seg));
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  const dos = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${dos(h)}:${dos(m)}:${dos(s)}` : `${dos(m)}:${dos(s)}`;
}

// Cambia de vista mostrando una y ocultando el resto
function mostrarVista(nombre) {
  ['onboarding', 'catalogo', 'entreno', 'ranking'].forEach((v) => {
    $(`#vista-${v}`).classList.toggle('oculto', v !== nombre);
  });
  // Sincroniza la barra inferior
  $$('.nav-btn').forEach((b) => b.classList.toggle('activo', b.dataset.vista === nombre));
}

// ---------------------------------------------------------------------------
// Avisos sonoros (WebAudio, sin archivos externos)
// ---------------------------------------------------------------------------
let audioCtx = null;
function asegurarAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
// Emite un pitido corto. freq = tono, dur = duracion en segundos
function pitido(freq = 880, dur = 0.15) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gan = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  gan.gain.value = 0.18;
  osc.connect(gan);
  gan.connect(audioCtx.destination);
  const t = audioCtx.currentTime;
  osc.start(t);
  // pequeño fade-out para que no suene a "click"
  gan.gain.setValueAtTime(0.18, t);
  gan.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.stop(t + dur);
}
const pitidoGo = () => pitido(660, 0.18);          // inicio de intervalo de trabajo
const pitidoDescanso = () => pitido(440, 0.18);    // inicio de descanso
const pitidoCuenta = () => pitido(880, 0.08);      // 3-2-1
function pitidoFinal() {                            // fin del entrenamiento
  pitido(880, 0.2);
  setTimeout(() => pitido(1175, 0.35), 220);
}

// ---------------------------------------------------------------------------
// API — VERSION BETA SIN SERVIDOR
// En esta demo estatica (GitHub Pages) no hay backend Express ni SQLite: los
// 60 entrenamientos vienen embebidos en datos.js (window.ENTRENAMIENTOS) y los
// usuarios/registros se guardan en localStorage. Misma interfaz que la version
// real, asi que el resto de la app funciona igual.
// NOTA: el ranking solo ve los datos de ESTE navegador (no es compartido).
// ---------------------------------------------------------------------------
const LS = {
  leer(clave, porDefecto) {
    try { return JSON.parse(localStorage.getItem(clave)) ?? porDefecto; }
    catch (_) { return porDefecto; }
  },
  escribir(clave, valor) { localStorage.setItem(clave, JSON.stringify(valor)); },
};
const K_USUARIOS = 'demo_usuarios';
const K_REGISTROS = 'demo_registros';

const api = {
  // Crea o recupera un usuario por nombre (identificacion simple, sin contrasena)
  async crearUsuario(nombre_usuario, box) {
    const usuarios = LS.leer(K_USUARIOS, []);
    let u = usuarios.find((x) => x.nombre_usuario === nombre_usuario);
    if (!u) {
      u = {
        id: usuarios.length ? Math.max(...usuarios.map((x) => x.id)) + 1 : 1,
        nombre_usuario,
        box,
        creado_en: new Date().toISOString(),
      };
      usuarios.push(u);
      LS.escribir(K_USUARIOS, usuarios);
    }
    return u;
  },

  // Devuelve los entrenamientos embebidos, filtrando por categoria si se indica
  async entrenamientos(categoria = '') {
    const todos = window.ENTRENAMIENTOS || [];
    return categoria ? todos.filter((e) => e.categoria === categoria) : todos;
  },

  // Historial de un usuario, "uniendo" con los datos del entrenamiento
  async registros(usuarioId) {
    const regs = LS.leer(K_REGISTROS, []).filter((r) => r.usuario_id === usuarioId);
    const ents = window.ENTRENAMIENTOS || [];
    return regs.map((r) => {
      const e = ents.find((x) => x.id === r.entrenamiento_id) || {};
      return {
        ...r,
        nombre: e.nombre,
        categoria: e.categoria,
        formato_timer: e.formato_timer,
      };
    }).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  },

  // Guarda un entrenamiento completado
  async guardarRegistro(datos) {
    const regs = LS.leer(K_REGISTROS, []);
    const nuevo = {
      id: regs.length ? Math.max(...regs.map((x) => x.id)) + 1 : 1,
      usuario_id: datos.usuario_id,
      entrenamiento_id: datos.entrenamiento_id,
      duracion_real_seg: datos.duracion_real_seg,
      notas: datos.notas,
      fecha: new Date().toISOString(),
    };
    regs.push(nuevo);
    LS.escribir(K_REGISTROS, regs);
    return nuevo;
  },

  // Ranking por nº de entrenamientos completados (solo datos de este navegador)
  async ranking(box = '') {
    const usuarios = LS.leer(K_USUARIOS, []);
    const regs = LS.leer(K_REGISTROS, []);
    const filas = usuarios
      .filter((u) => !box || u.box === box)
      .map((u) => ({
        nombre_usuario: u.nombre_usuario,
        box: u.box,
        total: regs.filter((r) => r.usuario_id === u.id).length,
      }));
    filas.sort((a, b) => b.total - a.total || a.nombre_usuario.localeCompare(b.nombre_usuario));
    return filas;
  },
};

// ===========================================================================
// ONBOARDING
// ===========================================================================
function initOnboarding() {
  // Seleccion de box
  $('#grupo-boxes').addEventListener('click', (e) => {
    const btn = e.target.closest('.box-opcion');
    if (!btn) return;
    $$('.box-opcion').forEach((b) => b.classList.remove('activo'));
    btn.classList.add('activo');
    estado.boxElegido = btn.dataset.box;
  });

  // Envio del formulario
  $('#form-onboarding').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = $('#inp-nombre').value.trim();
    const err = $('#error-onboarding');
    if (!nombre) { err.textContent = 'Escribe un nombre de usuario.'; return; }
    if (!estado.boxElegido) { err.textContent = 'Elige tu box.'; return; }
    err.textContent = '';
    try {
      const usuario = await api.crearUsuario(nombre, estado.boxElegido);
      guardarSesion(usuario);
      await iniciarApp();
    } catch (ex) {
      err.textContent = ex.message;
    }
  });
}

// Guarda al usuario en memoria + localStorage para no repetir el onboarding
function guardarSesion(usuario) {
  estado.usuario = usuario;
  localStorage.setItem(CLAVE_LS, JSON.stringify(usuario));
}

// ===========================================================================
// CATALOGO
// ===========================================================================
function initCatalogo() {
  $('#filtros-categoria').addEventListener('click', async (e) => {
    const btn = e.target.closest('.filtro');
    if (!btn) return;
    $$('#filtros-categoria .filtro').forEach((b) => b.classList.remove('activo'));
    btn.classList.add('activo');
    estado.filtroCat = btn.dataset.cat;
    await cargarCatalogo();
  });
}

async function cargarCatalogo() {
  estado.entrenos = await api.entrenamientos(estado.filtroCat);
  await refrescarHechos();
  pintarCatalogo();
}

// Trae los registros del usuario para saber que entrenos estan "hechos"
async function refrescarHechos() {
  const registros = await api.registros(estado.usuario.id);
  estado.hechos = new Set(registros.map((r) => r.entrenamiento_id));
}

function pintarCatalogo() {
  const cont = $('#lista-entrenamientos');
  cont.innerHTML = '';
  estado.entrenos.forEach((ent) => {
    const hecho = estado.hechos.has(ent.id);
    const card = document.createElement('div');
    card.className = 'card-entreno' + (hecho ? ' hecho' : '');
    card.innerHTML = `
      ${hecho ? '<span class="check-hecho" title="Hecho">✔</span>' : ''}
      <h3>${ent.nombre}</h3>
      <div class="card-meta">
        <span class="badge">${ent.categoria}</span>
        <span class="badge badge-formato">${ent.formato_timer} · ${formatoTiempo(ent.duracion_objetivo_seg)}</span>
      </div>
      <p class="card-desc">${ent.descripcion}</p>
    `;
    card.addEventListener('click', () => abrirEntreno(ent));
    cont.appendChild(card);
  });
}

// ===========================================================================
// ENTRENO + TIMER
// ===========================================================================

// Motor del temporizador. Soporta los 5 formatos.
const timer = {
  intervalo: null,
  elapsed: 0,       // segundos transcurridos desde el inicio
  corriendo: false,
  modo: 'countdown',
  dur: 0,
  fin: false,

  // Configura el timer para un entrenamiento concreto
  preparar(ent) {
    this.parar();
    this.elapsed = 0;
    this.corriendo = false;
    this.fin = false;
    this.dur = ent.duracion_objetivo_seg || 0;
    const f = ent.formato_timer;
    if (f === 'EMOM') this.modo = 'emom';
    else if (f === 'Tabata') this.modo = 'tabata';
    else if (f === 'Libre') this.modo = 'libre';
    else this.modo = 'countdown'; // For Time y AMRAP -> cuenta atras
    this.render();
  },

  iniciar() {
    if (this.corriendo || this.fin) return;
    asegurarAudio();
    pitidoGo();
    this.corriendo = true;
    this.intervalo = setInterval(() => this.tick(), 1000);
    actualizarBotones();
    $('#timer-estado').textContent = (this.modo === 'tabata') ? 'TRABAJO' : 'EN MARCHA';
  },

  pausar() {
    if (!this.corriendo) return;
    clearInterval(this.intervalo);
    this.intervalo = null;
    this.corriendo = false;
    $('#timer-estado').textContent = 'PAUSA';
    actualizarBotones();
  },

  reset() {
    this.parar();
    this.elapsed = 0;
    this.corriendo = false;
    this.fin = false;
    $('#timer-estado').textContent = 'Listo';
    $('#form-registro').classList.add('oculto');
    this.render();
    actualizarBotones();
  },

  parar() {
    if (this.intervalo) clearInterval(this.intervalo);
    this.intervalo = null;
  },

  // Se ejecuta cada segundo
  tick() {
    this.elapsed += 1;

    // Avisos sonoros y deteccion de fin segun el modo
    if (this.modo === 'countdown') {
      const restante = this.dur - this.elapsed;
      if (restante <= 3 && restante > 0) pitidoCuenta();
      if (restante <= 0) return this.terminar();
    } else if (this.modo === 'emom') {
      if (this.elapsed >= this.dur) return this.terminar();
      if (this.elapsed % 60 === 0) pitidoGo(); // arranca un nuevo minuto
    } else if (this.modo === 'tabata') {
      if (this.elapsed >= this.dur) return this.terminar();
      const pos = this.elapsed % 30;
      if (pos === 0) pitidoGo();        // empieza trabajo
      else if (pos === 20) pitidoDescanso(); // empieza descanso
    }
    // 'libre' cuenta hacia arriba sin fin automatico

    this.render();
  },

  // Pinta el display segun el modo y el tiempo transcurrido
  render() {
    const disp = $('#timer-display');
    const sub = $('#timer-sub');
    disp.classList.remove('descanso');

    if (this.modo === 'countdown') {
      const restante = Math.max(0, this.dur - this.elapsed);
      disp.textContent = formatoTiempo(restante);
      sub.textContent = 'Tiempo objetivo: ' + formatoTiempo(this.dur);

    } else if (this.modo === 'libre') {
      disp.textContent = formatoTiempo(this.elapsed);
      sub.textContent = 'Cronometro libre · pulsa Terminar al acabar';

    } else if (this.modo === 'emom') {
      const totalMin = Math.ceil(this.dur / 60);
      const minActual = Math.min(totalMin, Math.floor(this.elapsed / 60) + 1);
      const restMin = 60 - (this.elapsed % 60);
      disp.textContent = formatoTiempo(restMin);
      sub.textContent = `Minuto ${minActual} / ${totalMin}`;

    } else if (this.modo === 'tabata') {
      const totalRondas = Math.ceil(this.dur / 30);
      const ronda = Math.min(totalRondas, Math.floor(this.elapsed / 30) + 1);
      const pos = this.elapsed % 30;
      const trabajo = pos < 20;
      const restante = trabajo ? 20 - pos : 30 - pos;
      disp.textContent = formatoTiempo(restante);
      if (!trabajo) disp.classList.add('descanso');
      sub.textContent = `Ronda ${ronda} / ${totalRondas} · ${trabajo ? 'TRABAJO' : 'DESCANSO'}`;
      if (this.corriendo) $('#timer-estado').textContent = trabajo ? 'TRABAJO' : 'DESCANSO';
    }
  },

  // Finaliza el entreno: para el crono, suena y abre el formulario de registro
  terminar() {
    this.parar();
    this.corriendo = false;
    this.fin = true;
    pitidoFinal();
    this.render();
    $('#timer-estado').textContent = 'COMPLETADO';
    abrirRegistro();
    actualizarBotones();
  },
};

function actualizarBotones() {
  const t = timer;
  const bEmp = $('#btn-empezar');
  const bPau = $('#btn-pausar');
  const bRes = $('#btn-reset');

  // En modo libre el boton principal sirve para Terminar mientras corre
  if (t.modo === 'libre' && t.corriendo) {
    bEmp.textContent = 'Terminar';
    bEmp.disabled = false;
  } else {
    bEmp.textContent = 'Empezar';
    bEmp.disabled = t.corriendo || t.fin;
  }
  bPau.textContent = t.corriendo ? 'Pausar' : 'Reanudar';
  bPau.disabled = (t.elapsed === 0 && !t.corriendo) || t.fin;
  bRes.disabled = (t.elapsed === 0 && !t.corriendo);
}

function abrirEntreno(ent) {
  estado.entrenoActivo = ent;
  $('#entreno-nombre').textContent = ent.nombre;
  $('#entreno-desc').textContent = ent.descripcion;
  $('#entreno-categoria').textContent = ent.categoria;
  $('#entreno-formato').textContent = ent.formato_timer;
  $('#form-registro').classList.add('oculto');
  $('#inp-notas').value = '';
  timer.preparar(ent);
  actualizarBotones();
  mostrarVista('entreno');
}

function abrirRegistro() {
  $('#registro-tiempo-val').textContent = formatoTiempo(timer.elapsed);
  $('#form-registro').classList.remove('oculto');
}

function initEntreno() {
  $('#btn-volver-catalogo').addEventListener('click', () => {
    timer.parar();
    mostrarVista('catalogo');
  });

  $('#btn-empezar').addEventListener('click', () => {
    // En libre, si ya esta corriendo, este boton termina
    if (timer.modo === 'libre' && timer.corriendo) timer.terminar();
    else timer.iniciar();
  });

  $('#btn-pausar').addEventListener('click', () => {
    if (timer.corriendo) timer.pausar();
    else timer.iniciar(); // Reanudar
  });

  $('#btn-reset').addEventListener('click', () => timer.reset());

  // Guardar el registro al terminar
  $('#form-registro').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.guardarRegistro({
        usuario_id: estado.usuario.id,
        entrenamiento_id: estado.entrenoActivo.id,
        duracion_real_seg: timer.elapsed,
        notas: $('#inp-notas').value.trim(),
      });
      // Actualiza la memoria de "hechos" y vuelve al catalogo
      estado.hechos.add(estado.entrenoActivo.id);
      mostrarVista('catalogo');
      pintarCatalogo();
    } catch (ex) {
      alert('No se pudo guardar: ' + ex.message);
    }
  });
}

// ===========================================================================
// RANKING
// ===========================================================================
function initRanking() {
  $('#filtros-ranking').addEventListener('click', async (e) => {
    const btn = e.target.closest('.filtro');
    if (!btn) return;
    $$('#filtros-ranking .filtro').forEach((b) => b.classList.remove('activo'));
    btn.classList.add('activo');
    estado.filtroBox = btn.dataset.box;
    await cargarRanking();
  });
}

async function cargarRanking() {
  const filas = await api.ranking(estado.filtroBox);
  const cuerpo = $('#cuerpo-ranking');
  cuerpo.innerHTML = '';
  if (!filas.length) {
    cuerpo.innerHTML = '<tr><td colspan="4" class="vacio">Aun no hay registros.</td></tr>';
    return;
  }
  filas.forEach((f, i) => {
    const tr = document.createElement('tr');
    if (estado.usuario && f.nombre_usuario === estado.usuario.nombre_usuario) tr.classList.add('yo');
    tr.innerHTML = `
      <td class="pos">${i + 1}</td>
      <td>${f.nombre_usuario}</td>
      <td>${f.box}</td>
      <td class="total">${f.total}</td>
    `;
    cuerpo.appendChild(tr);
  });
}

// ===========================================================================
// ARRANQUE DE LA APP
// ===========================================================================
function initNavegacion() {
  $('#nav-inferior').addEventListener('click', async (e) => {
    const btn = e.target.closest('.nav-btn');
    if (!btn) return;
    const v = btn.dataset.vista;
    mostrarVista(v);
    if (v === 'ranking') await cargarRanking();
    if (v === 'catalogo') await cargarCatalogo();
  });

  // Toque en el chip de usuario -> cerrar sesion (cambiar de atleta)
  $('#btn-usuario').addEventListener('click', () => {
    if (confirm('Cambiar de atleta?')) {
      localStorage.removeItem(CLAVE_LS);
      location.reload();
    }
  });
}

// Una vez identificado: muestra el chip, la nav y carga el catalogo
async function iniciarApp() {
  const chip = $('#btn-usuario');
  chip.innerHTML = `<b>${estado.usuario.nombre_usuario}</b> · ${estado.usuario.box}`;
  chip.classList.remove('oculto');
  $('#nav-inferior').classList.remove('oculto');
  mostrarVista('catalogo');
  await cargarCatalogo();
}

// Punto de entrada
function main() {
  initOnboarding();
  initCatalogo();
  initEntreno();
  initRanking();
  initNavegacion();

  // Si ya hay sesion guardada, saltamos el onboarding
  const guardado = localStorage.getItem(CLAVE_LS);
  if (guardado) {
    try {
      estado.usuario = JSON.parse(guardado);
      iniciarApp();
      return;
    } catch (_) { /* sesion corrupta: mostramos onboarding */ }
  }
  mostrarVista('onboarding');
}

document.addEventListener('DOMContentLoaded', main);
