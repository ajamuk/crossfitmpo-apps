# Detector precoz de bajas — CrossFit MPO Parla

Estima, para cada **socio activo**, la **probabilidad (%) de causar baja el mes
siguiente** y explica el porqué, para priorizar acciones de retención.

## Resultado
- **`salida/deteccion_bajas_parla.xlsx`** — libro con 3 hojas:
  - **Detector Bajas**: un socio por fila, ordenados de mayor a menor riesgo,
    con % de baja, nivel (🔴/🟠/🟡/🟢), motivo principal, factor protector y
    todas las métricas de apoyo.
  - **Metodología**: cómo se calcula y cómo usarlo.
  - **Modelo (pesos)**: los pesos del scorecard.

## Cómo funciona (resumen)
Se compara el comportamiento de **123 bajas** del último año (estado en el
momento de irse) con el de **251 socios activos** (estado hoy) y se construye un
**scorecard explicable**. Tres señales suman riesgo, cada una en su dirección
lógica:

1. **Recencia** — días desde la última reserva.
2. **Poca actividad reciente** — reservas en los últimos 30 días *(señal dominante)*.
3. **Poco historial acumulado** — reservas totales en el club.

La puntuación se convierte en probabilidad y se **re-calibra a la tasa real de
baja mensual del centro (~4 %)** con corrección de prevalencia (King & Zeng,
2001), de modo que el % es interpretable como riesgo del mes que viene.

- **Validación:** AUC ≈ **0.72** (5-fold). El motor *ordena* bien el riesgo; el
  % es una estimación calibrada, no una certeza.
- Se eligió un scorecard (y no una "caja negra" con más AUC) porque cada factor
  pesa en su dirección lógica y la **misma fórmula que puntúa es la que explica**.

### Nota empírica
Muchas bajas son *fin de contrato* con el socio aún activo (mudanza, lesión,
precio): son menos predecibles por uso. Por eso el "declive vs. el nivel
habitual" no resultó predictivo en estos datos y se muestra solo como contexto.

## Reproducir
```bash
pip install pandas openpyxl scikit-learn scipy
python3 detector_bajas.py
```
Recalcular **cada mes** con datos frescos de activos y bajas (mismos formatos).

## Tramos de riesgo
🔴 Crítico ≥ 15 % · 🟠 Alto 8–15 % · 🟡 Medio 4–8 % · 🟢 Bajo < 4 %
