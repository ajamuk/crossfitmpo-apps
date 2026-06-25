// seed.js — Poblado inicial de la base de datos
// Inserta 60 entrenamientos SIN MATERIAL (peso corporal / correr / saltar / burpees...),
// 20 por cada categoria: Cardio, Fuerza y CrossFit. Cada uno con un formato de timer coherente.
//
// Ejecutar con:  npm run seed   (o:  node seed.js)
// Es idempotente: vacia la tabla entrenamientos y la vuelve a llenar.

const db = require('./db');

// --- 20 ENTRENAMIENTOS DE CARDIO -------------------------------------------------
const cardio = [
  { nombre: 'Sprint en el sitio', formato: 'Tabata', dur: 240,
    desc: '8 rondas de 20s a tope corriendo en el sitio (rodillas altas) + 10s de descanso. Protocolo Tabata clasico.' },
  { nombre: 'Burpees AMRAP 7', formato: 'AMRAP', dur: 420,
    desc: 'Maximo numero de burpees posible en 7 minutos. Ritmo constante, no salgas a sprint.' },
  { nombre: 'Cien jumping jacks For Time', formato: 'For Time', dur: 300,
    desc: 'Completa 100 jumping jacks lo mas rapido posible. El crono cuenta atras desde el limite.' },
  { nombre: 'Mountain climbers EMOM 10', formato: 'EMOM', dur: 600,
    desc: 'Cada minuto, durante 10 minutos: 30 mountain climbers. El tiempo restante del minuto, descansas.' },
  { nombre: 'Carrera continua suave', formato: 'Libre', dur: 1200,
    desc: 'Trote suave continuo durante 20 minutos. Mantente en zona aerobica, deberias poder hablar.' },
  { nombre: 'Saltos de patinador Tabata', formato: 'Tabata', dur: 240,
    desc: '8 rondas Tabata (20s/10s) de skater jumps laterales. Aterriza suave y controla la rodilla.' },
  { nombre: 'Cincuenta burpees For Time', formato: 'For Time', dur: 600,
    desc: '50 burpees lo mas rapido que puedas. Pecho al suelo y salto con palmada arriba.' },
  { nombre: 'Rodillas al pecho AMRAP 6', formato: 'AMRAP', dur: 360,
    desc: 'AMRAP 6 min: 20 high knees + 10 jumping jacks por ronda. Cuenta tus rondas.' },
  { nombre: 'Talones al gluteo EMOM 8', formato: 'EMOM', dur: 480,
    desc: 'EMOM 8 min: 40 butt kicks (talones al gluteo) cada minuto. Cadencia alta de zancada.' },
  { nombre: 'Intervalos de sprint', formato: 'Libre', dur: 900,
    desc: '15 min libres: alterna 30s sprint fuerte y 60s trote suave. Repite hasta acabar el tiempo.' },
  { nombre: 'Jumping jacks AMRAP 5', formato: 'AMRAP', dur: 300,
    desc: 'Maximos jumping jacks en 5 minutos. Reto rapido para subir pulsaciones en verano.' },
  { nombre: 'Salto del patinador For Time', formato: 'For Time', dur: 300,
    desc: '80 skater jumps (40 por lado) lo mas rapido posible.' },
  { nombre: 'Burpees Tabata', formato: 'Tabata', dur: 240,
    desc: '8 rondas Tabata de burpees. Maximo numero de reps en cada intervalo de 20s.' },
  { nombre: 'High knees EMOM 6', formato: 'EMOM', dur: 360,
    desc: 'EMOM 6 min: 50 rodillas altas a maxima cadencia cada minuto.' },
  { nombre: 'Carrera progresiva', formato: 'Libre', dur: 1500,
    desc: '25 min libres: empieza suave y sube el ritmo cada 5 min. Termina fuerte los ultimos 5.' },
  { nombre: 'Saltos en estrella AMRAP 8', formato: 'AMRAP', dur: 480,
    desc: 'AMRAP 8 min: 15 star jumps + 10 burpees por ronda. Buen quemador de verano.' },
  { nombre: 'Ida y vuelta a sprint', formato: 'For Time', dur: 420,
    desc: '10 sprints de 20-30 metros con vuelta al trote. Anota el tiempo total.' },
  { nombre: 'Mountain climbers Tabata', formato: 'Tabata', dur: 240,
    desc: '8 rondas Tabata de mountain climbers. Cadera baja y core firme.' },
  { nombre: 'Combo cardio EMOM 12', formato: 'EMOM', dur: 720,
    desc: 'EMOM 12 min alternando: min impar 15 burpees, min par 40 jumping jacks.' },
  { nombre: 'Trote regenerativo', formato: 'Libre', dur: 1800,
    desc: '30 min de trote muy suave para recuperar. Ideal como cardio de dia ligero.' },
];

