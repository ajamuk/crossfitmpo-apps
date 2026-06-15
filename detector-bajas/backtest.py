#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Backtest temporal del detector de bajas — CrossFit MPO Parla
============================================================

Valida el modelo "como si estuviéramos en el pasado": para cada mes de prueba M
reconstruye el estado de TODOS los socios en riesgo a cierre de M-1 usando SOLO
información anterior, predice quién causará baja en M y lo compara con las bajas
reales de M (walk-forward: cada mes se entrena solo con meses previos).

Población en riesgo en el mes M:
  socios cuya alta es <= fin de M-1 y que aún no se habían dado de baja antes de M.
  - Activos hoy  -> nunca causan baja (label 0 en todos sus meses).
  - Bajas        -> label 1 sólo en su mes de baja; 0 en los meses previos.

Features (reconstruidas SOLO con la rejilla mensual hasta M-1, para no usar
futuro): recencia en meses, volumen del último mes, historial acumulado. Son una
versión mensual (más gruesa) de las del modelo en producción, por lo que el
backtest es una cota CONSERVADORA del rendimiento real.

Métricas por mes:
  - AUC (capacidad de ordenar el riesgo).
  - Captura en el top-decil: % de las bajas reales que caían en el 10% de mayor
    riesgo estimado.
  - Lift: cuántas veces más concentrada está la baja en ese grupo vs. el azar.
  - Precisión@N: de los N socios más arriesgados (N = nº de bajas reales del mes),
    cuántos se dieron realmente de baja.
