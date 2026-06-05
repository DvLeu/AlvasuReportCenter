import React, { useEffect, useState } from "react";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-basic-dist-min";
import { api } from "../api.js";
import { hoyISO } from "../date.js";

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

export default function Dashboard({ theme = "light" }) {
  const darkMode = theme === "dark";
  const hoy = hoyISO();
  const mesActual = mesISO(hoy);
  const anioActual = anioISO(hoy);
  const [fecha, setFecha] = useState(hoyISO());
  const [periodo, setPeriodo] = useState("mes");
  const [mes, setMes] = useState(mesISO(hoyISO()));
  const [anio, setAnio] = useState(anioISO(hoyISO()));
  const [data, setData] = useState(null);
  const [historico, setHistorico] = useState(null);
  const [ventaDia, setVentaDia] = useState("");
  const [guardandoVenta, setGuardandoVenta] = useState(false);
  const [msg, setMsg] = useState(null);
  const [historicoMsg, setHistoricoMsg] = useState(null);
  const [ventaMsg, setVentaMsg] = useState(null);

  useEffect(() => {
    setMsg(null);
    api
      .dashboard(fecha)
      .then((d) => {
        setData(d);
        setVentaDia(d.venta_total || "");
        setVentaMsg(null);
      })
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

  useEffect(() => {
    if (!msg) return undefined;
    const timer = setTimeout(() => setMsg(null), 3500);
    return () => clearTimeout(timer);
  }, [msg]);

  useEffect(() => {
    if (!ventaMsg) return undefined;
    const timer = setTimeout(() => setVentaMsg(null), 3500);
    return () => clearTimeout(timer);
  }, [ventaMsg]);

  useEffect(() => {
    if (!historicoMsg) return undefined;
    const timer = setTimeout(() => setHistoricoMsg(null), 3500);
    return () => clearTimeout(timer);
  }, [historicoMsg]);

  const aguasTotales = data
    ? data.por_sabor.reduce((a, s) => a + (s.aguas ?? 0), 0)
    : 0;
  const costoPromedioAgua = aguasTotales > 0 ? data.total / aguasTotales : 0;
  const gananciaNeta = data?.ganancia_neta ?? 0;

  const diasHistorico = historico?.dias ?? [];
  const fechasHistorico = diasHistorico.map((d) => d.fecha);
  const totalHistorico = historico?.total_periodo ?? historico?.total_mes ?? 0;
  const ventaHistorico = historico?.venta_periodo ?? 0;
  const gananciaHistorico = historico?.ganancia_periodo ?? 0;
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
  const tracesGanancia = historico
    ? [
        {
          type: "scatter",
          mode: "lines+markers",
          name: "Inversión",
          x: fechasHistorico,
          y: diasHistorico.map((dia) => dia.total),
          line: { color: "#0f8ec7", width: 3, shape: "spline", smoothing: 0.45 },
          marker: { color: "#0f8ec7", size: periodo === "anio" ? 4 : 7 },
          hovertemplate: "Inversión<br>%{x}<br>%{y:$,.2f}<extra></extra>",
        },
        {
          type: "scatter",
          mode: "lines+markers",
          name: "Ganancia neta",
          x: fechasHistorico,
          y: diasHistorico.map((dia) => dia.ganancia_neta),
          line: { color: "#2e9d4d", width: 3, shape: "spline", smoothing: 0.45 },
          marker: { color: "#2e9d4d", size: periodo === "anio" ? 4 : 7 },
          hovertemplate: "Ganancia neta<br>%{x}<br>%{y:$,.2f}<extra></extra>",
        },
      ]
    : [];

  function guardarVentaDia() {
    if (fecha > hoy) {
      setVentaMsg({ tipo: "error", texto: "No se puede guardar una venta en fecha futura." });
      return;
    }
    const venta = Number(ventaDia) || 0;
    if (venta < 0) {
      setVentaMsg({ tipo: "error", texto: "La venta del día no puede ser negativa." });
      return;
    }
    setGuardandoVenta(true);
    api
      .guardarVentaDia(fecha, venta)
      .then((res) => {
        setData((prev) => ({ ...prev, ...res, total: res.inversion_total }));
        setVentaDia(res.venta_total || "");
        setVentaMsg({ tipo: "ok", texto: "Venta del día guardada." });
        return api.dashboardHistorico({ periodo, mes, anio });
      })
      .then(setHistorico)
      .catch(() => setVentaMsg({ tipo: "error", texto: "No se pudo guardar la venta." }))
      .finally(() => setGuardandoVenta(false));
  }

  function renderPeriodControls() {
    return (
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
              max={anioActual}
              step="1"
              value={anio}
              onChange={(e) => {
                const value = e.target.value;
                setAnio(value && Number(value) > Number(anioActual) ? anioActual : value);
              }}
            />
          </label>
        ) : (
          <label className="date-field">
            Mes
            <input
              type="month"
              value={mes}
              max={mesActual}
              onChange={(e) => setMes(e.target.value > mesActual ? mesActual : e.target.value)}
            />
          </label>
        )}
      </div>
    );
  }

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
            max={hoy}
            onChange={(e) => setFecha(e.target.value > hoy ? hoy : e.target.value)}
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
              <span className="metric-label">Aguas totales</span>
              <span className="metric-value">{number(aguasTotales)}</span>
              <span className="metric-note">cantidad capturada</span>
            </div>
            <div className="metric">
              <span className="metric-label">Costo promedio</span>
              <span className="metric-value">{money(costoPromedioAgua)}</span>
              <span className="metric-note">por agua preparada</span>
            </div>
            <div className="metric metric-profit">
              <span className="metric-label">Ganancia neta</span>
              <span className="metric-value">{money(gananciaNeta)}</span>
            </div>
          </div>

          <div className="card profit-card">
            <div>
              <h3>Ganancia del día</h3>
              <p className="muted">Captura la venta total del día para restar la inversión calculada.</p>
            </div>
            <div className="profit-form">
              <label>
                Venta del día
                <span>
                  <strong>$</strong>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={ventaDia}
                    onChange={(e) => setVentaDia(e.target.value)}
                    placeholder="0.00"
                  />
                </span>
              </label>
              <div className="profit-result">
                <span>Ganancia neta</span>
                <strong>{money((Number(ventaDia) || 0) - (data.total || 0))}</strong>
              </div>
              <button className="btn primary" onClick={guardarVentaDia} disabled={guardandoVenta}>
                {guardandoVenta ? "Guardando..." : "Guardar venta"}
              </button>
            </div>
            {ventaMsg && <div className={"msg " + ventaMsg.tipo}>{ventaMsg.texto}</div>}
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
                <h3>Inversión vs ganancia</h3>
                <p className="muted">Comparativo diario entre costo invertido y ganancia neta.</p>
              </div>
              {renderPeriodControls()}
            </div>

            {!historico ? (
              <p className="muted chart-empty">Cargando histórico...</p>
            ) : diasHistorico.length === 0 ? (
              <p className="muted chart-empty">No hay datos para comparar en este periodo.</p>
            ) : (
              <Plot
                data={tracesGanancia}
                layout={{
                  autosize: true,
                  height: 360,
                  margin: { l: 78, r: 26, t: 42, b: 70 },
                  title: {
                    text: `Inversión vs ganancia · ${periodo === "anio" ? anio : mes}`,
                    x: 0.5,
                    xanchor: "center",
                    font: { size: 20, color: darkMode ? "#e8f4f7" : "#211e18" },
                  },
                  plot_bgcolor: darkMode ? "#0f2735" : "#ffffff",
                  paper_bgcolor: darkMode ? "#0f2735" : "#ffffff",
                  font: {
                    family: "DM Sans, system-ui, sans-serif",
                    color: darkMode ? "#e8f4f7" : "#211e18",
                  },
                  xaxis: {
                    title: { text: "Fecha", font: { size: 16, color: darkMode ? "#e8f4f7" : "#211e18" } },
                    type: "category",
                    tickangle: -35,
                    nticks: periodo === "anio" ? 14 : 12,
                    showgrid: true,
                    gridcolor: darkMode ? "rgba(197, 231, 240, 0.12)" : "rgba(7, 50, 74, 0.1)",
                    zeroline: false,
                    linecolor: darkMode ? "rgba(197, 231, 240, 0.24)" : "rgba(33, 30, 24, 0.18)",
                  },
                  yaxis: {
                    title: { text: "Monto", font: { size: 16, color: darkMode ? "#e8f4f7" : "#211e18" } },
                    tickprefix: "$",
                    separatethousands: true,
                    showgrid: true,
                    gridcolor: darkMode ? "rgba(197, 231, 240, 0.12)" : "rgba(7, 50, 74, 0.1)",
                    zeroline: true,
                    zerolinecolor: darkMode ? "rgba(197, 231, 240, 0.34)" : "rgba(33, 30, 24, 0.26)",
                    linecolor: darkMode ? "rgba(197, 231, 240, 0.24)" : "rgba(33, 30, 24, 0.18)",
                  },
                  legend: { orientation: "h", y: -0.32, x: 0 },
                  hovermode: "x unified",
                }}
                config={{ displayModeBar: false, responsive: true }}
                useResizeHandler
                className="history-chart profit-chart"
              />
            )}

            {historico && diasHistorico.length > 0 && (
              <div className="chart-summary metric-strip">
                <span className="summary-pill">
                  Inversión <strong>{money(totalHistorico)}</strong>
                </span>
                <span className="summary-pill">
                  Venta <strong>{money(ventaHistorico)}</strong>
                </span>
                <span className="summary-pill">
                  Ganancia <strong>{money(gananciaHistorico)}</strong>
                </span>
              </div>
            )}
          </div>

          <div className="card chart-card">
            <div className="card-title-row">
              <div>
                <h3>Histórico {periodo === "anio" ? "anual" : "mensual"}</h3>
                <p className="muted">Tendencia diaria de inversión total. Activa sabores desde la leyenda.</p>
              </div>
              {renderPeriodControls()}
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
                    font: { size: 22, color: darkMode ? "#e8f4f7" : "#211e18" },
                  },
                  plot_bgcolor: darkMode ? "#0f2735" : "#ffffff",
                  paper_bgcolor: darkMode ? "#0f2735" : "#ffffff",
                  font: {
                    family: "DM Sans, system-ui, sans-serif",
                    color: darkMode ? "#e8f4f7" : "#211e18",
                  },
                  xaxis: {
                    title: { text: "Fecha", font: { size: 18, color: darkMode ? "#e8f4f7" : "#211e18" } },
                    type: "category",
                    tickangle: -35,
                    nticks: periodo === "anio" ? 14 : 12,
                    showgrid: true,
                    gridcolor: darkMode ? "rgba(197, 231, 240, 0.12)" : "rgba(7, 50, 74, 0.1)",
                    zeroline: false,
                    linecolor: darkMode ? "rgba(197, 231, 240, 0.24)" : "rgba(33, 30, 24, 0.18)",
                  },
                  yaxis: {
                    title: { text: "Inversión", font: { size: 18, color: darkMode ? "#e8f4f7" : "#211e18" } },
                    tickprefix: "$",
                    separatethousands: true,
                    showgrid: true,
                    gridcolor: darkMode ? "rgba(197, 231, 240, 0.12)" : "rgba(7, 50, 74, 0.1)",
                    zeroline: false,
                    linecolor: darkMode ? "rgba(197, 231, 240, 0.24)" : "rgba(33, 30, 24, 0.18)",
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
