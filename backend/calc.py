"""
Logica de calculo de costos. Toda la aritmetica vive aqui (en el backend),
no en la base de datos, para que sea portable entre SQLite y PostgreSQL.
"""
import math
from models import PrecioInsumo


def precio_vigente(insumo_id, fecha):
    """Precio que estaba activo para un insumo en una fecha dada.

    Rango de vigencia [vigente_desde, vigente_hasta) con limite superior exclusivo.
    """
    p = (PrecioInsumo.query
         .filter(PrecioInsumo.insumo_id == insumo_id)
         .filter(PrecioInsumo.vigente_desde <= fecha)
         .filter((PrecioInsumo.vigente_hasta.is_(None)) |
                 (PrecioInsumo.vigente_hasta > fecha))
         .order_by(PrecioInsumo.vigente_desde.desc())
         .first())
    return p.precio if p else 0.0


def calcular(receta, llenadoras, fecha, modo):
    """Calcula el costo de producir `llenadoras` de una receta en una fecha.

    LLENADORAS_COMPLETAS: se redondea hacia arriba a llenadoras enteras (gasto real).
    PROPORCIONAL: se usa el costo exacto por llenadora (analisis teorico).
    """
    aguas_por_llenadora = receta.rendimiento_vasos or 160
    if modo == "LLENADORAS_COMPLETAS":
        llenadoras_costeadas = math.ceil(llenadoras) if llenadoras > 0 else 0
        factor = llenadoras_costeadas
    else:  # PROPORCIONAL
        llenadoras_costeadas = llenadoras if llenadoras > 0 else 0
        factor = llenadoras_costeadas

    detalles = []
    advertencias = []
    costo_total = 0.0
    if not receta.insumos:
        advertencias.append(f"{receta.nombre} no tiene ingredientes capturados.")

    for ri in receta.insumos:
        precio = precio_vigente(ri.insumo_id, fecha)
        cantidad = ri.cantidad_por_jarra * factor
        subtotal = cantidad * precio
        costo_total += subtotal
        if ri.cantidad_por_jarra <= 0:
            advertencias.append(
                f"{receta.nombre}: {ri.insumo.nombre} tiene cantidad 0 en la receta."
            )
        if precio <= 0:
            advertencias.append(
                f"{receta.nombre}: {ri.insumo.nombre} no tiene precio vigente mayor a 0."
            )
        detalles.append({
            "insumo_id": ri.insumo_id,
            "nombre_insumo": ri.insumo.nombre,
            "cantidad": round(cantidad, 4),
            "precio_usado": round(precio, 2),
            "subtotal": round(subtotal, 2),
        })

    aguas_totales = llenadoras_costeadas * aguas_por_llenadora
    costo_por_agua = (costo_total / aguas_totales) if aguas_totales > 0 else 0.0
    return {
        "costo_total": round(costo_total, 2),
        "aguas_totales": round(aguas_totales, 2),
        "costo_por_agua": round(costo_por_agua, 4),
        "costo_por_vaso": round(costo_por_agua, 4),
        "costo_por_botella": round(costo_por_agua, 4),
        "detalles": detalles,
        "advertencias": advertencias,
    }
