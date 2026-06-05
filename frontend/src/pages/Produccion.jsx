import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { hoyISO } from "../date.js";

const money = (v) => "$" + Number(v).toFixed(2);

export default function Produccion() {
  const [recetas, setRecetas] = useState([]);
  const [aguas, setAguas] = useState({});
  const [fecha, setFecha] = useState(hoyISO());
  const [resultado, setResultado] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api
      .recetas()
      .then(setRecetas)
      .catch(() =>
        setMsg({ tipo: "error", texto: "No se pudieron cargar los sabores." })
      );
  }, []);

  useEffect(() => {
    if (!msg) return undefined;
    const timer = setTimeout(() => setMsg(null), 3500);
    return () => clearTimeout(timer);
  }, [msg]);

  function registrar() {
    if (fecha > hoyISO()) {
      setMsg({ tipo: "error", texto: "La fecha no puede ser futura." });
      return;
    }
    const items = recetas
      .map((r) => ({ receta_id: r.id, aguas: Number(aguas[r.id]) || 0 }))
      .filter((it) => it.aguas > 0);
    if (items.length === 0) {
      setMsg({ tipo: "info", texto: "Captura al menos una cantidad." });
      return;
    }
    api
      .registrarProduccion(fecha, items)
      .then((d) => {
        setResultado(d);
        setMsg({ tipo: "ok", texto: "Producción guardada." });
      })
      .catch(() => setMsg({ tipo: "error", texto: "No se pudo guardar." }));
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>Producción</h2>
          <p className="muted">Aguas preparadas por sabor.</p>
        </div>
        <label className="date-field">
          Fecha
          <input
            type="date"
            value={fecha}
            max={hoyISO()}
            onChange={(e) => setFecha(e.target.value > hoyISO() ? hoyISO() : e.target.value)}
          />
        </label>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Sabor</th>
              <th>Rendimiento</th>
              <th className="right">Aguas</th>
            </tr>
          </thead>
          <tbody>
            {recetas.map((r) => (
              <tr key={r.id}>
                <td>{r.nombre}</td>
                <td className="muted">1 llenadora = {r.rendimiento_aguas ?? r.rendimiento_vasos} aguas</td>
                <td className="right">
                  <input
                    className="num"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={aguas[r.id] ?? ""}
                    onChange={(e) =>
                      setAguas((v) => ({ ...v, [r.id]: e.target.value }))
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="actions">
        <span className="muted">
          Usa los precios vigentes de la fecha.
        </span>
        <button className="btn primary" onClick={registrar}>
          Guardar producción
        </button>
      </div>

      {msg && <div className={"msg " + msg.tipo}>{msg.texto}</div>}

      {resultado?.advertencias?.length > 0 && (
        <div className="msg warn">
          <strong>Faltan datos para calcular.</strong>
          <ul className="warning-list">
            {resultado.advertencias.slice(0, 8).map((texto, idx) => (
              <li key={idx}>{texto}</li>
            ))}
          </ul>
          {resultado.advertencias.length > 8 && (
            <p>Hay {resultado.advertencias.length - 8} aviso(s) más.</p>
          )}
        </div>
      )}

      {resultado && (
        <div className="card result">
          <h3>
            Producción guardada · {resultado.fecha} ·{" "}
            {resultado.modo_costeo === "LLENADORAS_COMPLETAS"
              ? "por cantidad de aguas"
              : "proporcional"}
          </h3>
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
              {resultado.resultados.map((r, idx) => (
                <tr key={idx}>
                  <td>{r.receta}</td>
                  <td className="right">{r.aguas ?? r.vasos}</td>
                  <td className="right">{money(r.costo_por_agua ?? r.costo_por_vaso)}</td>
                  <td className="right">{money(r.costo_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
