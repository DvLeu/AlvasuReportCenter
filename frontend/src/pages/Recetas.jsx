import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";

const defaultRow = () => ({ insumo_id: "", cantidad_por_jarra: "" });

const emptyForm = () => ({
  id: null,
  nombre: "",
  rendimiento_vasos: 160,
  volumen_jarra: 80,
  activa: true,
  insumos: [defaultRow()],
});

function formFromReceta(receta) {
  return {
    id: receta.id,
    nombre: receta.nombre,
    rendimiento_vasos: receta.rendimiento_vasos,
    volumen_jarra: receta.volumen_jarra ?? 0,
    activa: receta.activa !== false,
    insumos: receta.insumos.length
      ? receta.insumos.map((ri) => ({
          insumo_id: String(ri.insumo_id),
          cantidad_por_jarra: String(ri.cantidad_por_jarra),
        }))
      : [defaultRow()],
  };
}

export default function Recetas() {
  const [recetas, setRecetas] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [msg, setMsg] = useState(null);
  const [cargando, setCargando] = useState(true);

  function cargar() {
    setCargando(true);
    Promise.all([api.recetas(true), api.insumos()])
      .then(([rs, is]) => {
        setRecetas(rs);
        setInsumos(is);
        setCargando(false);
      })
      .catch(() => {
        setMsg({ tipo: "error", texto: "No se pudieron cargar las recetas." });
        setCargando(false);
      });
  }

  useEffect(cargar, []);

  const insumoLookup = useMemo(
    () => new Map(insumos.map((i) => [String(i.id), i])),
    [insumos]
  );

  function nuevo() {
    setForm(emptyForm());
    setMsg(null);
  }

  function editar(receta) {
    setForm(formFromReceta(receta));
    setMsg(null);
  }

  function cambiarCampo(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  function cambiarInsumo(idx, campo, valor) {
    setForm((prev) => ({
      ...prev,
      insumos: prev.insumos.map((row, i) =>
        i === idx ? { ...row, [campo]: valor } : row
      ),
    }));
  }

  function agregarInsumo() {
    setForm((prev) => ({ ...prev, insumos: [...prev.insumos, defaultRow()] }));
  }

  function quitarInsumo(idx) {
    setForm((prev) => {
      const next = prev.insumos.filter((_, i) => i !== idx);
      return { ...prev, insumos: next.length ? next : [defaultRow()] };
    });
  }

  function guardar() {
    const payload = {
      nombre: form.nombre.trim(),
      rendimiento_vasos: Number(form.rendimiento_vasos),
      volumen_jarra: Number(form.volumen_jarra),
      activa: form.activa,
      insumos: form.insumos
        .filter((row) => row.insumo_id && row.cantidad_por_jarra !== "")
        .map((row) => ({
          insumo_id: Number(row.insumo_id),
          cantidad_por_jarra: Number(row.cantidad_por_jarra),
        })),
    };

    if (!payload.nombre || !payload.rendimiento_vasos) {
      setMsg({ tipo: "error", texto: "Nombre y rendimiento son obligatorios." });
      return;
    }

    const request = form.id
      ? api.actualizarReceta(form.id, payload)
      : api.crearReceta(payload);

    request
      .then((saved) => {
        setMsg({
          tipo: "ok",
          texto: form.id
            ? "Receta actualizada correctamente."
            : "Receta creada correctamente.",
        });
        setForm(formFromReceta(saved));
        cargar();
      })
      .catch(() => setMsg({ tipo: "error", texto: "No se pudo guardar la receta." }));
  }

  function desactivar(receta) {
    api
      .desactivarReceta(receta.id)
      .then(() => {
        if (form.id === receta.id) {
          nuevo();
        }
        setMsg({ tipo: "ok", texto: `"${receta.nombre}" fue desactivada.` });
        cargar();
      })
      .catch(() => setMsg({ tipo: "error", texto: "No se pudo desactivar." }));
  }

  if (cargando) return <p className="muted">Cargando recetas…</p>;

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>Recetas</h2>
          <p className="muted">Alta y edición de sabores e insumos por llenadora. 1 llenadora = 160 aguas.</p>
        </div>
        <button className="btn" onClick={nuevo}>
          Nueva receta
        </button>
      </div>

      <div className="recipe-layout">
        <div className="card recipe-list-card">
          <div className="card-title-row">
            <h3>Catálogo</h3>
            <span className="muted">{recetas.length} receta(s)</span>
          </div>
          <div className="recipe-list">
            {recetas.map((receta) => (
              <div key={receta.id} className={"recipe-item" + (form.id === receta.id ? " active" : "") }>
                <div>
                  <strong>{receta.nombre}</strong>
                  <div className="muted">
                    {receta.rendimiento_aguas ?? receta.rendimiento_vasos} aguas · {receta.insumos.length} insumo(s)
                  </div>
                </div>
                <div className="recipe-actions">
                  <button className="btn" onClick={() => editar(receta)}>
                    Editar
                  </button>
                  {receta.activa ? (
                    <button className="btn" onClick={() => desactivar(receta)}>
                      Desactivar
                    </button>
                  ) : (
                    <span className="badge warn">inactiva</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card recipe-form-card">
          <div className="card-title-row">
            <h3>{form.id ? "Editar receta" : "Nueva receta"}</h3>
            <span className="muted">Los costos siguen entrando en Precios.</span>
          </div>

          <div className="field-grid">
            <label>
              Nombre
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => cambiarCampo("nombre", e.target.value)}
                placeholder="Limón"
              />
            </label>
            <label>
              Rendimiento (aguas por llenadora)
              <input
                type="number"
                min="1"
                step="1"
                value={form.rendimiento_vasos}
                onChange={(e) => cambiarCampo("rendimiento_vasos", e.target.value)}
              />
            </label>
            <label>
              Volumen de llenadora (L)
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.volumen_jarra}
                onChange={(e) => cambiarCampo("volumen_jarra", e.target.value)}
              />
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.activa}
                onChange={(e) => cambiarCampo("activa", e.target.checked)}
              />
              Activa
            </label>
          </div>

          <div className="ingredient-block">
            <div className="card-title-row">
              <h4>Ingredientes</h4>
              <button className="btn" onClick={agregarInsumo}>
                Agregar ingrediente
              </button>
            </div>

            <div className="ingredient-list">
              {form.insumos.map((row, idx) => {
                const insumo = insumoLookup.get(String(row.insumo_id));
                return (
                  <div className="ingredient-row" key={idx}>
                    <label>
                      Insumo
                      <select
                        value={row.insumo_id}
                        onChange={(e) => cambiarInsumo(idx, "insumo_id", e.target.value)}
                      >
                        <option value="">Selecciona</option>
                        {insumos.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.nombre} ({i.unidad})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Cantidad por llenadora {insumo ? `(${insumo.unidad})` : ""}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.cantidad_por_jarra}
                        onChange={(e) =>
                          cambiarInsumo(idx, "cantidad_por_jarra", e.target.value)
                        }
                      />
                    </label>
                    <button className="btn" onClick={() => quitarInsumo(idx)}>
                      Quitar
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="actions">
            <span className="muted">
              {form.id ? "Edita y guarda los cambios." : "Crea una receta nueva."}
            </span>
            <button className="btn primary" onClick={guardar}>
              {form.id ? "Guardar cambios" : "Crear receta"}
            </button>
          </div>

          {msg && <div className={"msg " + msg.tipo}>{msg.texto}</div>}
        </div>
      </div>
    </section>
  );
}
