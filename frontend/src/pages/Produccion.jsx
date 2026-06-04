import React, { useEffect, useState } from "react";
import { api } from "../api.js";

const money = (v) => "$" + Number(v).toFixed(2);
const hoyISO = () => new Date().toISOString().slice(0, 10);

export default function Produccion() {
  const [recetas, setRecetas] = useState([]);
  const [llenadoras, setLlenadoras] = useState({});
  const [fecha, setFecha] = useState(hoyISO());
  const [resultado, setResultado] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api
      .recetas()
      .then(setRecetas)
      .catch(() =>
        setMsg({ tipo: "error", texto: "No se pudieron cargar las recetas." })
      );
  }, []);

  function registrar() {
    const items = recetas
      .map((r) => ({ receta_id: r.id, llenadoras: Number(llenadoras[r.id]) || 0 }))
      .filter((it) => it.llenadoras > 0);
    if (items.length === 0) {
      setMsg({ tipo: "info", texto: "Captura al menos una cantidad de llenadoras." });
      return;
    }
    api
      .registrarProduccion(fecha, items)
      .then((d) => {
        setResultado(d);
        setMsg({ tipo: "ok", texto: "Producción registrada y costo sellado." });
      })
      .catch(() => setMsg({ tipo: "error", texto: "Error al registrar." }));
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>Captura diaria</h2>
          <p className="muted">Aguas preparadas por sabor. 1 llenadora rinde 160 aguas.</p>
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

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Sabor</th>
              <th>Rinde por llenadora</th>
              <th className="right">Llenadoras</th>
            </tr>
          </thead>
          <tbody>
            {recetas.map((r) => (
              <tr key={r.id}>
                <td>{r.nombre}</td>
                <td className="muted">{r.rendimiento_aguas ?? r.rendimiento_vasos} aguas</td>
                <td className="right">
                  <input
                    className="num"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={llenadoras[r.id] ?? ""}
                    onChange={(e) =>
                      setLlenadoras((v) => ({ ...v, [r.id]: e.target.value }))
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
          El costo se calcula con los precios vigentes de la fecha.
        </span>
        <button className="btn primary" onClick={registrar}>
          Registrar y calcular
        </button>
      </div>

      {msg && <div className={"msg " + msg.tipo}>{msg.texto}</div>}

      {resultado?.advertencias?.length > 0 && (
        <div className="msg warn">
          <strong>No se pudo calcular un costo real.</strong>
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
            Resultado · {resultado.fecha} ·{" "}
            {resultado.modo_costeo === "LLENADORAS_COMPLETAS"
              ? "llenadoras completas"
              : "proporcional"}
          </h3>
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
              {resultado.resultados.map((r, idx) => (
                <tr key={idx}>
                  <td>{r.receta}</td>
                  <td className="right">{r.llenadoras ?? r.vasos}</td>
                  <td className="right">{r.aguas ?? r.llenadoras}</td>
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