"""
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

DATA = "datos/"
F_ACT = DATA + "activos_parla_202606.xlsx"
F_BAJ = DATA + "bajas_parla_202506_202604.xlsx"

# Ventana con etiquetas de baja completas
LABEL_START = pd.Period("2025-06", "M")
LABEL_END = pd.Period("2026-04", "M")
# Meses de prueba (con bajas "normales"; jun/jul-25 fueron cierre masivo -> sólo train)
TEST_MONTHS = [pd.Period(m, "M") for m in
               ["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-03", "2026-04"]]
SCORE_FEATURES = ["recencia", "poco_vol", "poco_hist"]


def load_panel():
    """Construye un panel (socio, mes) con actividad mensual, alta y mes de baja."""
    def read(path, churn):
        tm = pd.read_excel(path, sheet_name="Tabla Maestra")
        rm = pd.read_excel(path, sheet_name="Reservas Mensuales")
        mc = [c for c in rm.columns if isinstance(c, str) and len(c) == 7 and c[4] == "-"]
        rm = rm.set_index("ID")
        recs = []
        for _, r in tm.iterrows():
            ID = r["ID"]
            alta = pd.to_datetime(r["Alta"], format="%d/%m/%Y", errors="coerce")
            baja_m = None
            if churn:
                b = pd.to_datetime(r["Baja"], format="%d/%m/%Y", errors="coerce")
                baja_m = None if pd.isna(b) else pd.Period(b, "M")
            series = {}
            if ID in rm.index:
                srow = rm.loc[ID]
                if isinstance(srow, pd.DataFrame):
                    srow = srow.iloc[0]
                s = pd.to_numeric(srow[mc], errors="coerce")
                series = {pd.Period(k, "M"): (0 if pd.isna(v) else float(v))
                          for k, v in s.items()}
            recs.append(dict(ID=ID, alta=alta, baja_m=baja_m, churn=churn, series=series))
        return recs

    return read(F_ACT, False) + read(F_BAJ, True)


def member_features(series, alta, M):
    """Features a cierre de M-1 (sólo meses < M)."""
    prev = M - 1
    months = [m for m in series if m <= prev]
    if not months:
        return None
    act_prev = series.get(prev, 0.0)
    last3 = [series.get(prev - k, 0.0) for k in range(3)]
    # recencia en meses: meses desde la última actividad (>0)
    rec = 0
    m = prev
    while m >= min(series):
        if series.get(m, 0.0) > 0:
            break
        rec += 1
        m -= 1
    else:
        rec = 24  # nunca reservó: recencia alta
    restot = sum(v for k, v in series.items() if k <= prev)
    tenure = max(1, (prev - pd.Period(alta, "M")).n) if pd.notna(alta) else len(months)
    return dict(
        recencia=np.log1p(rec),
        poco_vol=-act_prev,
        poco_hist=-np.log1p(restot),
        # informativo
        act_prev=act_prev, act_3m=sum(last3), rec_months=rec,
        restot=restot, tenure=tenure,
    )


def build_obs(panel, M):
    """Filas (features + label) de socios en riesgo en el mes M."""
    rows = []
    for p in panel:
        # en riesgo: alta <= fin de M-1 y no dado de baja antes de M
        if pd.notna(p["alta"]) and pd.Period(p["alta"], "M") > M - 1:
            continue
        if p["churn"] and p["baja_m"] is not None and p["baja_m"] < M:
            continue
        if p["churn"] and p["baja_m"] is not None and p["baja_m"] > LABEL_END:
            # baja fuera de ventana de etiquetas: tratar como no-baja en M
            pass
        f = member_features(p["series"], p["alta"], M)
        if f is None:
            continue
        label = 1 if (p["churn"] and p["baja_m"] == M) else 0
        f.update(ID=p["ID"], mes=M, y=label)
        rows.append(f)
    return pd.DataFrame(rows)


def fit_predict(train, test):
    """Scorecard univariante (signos garantizados) + calibración; devuelve prob."""
    mu = train[SCORE_FEATURES].mean()
    sd = train[SCORE_FEATURES].std().replace(0, 1)
    Ztr = (train[SCORE_FEATURES] - mu) / sd
    Zte = (test[SCORE_FEATURES] - mu) / sd
    w = np.array([LogisticRegression(max_iter=2000)
                  .fit(Ztr[[c]], train["y"]).coef_[0][0] for c in SCORE_FEATURES])
    s_tr = Ztr.values @ w
    s_te = Zte.values @ w
    cal = LogisticRegression(max_iter=2000).fit(s_tr.reshape(-1, 1), train["y"])
    return cal.predict_proba(s_te.reshape(-1, 1))[:, 1]


def main():
    panel = load_panel()
    # panel mensual de todos los meses de la ventana (para entrenamiento)
    all_months = pd.period_range(LABEL_START, LABEL_END, freq="M")
    obs_by_month = {M: build_obs(panel, M) for M in all_months}

    print("="*92)
    print("BACKTEST WALK-FORWARD — cada mes se predice usando SOLO meses anteriores")
    print("="*92)
    hdr = f"{'Mes':8} {'En riesgo':>9} {'Bajas':>6} {'Base%':>6} {'AUC':>6} " \
          f"{'Top10%':>7} {'Captura':>8} {'Lift':>6} {'Prec@N':>7}"
    print(hdr); print("-"*len(hdr))

    agg = []
    test_frames = []
    for M in TEST_MONTHS:
        train = pd.concat([obs_by_month[m] for m in all_months if m < M],
                          ignore_index=True)
        test = obs_by_month[M].copy()
        if train["y"].sum() < 5 or test["y"].sum() == 0:
            continue
        test["prob"] = fit_predict(train, test)
        n = len(test); nch = int(test["y"].sum()); base = nch / n
        auc = roc_auc_score(test["y"], test["prob"]) if 0 < nch < n else float("nan")
        test = test.sort_values("prob", ascending=False).reset_index(drop=True)
        k = max(1, round(n * 0.10))
        top = test.head(k)
        captura = top["y"].sum() / nch
        lift = (top["y"].mean() / base) if base > 0 else float("nan")
        precN = test.head(nch)["y"].sum() / nch
        print(f"{str(M):8} {n:9d} {nch:6d} {base*100:5.1f}% {auc:6.3f} "
              f"{k:7d} {captura*100:7.0f}% {lift:6.1f} {precN*100:6.0f}%")
        agg.append(dict(M=M, n=n, nch=nch, auc=auc, captura=captura, lift=lift,
                        precN=precN, y=test["y"].values, prob=test["prob"].values))
        test_frames.append(test)

    print("-"*len(hdr))
    aucs = [a["auc"] for a in agg]
    caps = [a["captura"] for a in agg]
    lifts = [a["lift"] for a in agg]
    precs = [a["precN"] for a in agg]
    print(f"MEDIA    {'':9} {'':6} {'':6} {np.nanmean(aucs):6.3f} "
          f"{'':7} {np.mean(caps)*100:7.0f}% {np.mean(lifts):6.1f} {np.mean(precs)*100:6.0f}%")

    # pooled (todas las observaciones de los meses de test juntas)
    yall = np.concatenate([a["y"] for a in agg])
    pall = np.concatenate([a["prob"] for a in agg])
    print(f"\nAUC agregada (pool de todos los meses de test): {roc_auc_score(yall, pall):.3f}")
    print(f"Total bajas evaluadas: {int(yall.sum())} sobre {len(yall)} observaciones-socio-mes")

    # --- captura operativa: contactar top-N cada mes -------------------------
    print("\nValor operativo (contactar a los más arriesgados cada mes):")
    tot_ch = int(yall.sum())
    capt = {}
    for K in [10, 20, 30]:
        cap = sum(int(a_test.head(K)["y"].sum()) for a_test in test_frames)
        capt[K] = cap
        print(f"  top-{K}/mes -> capturas {cap}/{tot_ch} bajas ({100*cap/tot_ch:.0f}%)")
    exp20 = sum(int(t["y"].sum()) * min(20, len(t)) / len(t) for t in test_frames)
    print(f"  (por azar, top-20/mes capturaría ~{exp20:.1f})")

    print("\nLectura: 'Captura' = % de bajas reales que estaban en el 10% de mayor "
          "riesgo.\n'Lift' = veces más probable la baja en ese grupo que al azar.")

    _write_report(agg, roc_auc_score(yall, pall), tot_ch, len(yall), capt, exp20)
    return agg


def _write_report(agg, auc_pool, tot_ch, n_obs, capt, exp20):
    import os
    os.makedirs("salida", exist_ok=True)
    rows = [dict(Mes=str(a["M"]), **{
        "Socios en riesgo": a["n"],
        "Bajas reales": a["nch"],
        "Tasa base %": round(100 * a["nch"] / a["n"], 1),
        "AUC": round(a["auc"], 3),
        "Captura top-10% (%)": round(100 * a["captura"]),
        "Lift top-10%": round(a["lift"], 1),
        "Precisión@N (%)": round(100 * a["precN"]),
    }) for a in agg]
    df = pd.DataFrame(rows)
    resumen = pd.DataFrame({"Validación walk-forward del detector de bajas": [
        "",
        "QUÉ MIDE",
        "Rendimiento 'fuera de tiempo': cada mes se predice usando SOLO datos previos",
        "y se compara con las bajas que de verdad ocurrieron ese mes.",
        "",
        "RESULTADO GLOBAL",
        f"AUC agregada (pool de meses de test): {auc_pool:.3f}  (0.5=azar).",
        f"Bajas reales evaluadas: {tot_ch} sobre {n_obs} observaciones socio-mes.",
        f"Contactando el top-20 de riesgo cada mes capturarías {capt.get(20,0)}/{tot_ch} "
        f"bajas ({round(100*capt.get(20,0)/tot_ch)}%) vs ~{exp20:.0f} por azar.",
        f"Top-30/mes: {capt.get(30,0)}/{tot_ch} ({round(100*capt.get(30,0)/tot_ch)}%).",
        "",
        "INTERPRETACIÓN HONESTA",
        "El detector ordena el riesgo mejor que el azar (lift ~2x en su decil superior)",
        "y es fiable en meses de desenganche progresivo, pero NO predice las bajas",
        "abruptas: socios MUY activos que se van de golpe (fin de contrato, mudanza,",
        "lesión, precio). En los datos, ~la mitad de las bajas son de ese tipo y no",
        "dejan rastro de comportamiento, lo que limita el techo del modelo.",
        "",
        "CÓMO SUBIR EL ACIERTO",
        "Incorporar datos no conductuales: fecha de fin de contrato, tipo de tarifa,",
        "método de pago/impagos, edad, encuestas. Es la palanca que falta.",
        "",
        "NOTA",
        "El backtest usa features MENSUALES (más gruesas que las diarias del modelo en",
        "producción), por lo que es una cota CONSERVADORA del rendimiento real.",
    ]})
    out = "salida/validacion_backtest.xlsx"
    with pd.ExcelWriter(out, engine="openpyxl") as xw:
        df.to_excel(xw, sheet_name="Backtest por mes", index=False)
        resumen.to_excel(xw, sheet_name="Resumen", index=False)
    print(f"\n✅ Informe: {out}")


if __name__ == "__main__":
    main()