// --- 20 ENTRENAMIENTOS DE FUERZA (peso corporal) --------------------------------
const fuerza = [
  { nombre: 'Flexiones EMOM 10', formato: 'EMOM', dur: 600,
    desc: 'EMOM 10 min: 10 flexiones estrictas cada minuto. Si no llegas, baja a flexiones de rodillas.' },
  { nombre: 'Cien sentadillas For Time', formato: 'For Time', dur: 480,
    desc: '100 sentadillas al aire lo mas rapido posible. Baja por debajo del paralelo.' },
  { nombre: 'Plancha isometrica', formato: 'Libre', dur: 300,
    desc: 'Acumula 5 minutos en plancha. Descansa lo necesario pero suma el tiempo total bajo tension.' },
  { nombre: 'Zancadas AMRAP 8', formato: 'AMRAP', dur: 480,
    desc: 'AMRAP 8 min: 20 zancadas alternas + 10 sentadillas con salto por ronda.' },
  { nombre: 'Flexiones diamante Tabata', formato: 'Tabata', dur: 240,
    desc: '8 rondas Tabata de flexiones diamante para triceps. Codos pegados al cuerpo.' },
  { nombre: 'Sentadilla isometrica en pared', formato: 'Libre', dur: 240,
    desc: 'Wall sit: aguanta sentado contra la pared, muslos paralelos al suelo, el maximo tiempo en 4 min.' },
  { nombre: 'Pike push-ups EMOM 8', formato: 'EMOM', dur: 480,
    desc: 'EMOM 8 min: 8 flexiones pica (hombro) cada minuto. Cadera alta, baja la cabeza entre las manos.' },
  { nombre: 'Hollow hold Tabata', formato: 'Tabata', dur: 240,
    desc: '8 rondas Tabata de hollow hold (barquito). Lumbar pegada al suelo siempre.' },
  { nombre: 'Puente de gluteo AMRAP 6', formato: 'AMRAP', dur: 360,
    desc: 'AMRAP 6 min: 25 puentes de gluteo + 15s de plancha por ronda.' },
  { nombre: 'Sentadilla bulgara For Time', formato: 'For Time', dur: 420,
    desc: '60 sentadillas bulgaras (30 por pierna, pie atras en una silla o banco) for time.' },
  { nombre: 'Flexiones declinadas EMOM 10', formato: 'EMOM', dur: 600,
    desc: 'EMOM 10 min: 8 flexiones con los pies elevados cada minuto. Mas carga en pecho alto y hombro.' },
  { nombre: 'Pistol squats asistidas AMRAP 7', formato: 'AMRAP', dur: 420,
    desc: 'AMRAP 7 min: 10 pistol squats asistidas (sujeto a algo) alternas por ronda.' },
  { nombre: 'Fondos de triceps en suelo Tabata', formato: 'Tabata', dur: 240,
    desc: '8 rondas Tabata de fondos de triceps sentado (manos atras en el suelo, sube la cadera).' },
  { nombre: 'Superman hold', formato: 'Libre', dur: 180,
    desc: 'Acumula 3 minutos de superman (boca abajo, brazos y piernas elevados) para cadena posterior.' },
  { nombre: 'Zancadas caminando For Time', formato: 'For Time', dur: 360,
    desc: '60 zancadas caminando (30 por pierna) lo mas rapido posible manteniendo la tecnica.' },
  { nombre: 'Plancha lateral EMOM 8', formato: 'EMOM', dur: 480,
    desc: 'EMOM 8 min alternando lado: 30s de plancha lateral por minuto (cambia de lado cada minuto).' },
  { nombre: 'Sentadillas con salto AMRAP 6', formato: 'AMRAP', dur: 360,
    desc: 'AMRAP 6 min de jump squats. Amortigua bien la caida para cuidar rodillas.' },
  { nombre: 'Flexiones cerradas For Time', formato: 'For Time', dur: 420,
    desc: '50 flexiones cerradas (manos juntas) lo mas rapido posible. Triceps a tope.' },
  { nombre: 'Elevaciones de gemelo EMOM 6', formato: 'EMOM', dur: 360,
    desc: 'EMOM 6 min: 30 elevaciones de gemelo de pie cada minuto. Rango completo arriba y abajo.' },
  { nombre: 'Core total Tabata', formato: 'Tabata', dur: 240,
    desc: '8 rondas Tabata alternando crunch, bicicleta y elevaciones de piernas. Abdomen completo.' },
];

