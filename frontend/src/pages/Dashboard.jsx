import React, { useEffect, useState } from "react";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-basic-dist-min";
import { api } from "../api.js";

const Plot = createPlotlyComponent(Plotly);
const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const numberFormatter = new Intl.NumberFormat("en-US");
const money = (v) => moneyFormatter.format(Number(v) || 0);
const number = (v) => numberFormatter.format(Number(v) || 0);
const hoyISO = () => new Date().toISOString().slice(0, 10);
const mesISO = (fecha) => fecha.slice(0, 7);
const anioISO = (fecha) => fecha.slice(0, 4);

const flavorColors = {
  limón: "#2e9d4d",
  limon: "#2e9d4d",
  horchata: "#8b5e3c",
  maracuya: "#f3b51b",
  maracuyá: "#f3b51b",
  jamaica: "#c73547",
};
const fallbackChartColors = ["#0f8ec7", "#5d7887", "#805ad5", "#147d73"];

function normalizeFlavorName(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function colorForFlavor(name, idx = 0) {
  return flavorColors[normalizeFlavorName(name)] || fallbackChartColors[idx % fallbackChartColors.length];
}

export default function Dashboard() {
  const [fecha, setFecha] = useState(hoyISO());
  const [periodo, setPeriodo] = useState("mes");
  const [mes, setMes] = useState(mesISO(hoyISO()));
  const [anio, setAnio] = useState(anioISO(hoyISO()));
  const [data, setData] = useState(null);
  const [historico, setHistorico] = useState(null);
  const [msg, setMsg] = useState(null);
  const [historicoMsg, setHistoricoMsg] = useState(null);

  useEffect(() => {
    setMsg(null);
    api
      .dashboard(fecha)
      .then(setData)
      .catch(() =>
        setMsg({ tipo: "error", texto: "No se pudo cargar el dashboard." })
      );
  }, [fecha]);

  useEffect(() => {
    setHistoricoMsg(null);
    api
      .dashboardHistorico({ periodo, mes, anio })
      .then(setHistorico)
      .catch(() =>
        setHistoricoMsg({ tipo: "error", texto: "No se pudo cargar el histórico." })
      );
  }, [periodo, mes, anio]);

  const llenadorasTotales = data
    ? data.por_sabor.reduce((a, s) => a + (s.llenadoras ?? s.vasos), 0)
    : 0;

  const aguasTotales = data
    ? data.por_sabor.reduce((a, s) => a + (s.aguas ?? 0), 0)
    : 0;
  const costoPromedioAgua = aguasTotales > 0 ? data.total / aguasTotales : 0;

  const diasHistorico = historico?.dias ?? [];
  const fechasHistorico = diasHistorico.map((d) => d.fecha);
  const totalHistorico = historico?.total_periodo ?? historico?.total_mes ?? 0;
  const promedioDiario = diasHistorico.length > 0 ? totalHistorico / diasHistorico.length : 0;
  const diaMayor = diasHistorico.reduce(
    (max, dia) => (dia.total > (max?.total ?? -Infinity) ? dia : max),
    null
  );
  const tracesHistorico = historico
    ? [
        {
          type: "scatter",
          mode: "lines+markers",
          name: "Total diario",
          x: fechasHistorico,
          y: diasHistorico.map((dia) => dia.total),
          line: { color: "#0f8ec7", width: 4, shape: "spline", smoothing: 0.55 },
          marker: {
            color: "#0f8ec7",
            size: periodo === "anio" ? 4 : 7,
            line: { color: "#ffffff", width: 1 },
          },
          hovertemplate: "Total diario<br>%{x}<br>%{y:$,.2f}<extra></extra>",
        },
        ...historico.sabores.map((sabor, idx) => ({
          type: "scatter",
          mode: "lines+markers",
          name: sabor,
          x: fechasHistorico,
          y: diasHistorico.map((dia) => {
            const item = dia.por_sabor.find((s) => s.receta === sabor);
            return item ? item.costo_total : 0;
          }),
          line: { color: colorForFlavor(sabor, idx), width: 2 },
          marker: { color: colorForFlavor(sabor, idx), size: periodo === "anio" ? 3 : 5 },
          hovertemplate: `${sabor}<br>%{x}<br>%{y:$,.2f}<extra></extra>`,
        })),
      ]
    : [];

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>Dashboard</h2>
          <p className="muted">Costo del día por sabor.</p>
        </div>
        <label className="date-field">
          Fecha
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </label>
      </div>

      {msg && <div className={"msg " + msg.tipo}>{msg.texto}</div>}

      {data && (
        <>
          {data.advertencias?.length > 0 && (
            <div className="msg warn">
              <strong>El costo está en $0.00 porque faltan datos de receta o precios.</strong>
              <ul className="warning-list">
                {data.advertencias.slice(0, 8).map((texto, idx) => (
                  <li key={idx}>{texto}</li>
                ))}
              </ul>
              {data.advertencias.length > 8 && (
                <p>Hay {data.advertencias.length - 8} aviso(s) más.</p>
              )}
            </div>
          )}

          <div className="metrics">
            <div className="metric metric-primary">
              <span className="metric-label">Inversión total del día</span>
              <span className="metric-value">{money(data.total)}</span>
              <span className="metric-note">{money(costoPromedioAgua)} por agua</span>
            </div>
            <div className="metric">
              <span className="metric-label">Sabores producidos</span>
              <span className="metric-value">{number(data.por_sabor.length)}</span>
              <span className="metric-note">recetas activas capturadas</span>
            </div>
            <div className="metric">
              <span className="metric-label">Llenadoras totales</span>
              <span className="metric-value">{number(llenadorasTotales)}</span>
              <span className="metric-note">producción registrada</span>
            </div>
            <div className="metric">
              <span className="metric-label">Aguas totales</span>
              <span className="metric-value">{number(aguasTotales)}</span>
              <span className="metric-note">rendimiento estimado</span>
            </div>
          </div>

          <div className="card table-card">
            <div className="card-title-row compact">
              <h3>Detalle por sabor</h3>
              <span className="muted">{fecha}</span>
            </div>
            {data.por_sabor.length === 0 ? (
              <p className="muted" style={{ padding: "10px 4px" }}>
                No hay producción registrada para esta fecha.
              </p>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Sabor</th>
                    <th className="right">Llenadoras</th>
                    <th className="right">Aguas</th>
                    <th className="right">Costo/agua</th>
                    <th className="right">Costo total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.por_sabor.map((s, idx) => (
                    <tr key={idx}>
                      <td>
                        <span className="flavor-name">
                          <span
                            className="flavor-dot"
                            style={{ background: colorForFlavor(s.receta, idx) }}
                          />
                          {s.receta}
                        </span>
                      </td>
                      <td className="right">{number(s.llenadoras ?? s.vasos)}</td>
                      <td className="right">{number(s.aguas ?? 0)}</td>
                      <td className="right">{money(s.costo_por_agua ?? s.costo_por_vaso)}</td>
                      <td className="right">{money(s.costo_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card chart-card">
            <div className="card-title-row">
              <div>
                <h3>Histórico {periodo === "anio" ? "anual" : "mensual"}</h3>
                <p className="muted">Tendencia diaria de inversión total. Activa sabores desde la leyenda.</p>
              </div>
              <div className="chart-controls">
                <div className="segmented-control" aria-label="Periodo histórico">
                  <button
                    type="button"
                    className={periodo === "mes" ? "active" : ""}
                    onClick={() => setPeriodo("mes")}
                  >
                    Mes
                  </button>
                  <button
                    type="button"
                    className={periodo === "anio" ? "active" : ""}
                    onClick={() => setPeriodo("anio")}
                  >
                    Año
                  </button>
                </div>
                {periodo === "anio" ? (
                  <label className="date-field">
                    Año
                    <input
                      type="number"
                      min="2000"
                      max="2100"
                      step="1"
                      value={anio}
                      onChange={(e) => setAnio(e.target.value)}
                    />
                  </label>
                ) : (
                  <label className="date-field">
                    Mes
                    <input
                      type="month"
                      value={mes}
                      onChange={(e) => setMes(e.target.value)}
                    />
                  </label>
                )}
              </div>
            </div>

            {historicoMsg && (
              <div className={"msg " + historicoMsg.tipo}>{historicoMsg.texto}</div>
            )}

            {!historico ? (
              <p className="muted chart-empty">Cargando histórico...</p>
            ) : diasHistorico.length === 0 ? (
              <p className="muted chart-empty">
                No hay producción registrada para este {periodo === "anio" ? "año" : "mes"}.
              </p>
            ) : (
              <Plot
                data={tracesHistorico}
                layout={{
                  autosize: true,
                  height: 430,
                  margin: { l: 78, r: 26, t: 56, b: 74 },
                  title: {
                    text: `Historial de inversión diaria · ${periodo === "anio" ? anio : mes}`,
                    x: 0.5,
                    xanchor: "center",
                    font: { size: 22, color: "#211e18" },
                  },
                  paper_bgcolor: "#ffffff",
                  plot_bgcolor: "#ffffff",
                  font: {
                    family: "DM Sans, system-ui, sans-serif",
                    color: "#211e18",
                  },
                  xaxis: {
                    title: { text: "Fecha", font: { size: 18 } },
                    type: "category",
                    tickangle: -35,
                    nticks: periodo === "anio" ? 14 : 12,
                    showgrid: true,
                    gridcolor: "rgba(7, 50, 74, 0.1)",
                    zeroline: false,
                    linecolor: "rgba(33, 30, 24, 0.18)",
                  },
                  yaxis: {
                    title: { text: "Inversión", font: { size: 18 } },
                    tickprefix: "$",
                    separatethousands: true,
                    showgrid: true,
                    gridcolor: "rgba(7, 50, 74, 0.1)",
                    zeroline: false,
                    linecolor: "rgba(33, 30, 24, 0.18)",
                  },
                  legend: {
                    orientation: "h",
                    y: -0.32,
                    x: 0,
                  },
                  hovermode: "x unified",
                }}
                config={{ displayModeBar: false, responsive: true }}
                useResizeHandler
                className="history-chart"
              />
            )}

            {historico && diasHistorico.length > 0 && (
              <div className="chart-summary metric-strip">
                <span className="summary-pill">
                  Total del {periodo === "anio" ? "año" : "mes"}{" "}
                  <strong>{money(totalHistorico)}</strong>
                </span>
                <span className="summary-pill">
                  Promedio diario <strong>{money(promedioDiario)}</strong>
                </span>
                <span className="summary-pill">
                  Días con producción <strong>{number(diasHistorico.length)}</strong>
                </span>
                {diaMayor && (
                  <span className="summary-pill">
                    Día más alto <strong>{diaMayor.fecha} · {money(diaMayor.total)}</strong>
                  </span>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
