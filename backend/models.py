"""
Modelos de la base de datos.

Idea central del historial de precios:
- PrecioInsumo guarda cada precio con un rango de vigencia [vigente_desde, vigente_hasta).
- El registro vigente actual tiene vigente_hasta = NULL.
- Cuando cambia un precio NO se sobrescribe: se cierra el anterior (vigente_hasta = hoy)
  y se inserta uno nuevo. Asi el pasado nunca se altera.
- El limite superior es EXCLUSIVO, para que un cambio el mismo dia tome efecto hoy
  sin solaparse con el precio que reemplaza.
"""

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Receta(db.Model):
    __tablename__ = "recetas"
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String, nullable=False)
    rendimiento_vasos = db.Column(
        db.Integer, nullable=False
    )  # aguas que rinde una llenadora
    volumen_jarra = db.Column(db.Float)  # litros (informativo)
    activa = db.Column(db.Boolean, default=True)
    insumos = db.relationship(
        "RecetaInsumo", backref="receta", cascade="all, delete-orphan"
    )


class Insumo(db.Model):
    __tablename__ = "insumos"
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String, nullable=False)
    unidad = db.Column(db.String, default="kg")  # unidad usada en receta
    unidad_compra = db.Column(db.String, default="kg")  # unidad del precio
    factor_conversion = db.Column(
        db.Float, default=1.0
    )  # unidad usada por unidad comprada
    activa = db.Column(db.Boolean, default=True)
    precios = db.relationship(
        "PrecioInsumo", backref="insumo", cascade="all, delete-orphan"
    )


class RecetaInsumo(db.Model):
    """Tabla puente: que insumos lleva una receta y cuanto usa por llenadora."""

    __tablename__ = "receta_insumos"
    id = db.Column(db.Integer, primary_key=True)
    receta_id = db.Column(db.Integer, db.ForeignKey("recetas.id"), nullable=False)
    insumo_id = db.Column(db.Integer, db.ForeignKey("insumos.id"), nullable=False)
    cantidad_por_jarra = db.Column(db.Float, nullable=False)  # en la unidad del insumo
    insumo = db.relationship("Insumo")


class PrecioInsumo(db.Model):
    """Historial de precios. Nunca se edita: se cierra y se inserta uno nuevo."""

    __tablename__ = "precios_insumo"
    id = db.Column(db.Integer, primary_key=True)
    insumo_id = db.Column(db.Integer, db.ForeignKey("insumos.id"), nullable=False)
    precio = db.Column(db.Float, nullable=False)  # $ por unidad del insumo
    vigente_desde = db.Column(db.Date, nullable=False)
    vigente_hasta = db.Column(db.Date)  # NULL = vigente actual


class Produccion(db.Model):
    """Produccion de un dia para un sabor. Guarda el costo YA calculado (congelado)."""

    __tablename__ = "produccion"
    id = db.Column(db.Integer, primary_key=True)
    fecha = db.Column(db.Date, nullable=False)
    receta_id = db.Column(db.Integer, db.ForeignKey("recetas.id"), nullable=False)
    vasos = db.Column(db.Integer, nullable=False)  # aguas producidas
    modo_costeo = db.Column(db.String, nullable=False)
    costo_total = db.Column(db.Float, nullable=False)
    costo_por_vaso = db.Column(db.Float, nullable=False)
    receta = db.relationship("Receta")
    detalles = db.relationship(
        "ProduccionDetalle", backref="produccion", cascade="all, delete-orphan"
    )


class ProduccionDetalle(db.Model):
    """Foto de cada insumo usado ese dia, con el precio que estaba vigente."""

    __tablename__ = "produccion_detalle"
    id = db.Column(db.Integer, primary_key=True)
    produccion_id = db.Column(
        db.Integer, db.ForeignKey("produccion.id"), nullable=False
    )
    insumo_id = db.Column(db.Integer, db.ForeignKey("insumos.id"), nullable=False)
    nombre_insumo = db.Column(db.String, nullable=False)
    cantidad = db.Column(db.Float, nullable=False)  # unidades totales usadas
    precio_usado = db.Column(db.Float, nullable=False)  # $ por unidad de ese momento
    subtotal = db.Column(db.Float, nullable=False)


class VentaDiaria(db.Model):
    """Ingreso/venta capturada por dia para calcular ganancia neta."""

    __tablename__ = "ventas_diarias"
    id = db.Column(db.Integer, primary_key=True)
    fecha = db.Column(db.Date, nullable=False, unique=True)
    venta_total = db.Column(db.Float, nullable=False, default=0.0)


class Config(db.Model):
    """Ajustes globales, p. ej. modo_costeo = LLENADORAS_COMPLETAS | PROPORCIONAL."""

    __tablename__ = "configuracion"
    id = db.Column(db.Integer, primary_key=True)
    clave = db.Column(db.String, unique=True, nullable=False)
    valor = db.Column(db.String, nullable=False)
