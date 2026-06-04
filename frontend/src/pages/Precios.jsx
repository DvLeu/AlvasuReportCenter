import React, { useEffect, useState } from "react";
import { api } from "../api.js";

const hoyISO = () => new Date().toISOString().slice(0, 10);

export default function Precios() {
  const [insumos, setInsumos] = useState([]);
  const [preciosEditados, setPreciosEditados] = useState({});
  const [insumosEditados, setInsumosEditados] = useState({});
  const [fecha, setFecha] = useState(hoyISO());
  const [msg, setMsg] = useState(null);
  const [cargando, setCargando] = useState(true);

  function cargar() {
    setCargando(true);
    api
      .insumos(fecha)
      .then((d) => {
        setInsumos(d);
        setPreciosEditados({});
        setInsumosEditados({});
        setCargando(false);
      })
      .catch(() => {
        setMsg({ tipo: "error", texto: "No se pudo conectar con el servidor." });
        setCargando(false);
      });
  }

  useEffect(cargar, [fecha]);

  const cambiosPrecio = insumos
    .filter(
      (i) =>
        preciosEditados[i.id] !== undefined &&
        preciosEditados[i.id] !== "" &&
        Number(preciosEditados[i.id]) !== i.precio
    )
    .map((i) => ({ insumo_id: i.id, precio: Number(preciosEditados[i.id]) }));

  const cambiosInsumo = insumos
    .map((i) => {
      const editado = insumosEditados[i.id] || {};
      return {
        id: i.id,
        nombre: editado.nombre !== undefined ? editado.nombre.trim() : i.nombre,
        unidad: editado.unidad !== undefined ? editado.unidad.trim() : i.unidad,
        original: i,
      };
    })
    .filter(
      (i) =>
        i.nombre &&
        i.unidad &&
        (i.nombre !== i.original.nombre || i.unidad !== i.original.unidad)
    );

  function valorInsumo(insumo, campo) {
    return insumosEditados[insumo.id]?.[campo] ?? insumo[campo];
  }

  function guardar() {
    if (cambiosPrecio.length === 0 && cambiosInsumo.length === 0) {
      setMsg({ tipo: "info", texto: "No hay cambios por guardar." });
      return;
    }

    const requests = [
      ...cambiosInsumo.map((i) =>
        api.actualizarInsumo(i.id, { nombre: i.nombre, unidad: i.unidad })
      ),
    ];

    if (cambiosPrecio.length > 0) {
      requests.push(api.guardarPrecios(cambiosPrecio, fecha));
    }

    Promise.all(requests)
      .then(() => {
        setMsg({
          tipo: "ok",
          texto: `${cambiosPrecio.length} precio(s) y ${cambiosInsumo.length} insumo(s) actualizados. Los precios aplican desde ${fecha}.`,
        });
        cargar();
      })
      .catch(() => setMsg({ tipo: "error", texto: "Error al guardar." }));
  }

  if (cargando) return <p className="muted">Cargando precios…</p>;

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>Precios de insumos</h2>
          <p className="muted">Edita precios históricos por fecha y datos del catálogo.</p>
        </div>
        <label className="date-field">
          Fecha de vigencia
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
              <th>Insumo</th>
              <th>Unidad</th>
              <th>Vigente desde</th>
              <th className="right">Precio / unidad</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {insumos.map((i) => {
              const precio = preciosEditados[i.id] !== undefined ? preciosEditados[i.id] : i.precio;
              const precioCambiado =
                preciosEditados[i.id] !== undefined &&
                preciosEditados[i.id] !== "" &&
                Number(preciosEditados[i.id]) !== i.precio;
              const insumoCambiado = cambiosInsumo.some((c) => c.id === i.id);
              const cambiado = precioCambiado || insumoCambiado;
              return (
                <tr key={i.id} className={cambiado ? "row-changed" : ""}>
                  <td>
                    <input
                      className="text-cell"
                      type="text"
                      value={valorInsumo(i, "nombre")}
                      onChange={(e) =>
                        setInsumosEditados((prev) => ({
                          ...prev,
                          [i.id]: { ...prev[i.id], nombre: e.target.value },
                        }))
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="unit-cell"
                      type="text"
                      value={valorInsumo(i, "unidad")}
                      onChange={(e) =>
                        setInsumosEditados((prev) => ({
                          ...prev,
                          [i.id]: { ...prev[i.id], unidad: e.target.value },
                        }))
                      }
                    />
                  </td>
                  <td className="muted">{i.vigente_desde || "—"}</td>
                  <td className="right">
                    <span className="prefix">$</span>
                    <input
                      className="num"
                      type="number"
                      min="0"
                      step="0.5"
                      value={precio ?? ""}
                      onChange={(e) =>
                        setPreciosEditados((prev) => ({ ...prev, [i.id]: e.target.value }))
                      }
                    />
                  </td>
                  <td>
                    {cambiado ? (
                      <span className="badge warn">modificado</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="actions">
        <span className="muted">
          {cambiosPrecio.length === 0 && cambiosInsumo.length === 0
            ? "Sin cambios por guardar"
            : `${cambiosPrecio.length} precio(s), ${cambiosInsumo.length} insumo(s) modificado(s)`}
        </span>
        <button className="btn primary" onClick={guardar}>
          Guardar cambios
        </button>
      </div>

      {msg && <div className={"msg " + msg.tipo}>{msg.texto}</div>}
    </section>
  );
}
