import React, { useEffect, useState } from "react";
import { api } from "../api.js";

const hoyISO = () => new Date().toISOString().slice(0, 10);
const money = (v) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(v) || 0);

const UNIDADES_RECETA = [
  { value: "l", label: "Litro (l)" },
  { value: "ml", label: "Mililitro (ml)" },
  { value: "kg", label: "Kilogramo (kg)" },
  { value: "g", label: "Gramo (g)" },
  { value: "pza", label: "Pieza (pza)" },
  { value: "unidad", label: "Unidad" },
];

const UNIDADES_COMPRA = [
  ...UNIDADES_RECETA,
  { value: "garrafón", label: "Garrafón" },
  { value: "costal", label: "Costal" },
  { value: "caja", label: "Caja" },
  { value: "paquete", label: "Paquete" },
  { value: "bolsa", label: "Bolsa" },
  { value: "botella", label: "Botella" },
];

function opcionesUnidad(insumos, campos, base) {
  const vistos = new Set();
  const opciones = [];

  function agregar(opcion) {
    const value = typeof opcion === "string" ? opcion : opcion.value;
    const label = typeof opcion === "string" ? opcion : opcion.label;
    const limpia = String(value || "").trim();
    const llave = limpia.toLocaleLowerCase();
    if (!limpia || vistos.has(llave)) return;
    vistos.add(llave);
    opciones.push({ value: limpia, label: label || limpia });
  }

  base.forEach(agregar);
  insumos.forEach((insumo) => {
    campos.forEach((campo) => agregar(insumo[campo]));
  });

  return opciones;
}

function UnidadSelect({ value, options, placeholder, onChange }) {
  const actual = String(value || "").trim();
  const existe = options.some((opcion) => opcion.value.toLocaleLowerCase() === actual.toLocaleLowerCase());
  const opciones = actual && !existe ? [{ value: actual, label: actual }, ...options] : options;

  return (
    <select value={actual} onChange={(e) => onChange(e.target.value)}>
      <option value="" disabled>
        {placeholder}
      </option>
      {opciones.map((opcion) => (
        <option key={opcion.value} value={opcion.value}>
          {opcion.label}
        </option>
      ))}
    </select>
  );
}

