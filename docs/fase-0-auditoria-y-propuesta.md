# Fase 0 — Auditoría de crossfitmetropolitano.com y propuesta de rediseño

Fecha: 2026-07-02 · Rama: `claude/crossfit-metropolitano-redesign-0429ai`

---

## 1. Auditoría de la web actual

### 1.1 Stack y velocidad

| Dato | Valor |
|---|---|
| CMS | WordPress 7.0 + **Elementor 4.1.1** (builder pesado) |
| HTML de la home | ~89 KB solo el documento |
| Scripts en la home | **36** etiquetas `<script>` |
| Hojas de estilo | **27** stylesheets |
| Descarga del HTML | ~2,7 s (sin contar CSS/JS/imágenes) |
| Consentimiento cookies | Sistema TCF (añade peso y bloqueo de render) |

Con 60+ recursos bloqueantes, el Lighthouse móvil real estará muy por debajo de 90 en Performance. Es el patrón típico Elementor: imposible de arreglar sin salir del builder.

### 1.2 Estructura de páginas actual

| URL | H1 actual | Problema |
|---|---|---|
| `/` | "Entrena Crossfit en Madrid: Las Rosas, parla y Getafe" | Capitalización inconsistente ("parla"); subtítulo "¡Ahora ya no tienes ninguna excusa…!" viola el tono de marca |
| `/crossfit-parla/` | "El único box de CrossFit oficial en Parla" | Keyword "CrossFit en Parla" solo en H2; el ángulo emocional ya es el correcto |
| `/crossfit-en-getafe/` | "EL MEJOR BOX de CROSSFIT EN Getafe" | Keyword intacta solo en H2; CTAs "¡Quiero cambiar!", "¡quiero mi plaza!" (imperativos vacíos) |
| `/crossfit-las-rosas/` | **Dos H1** ("EL MEJOR BOX…" + "Entrena Crossfit en las rosas…") | Error SEO (doble H1); CTAs en mayúsculas gritadas hacia formulario, no WhatsApp |
| `/politica-de-privacidad/` | — | Única página legal; faltan aviso legal y cookies |

No existen páginas de CrossFit Academy, HYROX, precios/FAQ ni contacto.

### 1.3 SEO on-page

- **Sitemap**: Yoast en `/sitemap_index.xml` (robots.txt correcto). `/sitemap.xml` da 404.
- **Schema.org**: no se detecta `LocalBusiness` por box (pérdida clara para SEO local con 3 direcciones reales).
- **Keywords**: "CrossFit en Getafe/Parla/Las Rosas" aparecen pero no siempre intactas en H1. "Preparación HYROX" solo como H2 genérico en la home. "CrossFit desde cero", "Entrenamiento funcional" sin página/heading propio.
- **Inconsistencia de contacto**: Parla y Las Rosas muestran +34 604 840 858; Getafe muestra "+34 660 484 08 58" (parece errata). A unificar/confirmar.

### 1.4 Conversión

- La home dispersa: 3 CTAs distintos hacia las páginas de box, sin CTA de conversión directa (WhatsApp/formulario) above the fold.
- Parla ya convierte bien (todo a WhatsApp con mensaje prellenado). Getafe y Las Rosas mezclan formulario + WhatsApp con CTAs agresivos.
- No hay botón de WhatsApp persistente en móvil (80 % del tráfico).
- No se muestran precios ni horarios en ninguna página (fricción para la objeción "es caro").

### 1.5 Lo que ya funciona (conservar)

- El copy de Parla ("Ese CrossFit existe. Pero no es el nuestro") es exactamente el tono de marca definido.
- El posicionamiento anti-"gym bro" ya está sembrado en la home.
- URLs actuales limpias y en español → **se conservan intactas** para no perder SEO.
- En este repo ya existe `landing-beta/` con un sistema visual "sports editorial" refinado en 6 commits: se propone como base del sistema de diseño (ver §4).

---

## 2. Arquitectura de páginas propuesta

Cada página tiene UN objetivo de conversión y un ángulo emocional fijo.

