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
const roundMoney = (v) => Math.round((Number(v) || 0) * 100) / 100;
const money = (v) => moneyFormatter.format(Number(v) || 0);
const number = (v) => numberFormatter.format(Number(v) || 0);
const mesISO = (fecha) => fecha.slice(0, 7);
const anioISO = (fecha) => fecha.slice(0, 4);
const monthLabel = (fecha) =>
  new Intl.DateTimeFormat("es-MX", { month: "short" }).format(
    new Date(`${fecha.slice(0, 7)}-01T00:00:00`)
  );

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
        setMsg({ tipo: "error", texto: "No se pudo cargar el resumen." })
      );
  }, [fecha]);

  useEffect(() => {
    setHistoricoMsg(null);
    api
      .dashboardHistorico({ periodo, mes, anio })
      .then(setHistorico)
      .catch(() =>
        setHistoricoMsg({ tipo: "error", texto: "No se pudo cargar el historial." })
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
  const puntosHistorico =
    periodo === "anio"
      ? Object.values(
          diasHistorico.reduce((acc, dia) => {
            const mesKey = dia.fecha.slice(0, 7);
            const item = acc[mesKey] ?? {
              fecha: mesKey,
              etiqueta: monthLabel(mesKey),
              total: 0,
              venta_total: 0,
              ganancia_neta: 0,
              por_sabor: [],
            };
            const porSabor = new Map(item.por_sabor.map((s) => [s.receta, s]));
            dia.por_sabor.forEach((sabor) => {
              const actual = porSabor.get(sabor.receta) ?? {
                receta: sabor.receta,
                costo_total: 0,
              };
              actual.costo_total += sabor.costo_total;
              porSabor.set(sabor.receta, actual);
            });
            item.total += dia.total;
            item.venta_total += dia.venta_total;
            item.ganancia_neta = item.venta_total - item.total;
            item.por_sabor = [...porSabor.values()];
            acc[mesKey] = item;
            return acc;
          }, {})
        ).map((item) => ({
          ...item,
          total: roundMoney(item.total),
          venta_total: roundMoney(item.venta_total),
          ganancia_neta: roundMoney(item.ganancia_neta),
          por_sabor: item.por_sabor.map((sabor) => ({
            ...sabor,
            costo_total: roundMoney(sabor.costo_total),
          })),
        }))
      : diasHistorico.map((dia) => ({ ...dia, etiqueta: dia.fecha }));
  const fechasHistorico = puntosHistorico.map((d) => d.etiqueta);
  const totalHistorico = historico?.total_periodo ?? historico?.total_mes ?? 0;
  const ventaHistorico = historico?.venta_periodo ?? 0;
  const gananciaHistorico = historico?.ganancia_periodo ?? 0;
  const promedioPeriodo = puntosHistorico.length > 0 ? totalHistorico / puntosHistorico.length : 0;
  const puntoMayor = puntosHistorico.reduce(
    (max, dia) => (dia.total > (max?.total ?? -Infinity) ? dia : max),
    null
  );
  const vistaPeriodo = periodo === "anio" ? "anual" : "mensual";
  const unidadPeriodo = periodo === "anio" ? "mensual" : "diaria";
  const tracesHistorico = historico
    ? [
        {
          type: "scatter",
          mode: "lines+markers",
          name: periodo === "anio" ? "Total mensual" : "Total diario",
          x: fechasHistorico,
          y: puntosHistorico.map((dia) => dia.total),
          line: { color: "#0f8ec7", width: 4, shape: "spline", smoothing: 0.55 },
          marker: {
            color: "#0f8ec7",
            size: periodo === "anio" ? 4 : 7,
            line: { color: "#ffffff", width: 1 },
          },
          hovertemplate:
            (periodo === "anio" ? "Total mensual" : "Total diario") +
            "<br>%{x}<br>%{y:$,.2f}<extra></extra>",
        },
        ...historico.sabores.map((sabor, idx) => ({
          type: "scatter",
          mode: "lines+markers",
          name: sabor,
          x: fechasHistorico,
          y: puntosHistorico.map((dia) => {
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
          y: puntosHistorico.map((dia) => dia.total),
          line: { color: "#0f8ec7", width: 3, shape: "spline", smoothing: 0.45 },
          marker: { color: "#0f8ec7", size: periodo === "anio" ? 4 : 7 },
          hovertemplate: "Inversión<br>%{x}<br>%{y:$,.2f}<extra></extra>",
        },
        {
          type: "scatter",
          mode: "lines+markers",
          name: "Utilidad",
          x: fechasHistorico,
          y: puntosHistorico.map((dia) => dia.ganancia_neta),
          line: { color: "#2e9d4d", width: 3, shape: "spline", smoothing: 0.45 },
          marker: { color: "#2e9d4d", size: periodo === "anio" ? 4 : 7 },
          hovertemplate: "Utilidad<br>%{x}<br>%{y:$,.2f}<extra></extra>",
        },
      ]
    : [];

  function guardarVentaDia() {
    if (fecha > hoy) {
      setVentaMsg({ tipo: "error", texto: "La fecha no puede ser futura." });
      return;
    }
    const venta = Number(ventaDia) || 0;
    if (venta < 0) {
      setVentaMsg({ tipo: "error", texto: "La venta no puede ser negativa." });
      return;
    }
    setGuardandoVenta(true);
    api
      .guardarVentaDia(fecha, venta)
      .then((res) => {
        setData((prev) => ({ ...prev, ...res, total: res.inversion_total }));
        setVentaDia(res.venta_total || "");
        setVentaMsg({ tipo: "ok", texto: "Venta guardada." });
        return api.dashboardHistorico({ periodo, mes, anio });
      })
      .then(setHistorico)
      .catch(() => setVentaMsg({ tipo: "error", texto: "No se pudo guardar." }))
      .finally(() => setGuardandoVenta(false));
  }

  function renderPeriodControls() {
    return (
      <div className="chart-controls">
        <div className="segmented-control" aria-label="Periodo">
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
          <h2>Resumen</h2>
          <p className="muted">Costos y venta del día.</p>
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
              <strong>Hay costos en cero. Revisa recetas o precios.</strong>
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
              <span className="metric-label">Inversión del día</span>
              <span className="metric-value">{money(data.total)}</span>
              <span className="metric-note">{money(costoPromedioAgua)} por agua</span>
            </div>
            <div className="metric">
              <span className="metric-label">Sabores</span>
              <span className="metric-value">{number(data.por_sabor.length)}</span>
              <span className="metric-note">con producción</span>
            </div>
            <div className="metric">
              <span className="metric-label">Aguas totales</span>
              <span className="metric-value">{number(aguasTotales)}</span>
              <span className="metric-note">capturadas</span>
            </div>
            <div className="metric">
              <span className="metric-label">Costo promedio</span>
              <span className="metric-value">{money(costoPromedioAgua)}</span>
              <span className="metric-note">por agua</span>
            </div>
            <div className="metric metric-profit">
              <span className="metric-label">Utilidad</span>
              <span className="metric-value">{money(gananciaNeta)}</span>
            </div>
          </div>

          <div className="card profit-card">
            <div>
              <h3>Venta del día</h3>
              <p className="muted">Ingresa la venta total. La utilidad se calcula sola.</p>
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
                <span>Utilidad</span>
                <strong>{money((Number(ventaDia) || 0) - (data.total || 0))}</strong>
              </div>
              <button className="btn primary" onClick={guardarVentaDia} disabled={guardandoVenta}>
                {guardandoVenta ? "Guardando..." : "Guardar"}
              </button>
            </div>
            {ventaMsg && <div className={"msg " + ventaMsg.tipo}>{ventaMsg.texto}</div>}
          </div>

          <div className="card table-card">
            <div className="card-title-row compact">
              <h3>Costos por sabor</h3>
              <span className="muted">{fecha}</span>
            </div>
            {data.por_sabor.length === 0 ? (
              <p className="muted" style={{ padding: "10px 4px" }}>
                No hay producción para esta fecha.
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
                <h3>Inversión y utilidad</h3>
                <p className="muted">Inversión contra utilidad {unidadPeriodo}.</p>
              </div>
              {renderPeriodControls()}
            </div>

            {!historico ? (
              <p className="muted chart-empty">Cargando historial...</p>
            ) : puntosHistorico.length === 0 ? (
              <p className="muted chart-empty">No hay datos en este periodo.</p>
            ) : (
              <Plot
                data={tracesGanancia}
                layout={{
                  autosize: true,
                  height: 330,
                  margin: { l: 78, r: 26, t: 42, b: 70 },
                  title: {
                    text: `Inversión y utilidad ${vistaPeriodo} · ${periodo === "anio" ? anio : mes}`,
                    x: 0.5,
                    xanchor: "center",
                    font: { size: 16, color: darkMode ? "#e8f4f7" : "#211e18" },
                  },
                  plot_bgcolor: darkMode ? "#0f2735" : "#ffffff",
                  paper_bgcolor: darkMode ? "#0f2735" : "#ffffff",
                  font: {
                    family: "Inter, system-ui, sans-serif",
                    size: 12,
                    color: darkMode ? "#e8f4f7" : "#211e18",
                  },
                  xaxis: {
                    title: { text: periodo === "anio" ? "Mes" : "Fecha", font: { size: 12, color: darkMode ? "#e8f4f7" : "#211e18" } },
                    type: "category",
                    tickangle: periodo === "anio" ? 0 : -35,
                    nticks: periodo === "anio" ? 12 : 12,
                    showgrid: true,
                    gridcolor: darkMode ? "rgba(197, 231, 240, 0.12)" : "rgba(7, 50, 74, 0.1)",
                    zeroline: false,
                    linecolor: darkMode ? "rgba(197, 231, 240, 0.24)" : "rgba(33, 30, 24, 0.18)",
                  },
                  yaxis: {
                    title: { text: "Monto", font: { size: 12, color: darkMode ? "#e8f4f7" : "#211e18" } },
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

            {historico && puntosHistorico.length > 0 && (
              <div className="chart-summary metric-strip">
                <span className="summary-pill">
                  Inversión <strong>{money(totalHistorico)}</strong>
                </span>
                <span className="summary-pill">
                  Venta <strong>{money(ventaHistorico)}</strong>
                </span>
                <span className="summary-pill">
                  Utilidad <strong>{money(gananciaHistorico)}</strong>
                </span>
              </div>
            )}
          </div>

          <div className="card chart-card">
            <div className="card-title-row">
              <div>
                <h3>Historial {vistaPeriodo}</h3>
                <p className="muted">Inversión {unidadPeriodo} por periodo.</p>
              </div>
              {renderPeriodControls()}
            </div>

            {historicoMsg && (
              <div className={"msg " + historicoMsg.tipo}>{historicoMsg.texto}</div>
            )}

            {!historico ? (
              <p className="muted chart-empty">Cargando historial...</p>
            ) : puntosHistorico.length === 0 ? (
              <p className="muted chart-empty">
                No hay producción en este {periodo === "anio" ? "año" : "mes"}.
              </p>
            ) : (
              <Plot
                data={tracesHistorico}
                layout={{
                  autosize: true,
                  height: 360,
                  margin: { l: 78, r: 26, t: 56, b: 74 },
                  title: {
                    text: `Inversión ${unidadPeriodo} · ${periodo === "anio" ? anio : mes}`,
                    x: 0.5,
                    xanchor: "center",
                    font: { size: 16, color: darkMode ? "#e8f4f7" : "#211e18" },
                  },
                  plot_bgcolor: darkMode ? "#0f2735" : "#ffffff",
                  paper_bgcolor: darkMode ? "#0f2735" : "#ffffff",
                  font: {
                    family: "Inter, system-ui, sans-serif",
                    size: 12,
                    color: darkMode ? "#e8f4f7" : "#211e18",
                  },
                  xaxis: {
                    title: { text: periodo === "anio" ? "Mes" : "Fecha", font: { size: 12, color: darkMode ? "#e8f4f7" : "#211e18" } },
                    type: "category",
                    tickangle: periodo === "anio" ? 0 : -35,
                    nticks: periodo === "anio" ? 12 : 12,
                    showgrid: true,
                    gridcolor: darkMode ? "rgba(197, 231, 240, 0.12)" : "rgba(7, 50, 74, 0.1)",
                    zeroline: false,
                    linecolor: darkMode ? "rgba(197, 231, 240, 0.24)" : "rgba(33, 30, 24, 0.18)",
                  },
                  yaxis: {
                    title: { text: "Inversión", font: { size: 12, color: darkMode ? "#e8f4f7" : "#211e18" } },
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

            {historico && puntosHistorico.length > 0 && (
              <div className="chart-summary metric-strip">
                <span className="summary-pill">
                  Total del {periodo === "anio" ? "año" : "mes"}{" "}
                  <strong>{money(totalHistorico)}</strong>
                </span>
                <span className="summary-pill">
                  Promedio {periodo === "anio" ? "mensual" : "diario"} <strong>{money(promedioPeriodo)}</strong>
                </span>
                <span className="summary-pill">
                  {periodo === "anio" ? "Meses" : "Días"} con producción <strong>{number(puntosHistorico.length)}</strong>
                </span>
                {puntoMayor && (
                  <span className="summary-pill">
                    {periodo === "anio" ? "Mes más alto" : "Día más alto"}{" "}
                    <strong>{puntoMayor.etiqueta} · {money(puntoMayor.total)}</strong>
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