export default function Precios() {
  const [insumos, setInsumos] = useState([]);
  const [preciosEditados, setPreciosEditados] = useState({});
  const [insumosEditados, setInsumosEditados] = useState({});
  const [nuevoInsumo, setNuevoInsumo] = useState(null);
  const [fecha, setFecha] = useState(hoyISO());
  const [msg, setMsg] = useState(null);
  const [cargando, setCargando] = useState(true);

  function cargar() {
    setCargando(true);
    api
      .insumos(fecha, true)
      .then((d) => {
        setInsumos(d);
        setPreciosEditados({});
        setInsumosEditados({});
        setNuevoInsumo(null);
        setCargando(false);
      })
      .catch(() => {
        setMsg({ tipo: "error", texto: "No se pudo conectar con el servidor." });
        setCargando(false);
      });
  }

  useEffect(cargar, [fecha]);

  useEffect(() => {
    if (!msg) return undefined;
    const timer = setTimeout(() => setMsg(null), 3500);
    return () => clearTimeout(timer);
  }, [msg]);

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
        unidad_compra:
          editado.unidad_compra !== undefined
            ? editado.unidad_compra.trim()
            : i.unidad_compra || i.unidad,
        factor_conversion:
          editado.factor_conversion !== undefined
            ? Number(editado.factor_conversion)
            : i.factor_conversion || 1,
        activa: editado.activa !== undefined ? editado.activa : i.activa,
        original: i,
      };
    })
    .filter(
      (i) =>
        i.nombre &&
        i.unidad &&
        i.unidad_compra &&
        i.factor_conversion > 0 &&
        (i.nombre !== i.original.nombre ||
          i.unidad !== i.original.unidad ||
          i.unidad_compra !== (i.original.unidad_compra || i.original.unidad) ||
          i.factor_conversion !== (i.original.factor_conversion || 1) ||
          i.activa !== i.original.activa)
    );

  function valorInsumo(insumo, campo) {
    return insumosEditados[insumo.id]?.[campo] ?? insumo[campo];
  }

  function cambiarDatoInsumo(insumo, campo, valor) {
    setInsumosEditados((prev) => ({
      ...prev,
      [insumo.id]: { ...prev[insumo.id], [campo]: valor },
    }));
  }

  function precioActual(insumo) {
    return preciosEditados[insumo.id] !== undefined ? preciosEditados[insumo.id] : insumo.precio;
  }

  function precioConvertido(insumo) {
    const precio = Number(precioActual(insumo)) || 0;
    const factor = Number(valorInsumo(insumo, "factor_conversion")) || 1;
    return factor > 0 ? precio / factor : 0;
  }

  function contenidoActual(insumo) {
    const valor = valorInsumo(insumo, "factor_conversion");
    return valor === "" || valor === undefined || valor === null ? "" : valor;
  }

  function guardar() {
    if (fecha > hoyISO()) {
      setMsg({ tipo: "error", texto: "No se pueden guardar precios con fecha futura." });
      return;
    }
    if (cambiosPrecio.length === 0 && cambiosInsumo.length === 0) {
      setMsg({ tipo: "info", texto: "No hay cambios por guardar." });
      return;
    }

    const requests = [
      ...cambiosInsumo.map((i) =>
        api.actualizarInsumo(i.id, {
          nombre: i.nombre,
          unidad: i.unidad,
          unidad_compra: i.unidad_compra,
          factor_conversion: i.factor_conversion,
          activa: i.activa,
        })
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

  function guardarNuevoInsumo() {
    if (fecha > hoyISO()) {
      setMsg({ tipo: "error", texto: "No se pueden agregar insumos con fecha futura." });
      return;
    }
    const payload = {
      nombre: (nuevoInsumo?.nombre || "").trim(),
      unidad: (nuevoInsumo?.unidad || "").trim(),
      unidad_compra: (nuevoInsumo?.unidad_compra || nuevoInsumo?.unidad || "").trim(),
      factor_conversion: Number(nuevoInsumo?.factor_conversion) || 1,
      precio: Number(nuevoInsumo?.precio) || 0,
      fecha,
      activa: true,
    };
    if (!payload.nombre || !payload.unidad || !payload.unidad_compra || payload.factor_conversion <= 0) {
      setMsg({ tipo: "error", texto: "Nombre, unidades y contenido son obligatorios." });
      return;
    }
    api
      .crearInsumo(payload)
      .then(() => {
        setMsg({ tipo: "ok", texto: `"${payload.nombre}" fue agregado al catálogo.` });
        cargar();
      })
      .catch(() => setMsg({ tipo: "error", texto: "No se pudo agregar el insumo." }));
  }

  function cambiarActivo(insumo, activa) {
    setInsumosEditados((prev) => ({
      ...prev,
      [insumo.id]: { ...prev[insumo.id], activa },
    }));
  }

  if (cargando) return <p className="muted">Cargando precios…</p>;

  const activos = insumos.filter((i) => valorInsumo(i, "activa")).length;
  const opcionesReceta = opcionesUnidad(insumos, ["unidad"], UNIDADES_RECETA);
  const opcionesCompra = opcionesUnidad(insumos, ["unidad_compra", "unidad"], UNIDADES_COMPRA);

  return (
    <section className="precios-page">
      <div className="page-head">
        <div>
          <h2>Precios de insumos</h2>
          <p className="muted">Configura compra, contenido y precio real para calcular cada receta.</p>
        </div>
        <div className="page-tools">
          <label className="date-field">
            Fecha de vigencia
            <input
              type="date"
              value={fecha}
              max={hoyISO()}
              onChange={(e) => setFecha(e.target.value > hoyISO() ? hoyISO() : e.target.value)}
            />
          </label>
          <button
            className="btn"
            onClick={() =>
              setNuevoInsumo({
                nombre: "",
                unidad: "",
                unidad_compra: "",
                factor_conversion: "1",
                precio: "",
              })
            }
          >
            Agregar insumo
          </button>
        </div>
      </div>

      <div className="conversion-guide">
        <div className="conversion-rule">
          <span className="eyebrow">Regla de cálculo</span>
          <h3>Precio para receta = precio de compra / contenido comprado</h3>
          <p>
            El contenido se captura en la misma unidad que usas en recetas. Así un garrafón, costal
            o caja se convierte automáticamente al costo por litro, kilo, mililitro o pieza.
          </p>
        </div>
        <div className="conversion-examples">
          <div>
            <span>Agua</span>
            <strong>Garrafón de 20 l</strong>
            <small>$30 / 20 = $1.50 por l</small>
          </div>
          <div>
            <span>Si receta usa ml</span>
            <strong>Contenido 20000 ml</strong>
            <small>450 ml se calculan con precio por ml</small>
          </div>
          <div>
            <span>Azúcar</span>
            <strong>Costal de 50 kg</strong>
            <small>$900 / 50 = $18.00 por kg</small>
          </div>
        </div>
      </div>

      <div className="insumos-panel">
        {nuevoInsumo && (
          <div className="inline-create">
            <label>
              Insumo
              <input
                type="text"
                placeholder="Concentrado"
                value={nuevoInsumo.nombre}
                onChange={(e) => setNuevoInsumo((prev) => ({ ...prev, nombre: e.target.value }))}
              />
            </label>
            <label>
              Unidad en receta
              <UnidadSelect
                value={nuevoInsumo.unidad}
                options={opcionesReceta}
                placeholder="Selecciona unidad"
                onChange={(unidad) => setNuevoInsumo((prev) => ({ ...prev, unidad }))}
              />
            </label>
            <label>
              Unidad al comprar
              <UnidadSelect
                value={nuevoInsumo.unidad_compra}
                options={opcionesCompra}
                placeholder="Selecciona compra"
                onChange={(unidad_compra) => setNuevoInsumo((prev) => ({ ...prev, unidad_compra }))}
              />
            </label>
            <label>
              Contenido en unidad de receta
              <input
                type="number"
                min="0.0001"
                step="0.01"
                value={nuevoInsumo.factor_conversion}
                onChange={(e) => setNuevoInsumo((prev) => ({ ...prev, factor_conversion: e.target.value }))}
              />
            </label>
            <label>
              Precio inicial
              <input
                type="number"
                min="0"
                step="0.5"
                value={nuevoInsumo.precio}
                onChange={(e) => setNuevoInsumo((prev) => ({ ...prev, precio: e.target.value }))}
              />
            </label>
            <div className="inline-create-actions">
              <button className="btn primary" onClick={guardarNuevoInsumo}>
                Guardar insumo
              </button>
              <button className="btn" onClick={() => setNuevoInsumo(null)}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="catalog-head">
          <div>
            <h3>Catálogo de insumos</h3>
            <p className="muted">
              {insumos.length} insumo(s), {activos} activo(s). Desactiva lo que ya no debe aparecer en recetas.
            </p>
          </div>
          <span className="summary-pill">
            {cambiosPrecio.length + cambiosInsumo.length === 0
              ? "Todo guardado"
              : `${cambiosPrecio.length + cambiosInsumo.length} cambio(s)`}
          </span>
        </div>

        <div className="insumo-list">
          {insumos.map((i) => {
            const precio = precioActual(i);
            const precioCambiado =
              preciosEditados[i.id] !== undefined &&
              preciosEditados[i.id] !== "" &&
              Number(preciosEditados[i.id]) !== i.precio;
            const insumoCambiado = cambiosInsumo.some((c) => c.id === i.id);
            const cambiado = precioCambiado || insumoCambiado;
            const activo = valorInsumo(i, "activa");
            const unidadUso = valorInsumo(i, "unidad");
            const unidadCompra = valorInsumo(i, "unidad_compra") || unidadUso;
            const contenido = contenidoActual(i);
            const contenidoNumero = Number(contenido) || 1;

            return (
              <article
                key={i.id}
                className={"insumo-card" + (!activo ? " inactive" : "") + (cambiado ? " changed" : "")}
              >
                <div className="insumo-card-head">
                  <label className="insumo-name-field">
                    Nombre del insumo
                    <input
                      type="text"
                      value={valorInsumo(i, "nombre")}
                      onChange={(e) => cambiarDatoInsumo(i, "nombre", e.target.value)}
                    />
                  </label>
                  <button
                    className={"switch-btn" + (activo ? " active" : "")}
                    onClick={() => cambiarActivo(i, !activo)}
                    aria-pressed={activo}
                    type="button"
                  >
                    <span aria-hidden="true" />
                    {activo ? "Activo" : "Inactivo"}
                  </button>
                </div>

                <div className="equation-strip">
                  <div className="eq-col">
                    <span className="eq-val">{money(precio)}</span>
                    <span className="eq-lbl">por {unidadCompra || "compra"}</span>
                  </div>
                  <span className="eq-op">÷</span>
                  <div className="eq-col">
                    <span className="eq-val">{contenidoNumero}</span>
                    <span className="eq-lbl">{unidadUso || "unidad"} incluidos</span>
                  </div>
                  <span className="eq-op">=</span>
                  <div className="eq-col eq-result-col">
                    <span className="eq-val">
                      {money(precioConvertido(i))} <small>/ {unidadUso || "unidad"}</small>
                    </span>
                    <span className="eq-lbl">costo en receta</span>
                  </div>
                </div>

                <div className="insumo-config">
                  <div className="compra-sentence">
                    <span className="cs-text">Compras 1</span>
                    <UnidadSelect
                      value={unidadCompra}
                      options={opcionesCompra}
                      placeholder="tipo…"
                      onChange={(unidad) => cambiarDatoInsumo(i, "unidad_compra", unidad)}
                    />
                    <span className="cs-text">por</span>
                    <span className="cs-price-wrap">
                      <span className="cs-prefix">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={precio ?? ""}
                        onChange={(e) =>
                          setPreciosEditados((prev) => ({ ...prev, [i.id]: e.target.value }))
                        }
                      />
                    </span>
                    <span className="cs-text">y rinde</span>
                    <input
                      className="cs-qty"
                      type="number"
                      min="0.0001"
                      step="0.01"
                      value={contenido}
                      onChange={(e) => cambiarDatoInsumo(i, "factor_conversion", e.target.value)}
                    />
                    <UnidadSelect
                      value={unidadUso}
                      options={opcionesReceta}
                      placeholder="unidad…"
                      onChange={(unidad) => cambiarDatoInsumo(i, "unidad", unidad)}
                    />
                  </div>
                </div>

                <div className="insumo-card-foot">
                  <span className="muted">Vigente desde {i.vigente_desde || "—"}</span>
                  {cambiado ? (
                    <span className="badge warn">modificado</span>
                  ) : !i.activa ? (
                    <span className="badge warn">inactivo</span>
                  ) : (
                    <span className="badge ok">sin cambios</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
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
