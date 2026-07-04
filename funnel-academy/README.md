# Funnel de ventas · CrossFit Academy

Sistema completo de conversión **lead → socio** para el programa de iniciación
Academy de CrossFit Metropolitano (Getafe · Parla · Las Rosas). Todo estático,
listo para GitHub Pages, sin backend.

## Piezas

| Archivo | Herramienta | Para quién |
|---|---|---|
| `index.html` | **Landing de captación** — oferta (clase gratis + Academy 4 semanas), dolores, prueba social, formulario, FAQ de objeciones, urgencia y CTA sticky de WhatsApp | El lead |
| `gracias.html` | **Página de gracias** — confirma, reduce no-shows (WhatsApp directo, botón Google Calendar, checklist del primer día) y pide el referido | El lead |
| `crm.html` | **Pipeline CRM** — tablero de 6 etapas con SLA y avisos ⚠, plantillas de WhatsApp por etapa, métricas de conversión y export a CSV | El equipo |
| `playbook.html` | **Playbook operativo** — mapa del funnel con KPIs, secuencias WhatsApp/email, guion de la clase de prueba, objeciones, reactivación y copy de anuncios | El equipo |

## Cómo se conectan

1. El formulario de la landing guarda el lead en `localStorage`
   (`cfmpo_funnel_leads`), abre un WhatsApp ya redactado y redirige a `gracias.html`.
2. `crm.html` lee esa misma clave: los leads de la landing aparecen solos en la
   columna **Lead nuevo** (mismo navegador/dominio). Los de otros canales se añaden a mano.
3. Cada tarjeta del CRM tiene un botón **WhatsApp** que abre la plantilla de la
   etapa en la que está el lead (las plantillas viven en el playbook).
4. La landing captura los UTM (`?utm_source=...`) y los adjunta al lead, para
   saber qué canal trae socios y no solo clics.

## Notas

- El número de WhatsApp (34604840858) y los datos de prueba social son los de la
  landing beta existente: revisar antes de publicar.
- `localStorage` es por navegador: el CRM está pensado para usarse desde un único
  dispositivo por box (la tablet de recepción). El export CSV permite consolidar.
