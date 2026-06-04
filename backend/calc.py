"""
Logica de calculo de costos. Toda la aritmetica vive aqui (en el backend),
no en la base de datos, para que sea portable entre SQLite y PostgreSQL.
"""

from models import PrecioInsumo


def precio_vigente(insumo_id, fecha):
    """Precio que estaba activo para un insumo en una fecha dada.

    Rango de vigencia [vigente_desde, vigente_hasta) con limite superior exclusivo.
    """
    p = (
        PrecioInsumo.query.filter(PrecioInsumo.insumo_id == insumo_id)
        .filter(PrecioInsumo.vigente_desde <= fecha)
        .filter(
            (PrecioInsumo.vigente_hasta.is_(None))
            | (PrecioInsumo.vigente_hasta > fecha)
        )
        .order_by(PrecioInsumo.vigente_desde.desc())
        .first()
    )
    return p.precio if p else 0.0


def calcular(receta, aguas, fecha, modo=None):
    """Calcula el costo de producir una cantidad de aguas de una receta."""
    aguas_por_llenadora = receta.rendimiento_vasos or 160
    aguas_producidas = aguas if aguas > 0 else 0
    factor = aguas_producidas / aguas_por_llenadora if aguas_por_llenadora > 0 else 0

    detalles = []
    advertencias = []
    costo_total = 0.0
    if not receta.insumos:
        advertencias.append(f"{receta.nombre} no tiene ingredientes capturados.")

    for ri in receta.insumos:
        precio_compra = precio_vigente(ri.insumo_id, fecha)
        factor_conversion = ri.insumo.factor_conversion or 1
        precio = (
            precio_compra / factor_conversion
            if factor_conversion > 0
            else precio_compra
        )
        cantidad = ri.cantidad_por_jarra * factor
        subtotal = cantidad * precio
        costo_total += subtotal
        if ri.cantidad_por_jarra <= 0:
            advertencias.append(
                f"{receta.nombre}: {ri.insumo.nombre} tiene cantidad 0 en la receta."
            )
        if precio_compra <= 0:
            advertencias.append(
                f"{receta.nombre}: {ri.insumo.nombre} no tiene precio vigente mayor a 0."
            )
        detalles.append(
            {
                "insumo_id": ri.insumo_id,
                "nombre_insumo": ri.insumo.nombre,
                "cantidad": round(cantidad, 4),
                "unidad_uso": ri.insumo.unidad,
                "unidad_compra": ri.insumo.unidad_compra or ri.insumo.unidad,
                "factor_conversion": round(factor_conversion, 4),
                "cantidad_compra": (
                    round(cantidad / factor_conversion, 4)
                    if factor_conversion > 0
                    else round(cantidad, 4)
                ),
                "precio_compra": round(precio_compra, 2),
                "precio_usado": round(precio, 2),
                "subtotal": round(subtotal, 2),
            }
        )

    aguas_totales = aguas_producidas
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
