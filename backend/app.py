"""
API REST del sistema de costos de aguas frescas.

Endpoints:
  GET  /api/insumos              lista insumos con su precio vigente
  POST /api/precios              actualiza precios (solo escribe los que cambian)
  GET  /api/recetas              lista recetas con sus insumos
  POST /api/produccion           registra la produccion de un dia y sella el costo
  GET  /api/dashboard?fecha=     resumen de costos de una fecha
  GET  /api/config               lee los ajustes globales
  PUT  /api/config               actualiza ajustes (p. ej. modo_costeo)
"""

import os
from calendar import monthrange
from datetime import date, datetime
from sqlalchemy import inspect, text

from flask import Flask, jsonify, request
from flask_cors import CORS

from models import (
    db,
    Receta,
    Insumo,
    RecetaInsumo,
    PrecioInsumo,
    Produccion,
    ProduccionDetalle,
    Config,
)
from calc import calcular
from seed import seed_if_empty

BASE = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + os.path.join(BASE, "aguas.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db.init_app(app)
CORS(app)


def ensure_schema_and_migrations():
    with app.app_context():
        db.create_all()
        inspector = inspect(db.engine)
        table_names = inspector.get_table_names()
        if "insumos" in table_names:
            columns = {column["name"] for column in inspector.get_columns("insumos")}
            if "activa" not in columns:
                db.session.execute(
                    text("ALTER TABLE insumos ADD COLUMN activa BOOLEAN DEFAULT 1")
                )
                db.session.commit()
            if "unidad_compra" not in columns:
                db.session.execute(
                    text("ALTER TABLE insumos ADD COLUMN unidad_compra VARCHAR")
                )
                db.session.execute(
                    text(
                        "UPDATE insumos SET unidad_compra = unidad WHERE unidad_compra IS NULL"
                    )
                )
                db.session.commit()
            if "factor_conversion" not in columns:
                db.session.execute(
                    text(
                        "ALTER TABLE insumos ADD COLUMN factor_conversion FLOAT DEFAULT 1"
                    )
                )
                db.session.execute(
                    text(
                        "UPDATE insumos SET factor_conversion = 1 WHERE factor_conversion IS NULL"
                    )
                )
                db.session.commit()

        if "configuracion" not in table_names or "produccion" not in table_names:
            return

        migrated = Config.query.filter_by(clave="produccion_unidad").first()
        if not migrated:
            for prod in Produccion.query.all():
                rendimiento = prod.receta.rendimiento_vasos or 160
                prod.vasos = int(prod.vasos * rendimiento)
            db.session.add(Config(clave="produccion_unidad", valor="AGUAS"))
            db.session.commit()

        seed_if_empty()


ensure_schema_and_migrations()


def get_config(clave, default=None):
    c = Config.query.filter_by(clave=clave).first()
    return c.valor if c else default


def parse_fecha(valor):
    if valor:
        return datetime.strptime(valor, "%Y-%m-%d").date()
    return date.today()


def parse_mes(valor):
    if valor:
        return datetime.strptime(valor, "%Y-%m").date().replace(day=1)
    hoy = date.today()
    return hoy.replace(day=1)


def parse_anio(valor):
    if valor:
        return int(valor)
    return date.today().year


def precio_vigente_en(insumo_id, fecha):
    return (
        PrecioInsumo.query.filter(PrecioInsumo.insumo_id == insumo_id)
        .filter(PrecioInsumo.vigente_desde <= fecha)
        .filter(
            (PrecioInsumo.vigente_hasta.is_(None))
            | (PrecioInsumo.vigente_hasta > fecha)
        )
        .order_by(PrecioInsumo.vigente_desde.desc())
        .first()
    )


def guardar_precio_desde(insumo_id, precio, fecha):
    actual = precio_vigente_en(insumo_id, fecha)
    if actual and actual.vigente_desde == fecha:
        if abs(actual.precio - precio) < 1e-9:
            return False
        actual.precio = precio
        return True

    if actual and abs(actual.precio - precio) < 1e-9:
        return False

    vigente_hasta = actual.vigente_hasta if actual else None
    if actual:
        actual.vigente_hasta = fecha

    db.session.add(
        PrecioInsumo(
            insumo_id=insumo_id,
            precio=precio,
            vigente_desde=fecha,
            vigente_hasta=vigente_hasta,
        )
    )
    return True


def recalcular_produccion_de_fecha(fecha):
    recalculados = []
    for prod in Produccion.query.filter_by(fecha=fecha).all():
        calc = calcular(prod.receta, prod.vasos, fecha, prod.modo_costeo)
        prod.costo_total = calc["costo_total"]
        prod.costo_por_vaso = calc["costo_por_agua"]
        prod.detalles.clear()
        db.session.flush()
        for d in calc["detalles"]:
            db.session.add(
                ProduccionDetalle(
                    produccion_id=prod.id,
                    insumo_id=d["insumo_id"],
                    nombre_insumo=d["nombre_insumo"],
                    cantidad=d["cantidad"],
                    precio_usado=d["precio_usado"],
                    subtotal=d["subtotal"],
                )
            )
        recalculados.append(prod.id)
    return recalculados


def receta_json(receta):
    return {
        "id": receta.id,
        "nombre": receta.nombre,
        "rendimiento_vasos": receta.rendimiento_vasos,
        "rendimiento_llenadoras": receta.rendimiento_vasos,
        "rendimiento_aguas": receta.rendimiento_vasos,
        "volumen_jarra": receta.volumen_jarra,
        "activa": receta.activa,
        "insumos": [
            {
                "insumo_id": ri.insumo_id,
                "nombre": ri.insumo.nombre,
                "cantidad_por_jarra": ri.cantidad_por_jarra,
            }
            for ri in receta.insumos
        ],
    }


def sync_receta_insumos(receta, insumos):
    receta.insumos.clear()
    db.session.flush()
    for item in insumos:
        insumo_id = int(item.get("insumo_id"))
        cantidad = float(item.get("cantidad_por_jarra", 0))
        insumo = db.session.get(Insumo, insumo_id)
        if not insumo:
            continue
        receta.insumos.append(
            RecetaInsumo(insumo_id=insumo.id, cantidad_por_jarra=cantidad)
        )


# ---------- Insumos y precios ----------
@app.get("/api/insumos")
def listar_insumos():
    fecha = parse_fecha(request.args.get("fecha"))
    incluir_inactivos = request.args.get("todas") == "1"
    query = Insumo.query.order_by(Insumo.nombre)
    if not incluir_inactivos:
        query = query.filter_by(activa=True)
    out = []
    for i in query.all():
        p = precio_vigente_en(i.id, fecha)
        out.append(
            {
                "id": i.id,
                "nombre": i.nombre,
                "unidad": i.unidad,
                "unidad_compra": i.unidad_compra or i.unidad,
                "factor_conversion": i.factor_conversion or 1,
                "activa": i.activa,
                "precio": p.precio if p else None,
                "vigente_desde": p.vigente_desde.isoformat() if p else None,
                "vigente_hasta": (
                    p.vigente_hasta.isoformat() if p and p.vigente_hasta else None
                ),
            }
        )
    return jsonify(out)


@app.post("/api/insumos")
def crear_insumo():
    data = request.get_json(silent=True) or {}
    nombre = (data.get("nombre") or "").strip()
    unidad = (data.get("unidad") or "").strip()
    unidad_compra = (data.get("unidad_compra") or unidad).strip()
    factor_conversion = float(data.get("factor_conversion") or 1)
    precio = float(data.get("precio") or 0)
    fecha = parse_fecha(data.get("fecha"))
    if not nombre or not unidad or not unidad_compra or factor_conversion <= 0:
        return jsonify({"error": "Nombre, unidades y contenido son obligatorios."}), 400

    insumo = Insumo(
        nombre=nombre,
        unidad=unidad,
        unidad_compra=unidad_compra,
        factor_conversion=factor_conversion,
        activa=bool(data.get("activa", True)),
    )
    db.session.add(insumo)
    db.session.flush()
    db.session.add(
        PrecioInsumo(insumo_id=insumo.id, precio=precio, vigente_desde=fecha)
    )
    db.session.commit()
    return (
        jsonify(
            {
                "id": insumo.id,
                "nombre": insumo.nombre,
                "unidad": insumo.unidad,
                "unidad_compra": insumo.unidad_compra,
                "factor_conversion": insumo.factor_conversion,
                "activa": insumo.activa,
                "precio": precio,
                "vigente_desde": fecha.isoformat(),
            }
        ),
        201,
    )


@app.put("/api/insumos/<int:insumo_id>")
def actualizar_insumo(insumo_id):
    insumo = db.session.get(Insumo, insumo_id)
    if not insumo:
        return jsonify({"error": "Insumo no encontrado."}), 404

    data = request.get_json(silent=True) or {}
    nombre = (data.get("nombre") or "").strip()
    unidad = (data.get("unidad") or "").strip()
    unidad_compra = (data.get("unidad_compra") or unidad).strip()
    factor_conversion = float(data.get("factor_conversion") or 1)
    if not nombre or not unidad or not unidad_compra or factor_conversion <= 0:
        return jsonify({"error": "Nombre, unidades y contenido son obligatorios."}), 400

    insumo.nombre = nombre
    insumo.unidad = unidad
    insumo.unidad_compra = unidad_compra
    insumo.factor_conversion = factor_conversion
    if "activa" in data:
        insumo.activa = bool(data.get("activa"))
    db.session.commit()
    return jsonify(
        {
            "id": insumo.id,
            "nombre": insumo.nombre,
            "unidad": insumo.unidad,
            "unidad_compra": insumo.unidad_compra,
            "factor_conversion": insumo.factor_conversion,
            "activa": insumo.activa,
        }
    )


@app.post("/api/precios")
def actualizar_precios():
    """Recibe {"cambios": [{"insumo_id": 1, "precio": 38.0}, ...]}.
    Solo genera historial para los precios que de verdad cambian.
    """
    data = request.get_json(silent=True) or {}
    cambios = data.get("cambios", [])
    fecha = parse_fecha(data.get("fecha"))
    actualizados = []

    for c in cambios:
        insumo_id = c["insumo_id"]
        nuevo = float(c["precio"])
        if guardar_precio_desde(insumo_id, nuevo, fecha):
            actualizados.append(insumo_id)

    recalculados = recalcular_produccion_de_fecha(fecha) if actualizados else []
    db.session.commit()
    return jsonify(
        {
            "actualizados": actualizados,
            "fecha": fecha.isoformat(),
            "produccion_recalculada": recalculados,
        }
    )


# ---------- Recetas ----------
@app.get("/api/recetas")
def listar_recetas():
    incluir_inactivas = request.args.get("todas") == "1"
    query = Receta.query.order_by(Receta.nombre)
    if not incluir_inactivas:
        query = query.filter_by(activa=True)
    out = []
    for r in query.all():
        out.append(receta_json(r))
    return jsonify(out)


@app.post("/api/recetas")
def crear_receta():
    data = request.get_json(silent=True) or {}
    nombre = (data.get("nombre") or "").strip()
    rendimiento_vasos = int(data.get("rendimiento_vasos") or 0)
    volumen_jarra = float(data.get("volumen_jarra") or 0)
    insumos = data.get("insumos", [])

    if not nombre or rendimiento_vasos <= 0:
        return jsonify({"error": "Nombre y rendimiento son obligatorios."}), 400

    receta = Receta(
        nombre=nombre,
        rendimiento_vasos=rendimiento_vasos,
        volumen_jarra=volumen_jarra,
        activa=bool(data.get("activa", True)),
    )
    db.session.add(receta)
    db.session.flush()
    sync_receta_insumos(receta, insumos)
    db.session.commit()
    return jsonify(receta_json(receta)), 201


@app.put("/api/recetas/<int:receta_id>")
def actualizar_receta(receta_id):
    receta = db.session.get(Receta, receta_id)
    if not receta:
        return jsonify({"error": "Receta no encontrada."}), 404

    data = request.get_json(silent=True) or {}
    nombre = (data.get("nombre") or "").strip()
    rendimiento_vasos = int(data.get("rendimiento_vasos") or 0)
    volumen_jarra = float(data.get("volumen_jarra") or 0)

    if not nombre or rendimiento_vasos <= 0:
        return jsonify({"error": "Nombre y rendimiento son obligatorios."}), 400

    receta.nombre = nombre
    receta.rendimiento_vasos = rendimiento_vasos
    receta.volumen_jarra = volumen_jarra
    receta.activa = bool(data.get("activa", receta.activa))
    sync_receta_insumos(receta, data.get("insumos", []))
    db.session.commit()
    return jsonify(receta_json(receta))


@app.delete("/api/recetas/<int:receta_id>")
def desactivar_receta(receta_id):
    receta = db.session.get(Receta, receta_id)
    if not receta:
        return jsonify({"error": "Receta no encontrada."}), 404
    receta.activa = False
    db.session.commit()
    return jsonify({"ok": True})


# ---------- Produccion ----------
@app.post("/api/produccion")
def registrar_produccion():
    """Recibe {"fecha": "2026-06-04", "items": [{"receta_id": 1, "aguas": 100}]}.
    Calcula con los precios vigentes de esa fecha y guarda el costo congelado.
    """
    data = request.get_json(silent=True) or {}
    fecha = parse_fecha(data.get("fecha"))
    modo = get_config("modo_costeo", "LLENADORAS_COMPLETAS")
    items = data.get("items", [])

    # Si ya habia produccion de esa fecha, se reemplaza (recalculo del dia)
    for viejo in Produccion.query.filter_by(fecha=fecha).all():
        db.session.delete(viejo)

    resultados = []
    advertencias = []
    for it in items:
        receta = db.session.get(Receta, it["receta_id"])
        if not receta:
            continue
        aguas = int(it.get("aguas", it.get("vasos", it.get("llenadoras", 0))))
        calc = calcular(receta, aguas, fecha, modo)
        advertencias.extend(calc.get("advertencias", []))

        prod = Produccion(
            fecha=fecha,
            receta_id=receta.id,
            vasos=aguas,
            modo_costeo=modo,
            costo_total=calc["costo_total"],
            costo_por_vaso=calc["costo_por_agua"],
        )
        db.session.add(prod)
        db.session.flush()
        for d in calc["detalles"]:
            db.session.add(
                ProduccionDetalle(
                    produccion_id=prod.id,
                    insumo_id=d["insumo_id"],
                    nombre_insumo=d["nombre_insumo"],
                    cantidad=d["cantidad"],
                    precio_usado=d["precio_usado"],
                    subtotal=d["subtotal"],
                )
            )

        resultados.append(
            {
                "receta": receta.nombre,
                "llenadoras": round(aguas / (receta.rendimiento_vasos or 160), 2),
                "botellas": aguas,
                "vasos": aguas,
                "aguas": aguas,
                **calc,
            }
        )

    db.session.commit()
    return jsonify(
        {
            "fecha": fecha.isoformat(),
            "modo_costeo": modo,
            "resultados": resultados,
            "advertencias": advertencias,
        }
    )


# ---------- Dashboard ----------
@app.get("/api/dashboard")
def dashboard():
    fecha = parse_fecha(request.args.get("fecha"))
    prods = Produccion.query.filter_by(fecha=fecha).all()
    advertencias = []
    for p in prods:
        if p.costo_total > 0:
            continue
        if not p.detalles:
            advertencias.append(
                f"{p.receta.nombre}: no hay detalle de insumos guardado para esta producción."
            )
            continue
        for d in p.detalles:
            if d.cantidad <= 0:
                advertencias.append(
                    f"{p.receta.nombre}: {d.nombre_insumo} tiene cantidad 0 en la receta."
                )
            if d.precio_usado <= 0:
                advertencias.append(
                    f"{p.receta.nombre}: {d.nombre_insumo} no tiene precio vigente mayor a 0."
                )
    por_sabor = [
        {
            "receta": p.receta.nombre,
            "llenadoras": round(p.vasos / (p.receta.rendimiento_vasos or 160), 2),
            "botellas": p.vasos,
            "vasos": p.vasos,
            "aguas": p.vasos,
            "costo_total": p.costo_total,
            "costo_por_vaso": p.costo_por_vaso,
            "costo_por_agua": p.costo_por_vaso,
            "costo_por_botella": p.costo_por_vaso,
        }
        for p in prods
    ]
    total = round(sum(p.costo_total for p in prods), 2)
    return jsonify(
        {
            "fecha": fecha.isoformat(),
            "total": total,
            "por_sabor": por_sabor,
            "advertencias": advertencias,
        }
    )


@app.get("/api/dashboard/historico")
def dashboard_historico():
    periodo = request.args.get("periodo", "mes")
    if periodo == "anio":
        anio = parse_anio(request.args.get("anio"))
        inicio = date(anio, 1, 1)
        fin = date(anio, 12, 31)
        etiqueta = str(anio)
    else:
        inicio = parse_mes(request.args.get("mes"))
        fin = date(inicio.year, inicio.month, monthrange(inicio.year, inicio.month)[1])
        etiqueta = inicio.strftime("%Y-%m")
        periodo = "mes"

    prods = (
        Produccion.query.filter(Produccion.fecha >= inicio)
        .filter(Produccion.fecha <= fin)
        .order_by(Produccion.fecha, Produccion.id)
        .all()
    )

    por_dia = {}
    sabores = set()
    for p in prods:
        fecha_key = p.fecha.isoformat()
        receta = p.receta.nombre
        sabores.add(receta)
        dia = por_dia.setdefault(
            fecha_key,
            {
                "fecha": fecha_key,
                "total": 0.0,
                "llenadoras": 0,
                "aguas": 0,
                "por_sabor": {},
            },
        )
        aguas = p.vasos
        sabor = dia["por_sabor"].setdefault(
            receta,
            {
                "receta": receta,
                "costo_total": 0.0,
                "llenadoras": 0,
                "aguas": 0,
            },
        )
        dia["total"] += p.costo_total
        dia["llenadoras"] += p.vasos / (p.receta.rendimiento_vasos or 160)
        dia["aguas"] += aguas
        sabor["costo_total"] += p.costo_total
        sabor["llenadoras"] += p.vasos / (p.receta.rendimiento_vasos or 160)
        sabor["aguas"] += aguas

    dias = []
    for dia in por_dia.values():
        dia["total"] = round(dia["total"], 2)
        dia["por_sabor"] = [
            {
                **sabor,
                "costo_total": round(sabor["costo_total"], 2),
            }
            for sabor in dia["por_sabor"].values()
        ]
        dias.append(dia)

    total_periodo = round(sum(d["total"] for d in dias), 2)
    return jsonify(
        {
            "periodo": periodo,
            "etiqueta": etiqueta,
            "mes": inicio.strftime("%Y-%m"),
            "anio": inicio.year,
            "desde": inicio.isoformat(),
            "hasta": fin.isoformat(),
            "sabores": sorted(sabores),
            "dias": dias,
            "total_mes": total_periodo,
            "total_periodo": total_periodo,
        }
    )


# ---------- Config ----------
@app.get("/api/config")
def get_cfg():
    return jsonify({c.clave: c.valor for c in Config.query.all()})


@app.put("/api/config")
def put_cfg():
    data = request.get_json(silent=True) or {}
    for k, v in data.items():
        c = Config.query.filter_by(clave=k).first()
        if c:
            c.valor = str(v)
        else:
            db.session.add(Config(clave=k, valor=str(v)))
    db.session.commit()
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