| URL | Página | Keyword en H1/H2 (intacta) | Ángulo | Conversión |
|---|---|---|---|---|
| `/` | Home | CrossFit Madrid · Grupos reducidos · Entrenadores certificados | Comunidad: "Para gente normal, de verdad" | Formulario + WhatsApp del box elegido |
| `/crossfit-en-getafe/` ✅ se mantiene | Box Getafe | CrossFit en Getafe · Preparación HYROX en Getafe | Procrastinación: "Llevas tiempo diciéndote que lo harás" | WhatsApp Getafe |
| `/crossfit-parla/` ✅ se mantiene | Box Parla | CrossFit en Parla · Preparación HYROX en Parla | Romper el mito: "CrossFit no es lo que crees" | WhatsApp Parla |
| `/crossfit-las-rosas/` ✅ se mantiene | Box Las Rosas | CrossFit en Las Rosas · Preparación HYROX en Las Rosas | Tiempo propio: "Una hora al día que es solo tuya" | WhatsApp Las Rosas |
| `/crossfit-academy/` nueva | CrossFit Academy | CrossFit desde cero · Grupos reducidos | Empezar sin saber nada, máx. 8 personas | WhatsApp/formulario con box |
| `/preparacion-hyrox/` nueva | HYROX | Preparación HYROX en Madrid · Entrenamiento funcional | Objetivo concreto sin dejar de ser gente normal | WhatsApp/formulario con box |
| `/precios/` nueva | Precios + FAQ | — (FAQ ataca "es caro", "me voy a lesionar", "no tengo tiempo") | Transparencia | WhatsApp/formulario |
| `/contacto/` nueva | Contacto | — | Baja fricción | Formulario + 3 WhatsApp |
| `/politica-de-privacidad/` ✅ se mantiene | Legal | — | — | — |
| `/aviso-legal/`, `/politica-de-cookies/` nuevas | Legal (BOXMANIA 2017 SL) | — | — | — |

Navegación: Boxes (3) · Empieza desde cero · HYROX · Precios · CTA fija "Prueba una clase".

---

## 3. Stack técnico recomendado

- **Astro 5, salida 100 % estática.** Cero JavaScript de framework en el cliente. Lighthouse ≥ 90 garantizable por construcción.
- **CSS propio con design tokens** (custom properties), sin Tailwind ni librerías: el sistema de `landing-beta/` ya demuestra que basta y pesa ~15 KB.
- **Tipografías auto-alojadas** (woff2 con `font-display: swap`), sin llamada a Google Fonts (rendimiento + RGPD).
- **JS vanilla mínimo**: menú móvil, FAQ (`<details>` nativo) y formulario. Nada más.
- **Formulario sin backend**: nombre + teléfono + box → al enviar, abre WhatsApp del box elegido con mensaje prellenado (cero coste, cero mantenimiento, el lead llega donde ya respondéis). Alternativa si se quiere email: Formspree/Web3Forms (decisión en checkpoint).
- **SEO**: meta title/description únicos por página, schema.org `LocalBusiness` (ExerciseGym) por box con dirección real, `sitemap.xml` generado en build, Open Graph, URLs actuales conservadas.
- **Accesibilidad AA**: contraste verificado, foco visible, HTML semántico, targets táctiles ≥ 44 px.
- Estructura en el repo: carpeta `site/` (proyecto Astro) sin tocar `landing-beta/`, `metro-verano-beta/` ni los checklists existentes.

---

## 4. Sistema de diseño

Base: el estilo "sports editorial" ya iterado en `landing-beta/` (6 commits de refinamiento previos).

**Color**

| Token | Valor | Uso |
|---|---|---|
| `--black` | `#0E0E0D` | Fondos de bloque, texto principal |
| `--paper` | `#EFE9E9` | Fondo general (cálido, no clínico) |
| `--white` | `#FFFCF7` | Tarjetas, texto sobre negro |
| `--green` | `#88AF60` | Acento (WhatsApp-friendly), foco |
| `--green-dark` | `#48662F` | Acento sobre claro (contraste AA) |

**Tipografía**: Anton (titulares display, mayúsculas, interlineado compacto) + Manrope (texto, 400–900). Ambas auto-alojadas.

**Componentes**: header sticky con CTA permanente · botón WhatsApp flotante en móvil · hero editorial con foto tratada (desaturada + contraste) · tarjetas con retícula de líneas finas (hairlines) · bloques de "objeción → respuesta" · FAQ con `<details>` · formulario oscuro de 3 campos · footer con los 3 boxes y NAP completo (SEO local).

**Voz en la interfaz**: CTAs de baja fricción ("Escríbenos. Sin compromiso. Sin presión."), itálicas para pensamientos del cliente, cero exclamaciones vacías.

---

## 5. Checkpoint — decisiones que necesito antes de escribir código

1. ¿Apruebas **Astro estático + CSS propio** como stack?
2. ¿Apruebas el **sistema de diseño basado en `landing-beta/`** (Anton/Manrope, negro-papel-verde)?
3. Formulario: ¿**envío a WhatsApp prellenado** (recomendado, sin backend) o servicio de email tipo Formspree?
4. ¿Confirmas **conservar las URLs actuales** y añadir las nuevas en español tal como propone la tabla de §2?