// --- 20 ENTRENAMIENTOS DE CROSSFIT (WODs sin material) --------------------------
const crossfit = [
  { nombre: 'Cindy adaptado AMRAP 20', formato: 'AMRAP', dur: 1200,
    desc: 'AMRAP 20 min: 5 burpees + 10 flexiones + 15 sentadillas por ronda. Version sin barra del clasico Cindy.' },
  { nombre: 'Chipper de verano For Time', formato: 'For Time', dur: 900,
    desc: 'For time: 50 jumping jacks, 40 sentadillas, 30 mountain climbers, 20 flexiones, 10 burpees.' },
  { nombre: 'Death by burpees EMOM', formato: 'EMOM', dur: 600,
    desc: 'Min 1: 1 burpee, min 2: 2 burpees... suma uno cada minuto hasta no completarlo. Cap 10 min.' },
  { nombre: 'Air squats Tabata', formato: 'Tabata', dur: 240,
    desc: '8 rondas Tabata de sentadillas al aire. Maximas reps por intervalo, anota el peor.' },
  { nombre: 'Doblete AMRAP 12', formato: 'AMRAP', dur: 720,
    desc: 'AMRAP 12 min: 10 burpees + 20 sentadillas al aire por ronda.' },
  { nombre: 'Murph adaptado sin material', formato: 'For Time', dur: 2400,
    desc: 'For time: 800m correr, 100 flexiones, 200 sentadillas, 300 jumping jacks, 800m correr. Reparte como quieras.' },
  { nombre: 'EMOM 16 cuatro estaciones', formato: 'EMOM', dur: 960,
    desc: 'EMOM 16: min1 burpees, min2 sentadillas, min3 flexiones, min4 mountain climbers. 4 vueltas.' },
  { nombre: 'Tabata mixto de core', formato: 'Tabata', dur: 240,
    desc: '8 rondas Tabata alternando hollow hold y mountain climbers. Pulsaciones + core.' },
  { nombre: 'Escalera AMRAP 10', formato: 'AMRAP', dur: 600,
    desc: 'AMRAP 10 min en escalera: 2-4-6-8... burpees y el doble de sentadillas cada ronda.' },
  { nombre: '21-15-9 flexiones y sentadillas', formato: 'For Time', dur: 540,
    desc: 'For time clasico 21-15-9: flexiones y sentadillas al aire. Sin descanso entre bloques.' },
  { nombre: 'EMOM 20 dos movimientos', formato: 'EMOM', dur: 1200,
    desc: 'EMOM 20: minutos impares 12 burpees, minutos pares 20 zancadas alternas.' },
  { nombre: 'Tabata burpees y climbers', formato: 'Tabata', dur: 480,
    desc: 'Doble Tabata (16 rondas): primeras 8 burpees, ultimas 8 mountain climbers. 1 min de descanso entre bloques.' },
  { nombre: 'Triplete AMRAP 15', formato: 'AMRAP', dur: 900,
    desc: 'AMRAP 15 min: 5 burpees + 10 flexiones + 15 jumping jacks por ronda.' },
  { nombre: 'The Chief adaptado', formato: 'AMRAP', dur: 1080,
    desc: '5 bloques de AMRAP 3 min con 1 min de descanso: 3 burpees + 6 flexiones + 9 sentadillas por ronda.' },
  { nombre: 'Cien burpees For Time', formato: 'For Time', dur: 900,
    desc: '100 burpees por tiempo. El reto mental del verano. Marca un ritmo y aguantalo.' },
  { nombre: 'EMOM 12 par de movimientos', formato: 'EMOM', dur: 720,
    desc: 'EMOM 12: min impar 15 mountain climbers + 5 burpees, min par 20 sentadillas.' },
  { nombre: 'Tabata doble fuerza', formato: 'Tabata', dur: 480,
    desc: '16 rondas Tabata: 8 de sentadillas con salto y 8 de flexiones. Tren inferior y superior.' },
  { nombre: 'Sprint y burpees AMRAP 8', formato: 'AMRAP', dur: 480,
    desc: 'AMRAP 8 min: 30s de sprint en el sitio + 8 burpees por ronda.' },
  { nombre: '50-40-30-20-10 mixto', formato: 'For Time', dur: 1200,
    desc: 'For time descendente de jumping jacks; en cada bloque mete 10 burpees. Suma total alta.' },
  { nombre: 'Hero WOD bodyweight Verano', formato: 'For Time', dur: 1500,
    desc: 'For time: 5 rondas de 400m correr + 15 burpees + 25 sentadillas. Hidratate, es verano.' },
];

// Unimos todo etiquetando la categoria
const todos = [
  ...cardio.map(e => ({ ...e, categoria: 'Cardio' })),
  ...fuerza.map(e => ({ ...e, categoria: 'Fuerza' })),
  ...crossfit.map(e => ({ ...e, categoria: 'CrossFit' })),
];

// Vaciamos y reinsertamos en una transaccion (rapido y seguro)
const limpiar = db.prepare('DELETE FROM entrenamientos');
const insertar = db.prepare(`
  INSERT INTO entrenamientos (nombre, categoria, descripcion, formato_timer, duracion_objetivo_seg)
  VALUES (@nombre, @categoria, @desc, @formato, @dur)
`);

const cargar = db.transaction((lista) => {
  limpiar.run();
  for (const e of lista) insertar.run(e);
});

cargar(todos);

// Verificacion en consola
const total = db.prepare('SELECT count(*) AS n FROM entrenamientos').get().n;
const porCat = db.prepare('SELECT categoria, count(*) AS n FROM entrenamientos GROUP BY categoria ORDER BY categoria').all();
console.log(`Seed completado. Total entrenamientos: ${total}`);
porCat.forEach(c => console.log(`  - ${c.categoria}: ${c.n}`));
