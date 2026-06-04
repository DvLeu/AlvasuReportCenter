const BASE = "http://127.0.0.1:5000/api";

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error("Error en la petición: " + res.status);
  return res.json();
}

export const api = {
  insumos: (fecha, todas = false) => {
    const params = new URLSearchParams();
    if (fecha) params.set("fecha", fecha);
    if (todas) params.set("todas", "1");
    const query = params.toString();
    return req("/insumos" + (query ? "?" + query : ""));
  },
  crearInsumo: (payload) =>
    req("/insumos", { method: "POST", body: JSON.stringify(payload) }),
  actualizarInsumo: (id, payload) =>
    req(`/insumos/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  guardarPrecios: (cambios, fecha) =>
    req("/precios", { method: "POST", body: JSON.stringify({ cambios, fecha }) }),
  recetas: (todas = false) => req("/recetas" + (todas ? "?todas=1" : "")),
  crearReceta: (payload) =>
    req("/recetas", { method: "POST", body: JSON.stringify(payload) }),
  actualizarReceta: (id, payload) =>
    req(`/recetas/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  desactivarReceta: (id) => req(`/recetas/${id}`, { method: "DELETE" }),
  registrarProduccion: (fecha, items) =>
    req("/produccion", { method: "POST", body: JSON.stringify({ fecha, items }) }),
  dashboard: (fecha) => req("/dashboard" + (fecha ? "?fecha=" + fecha : "")),
  dashboardHistorico: ({ periodo = "mes", mes, anio } = {}) => {
    const params = new URLSearchParams({ periodo });
    if (periodo === "anio" && anio) params.set("anio", anio);
    if (periodo !== "anio" && mes) params.set("mes", mes);
    return req("/dashboard/historico?" + params.toString());
  },
  config: () => req("/config"),
};
