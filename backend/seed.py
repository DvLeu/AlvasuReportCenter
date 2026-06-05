"""
Crea las tablas y carga el catalogo inicial de insumos y recetas.

El seed normal es idempotente: solo carga datos cuando la base esta vacia.
Para reiniciar todo manualmente usar: python seed.py --reset
"""
import sys
import os
from datetime import date

from models import db, Receta, Insumo, RecetaInsumo, PrecioInsumo, Config

# Insumo -> (unidad_receta, unidad_compra, contenido_compra, precio_compra)
# Precios iniciales aproximados en MXN para Mexico. Son editables desde la app.
INSUMOS = {
    "Jarabe concentrado sabor horchata": ("l", "garrafa 5 l", 5, 450),
    "Leche evaporada Carnation Clavel": ("l", "envase 1 l", 1, 65),
    "Agua purificada": ("l", "garrafón 20 l", 20, 38),
    "Concentrado de vainilla": ("ml", "botella 500 ml", 500, 120),
    "Botella PET 500 ml con tapa": ("pza", "caja 100 pzas", 100, 320),
    "Flor de jamaica seca": ("kg", "kg", 1, 180),
    "Azúcar estándar": ("kg", "costal 50 kg", 50, 1250),
    "Pulpa de maracuyá": ("kg", "cubeta 5 kg", 5, 650),
    "Limón persa": ("kg", "kg", 1, 45),
}

# Receta -> (rendimiento_aguas_por_llenadora, volumen_llenadora_litros, {insumo: cantidad_por_llenadora})
RECETAS = {
    "Horchata": (160, 80.0, {
        "Jarabe concentrado sabor horchata": 4.0,
        "Leche evaporada Carnation Clavel": 3.0,
        "Agua purificada": 72.0,
        "Concentrado de vainilla": 0.25,
        "Botella PET 500 ml con tapa": 160.0,
    }),
    "Jamaica": (160, 80.0, {
        "Flor de jamaica seca": 1.6,
        "Agua purificada": 80.0,
        "Azúcar estándar": 8.0,
        "Botella PET 500 ml con tapa": 160.0,
    }),
    "Maracuyá": (160, 80.0, {
        "Pulpa de maracuyá": 8.0,
        "Agua purificada": 80.0,
        "Azúcar estándar": 6.0,
        "Botella PET 500 ml con tapa": 160.0,
    }),
    "Limón": (160, 80.0, {
        "Limón persa": 6.0,
        "Agua purificada": 80.0,
        "Azúcar estándar": 7.0,
        "Botella PET 500 ml con tapa": 160.0,
    }),
}


SEED_CONFIG_KEY = "seed_catalogo_inicial"


def cargar_catalogo_inicial(hoy=None):
    """Inserta catalogo base. Asume que se llama dentro de app_context."""
    hoy = hoy or date.today()

    insumo_obj = {}
    for nombre, (unidad, unidad_compra, factor_conversion, precio) in INSUMOS.items():
        ins = Insumo(
            nombre=nombre,
            unidad=unidad,
            unidad_compra=unidad_compra,
            factor_conversion=factor_conversion,
            activa=True,
        )
        db.session.add(ins)
        db.session.flush()
        db.session.add(PrecioInsumo(insumo_id=ins.id, precio=precio,
                                    vigente_desde=hoy))
        insumo_obj[nombre] = ins

    for nombre, (rend, vol, comp) in RECETAS.items():
        rec = Receta(nombre=nombre, rendimiento_vasos=rend,
                     volumen_jarra=vol, activa=True)
        db.session.add(rec)
        db.session.flush()
        for ins_nombre, kg in comp.items():
            db.session.add(RecetaInsumo(
                receta_id=rec.id, insumo_id=insumo_obj[ins_nombre].id,
                cantidad_por_jarra=kg))

    if not Config.query.filter_by(clave="modo_costeo").first():
        db.session.add(Config(clave="modo_costeo", valor="LLENADORAS_COMPLETAS"))
    if not Config.query.filter_by(clave=SEED_CONFIG_KEY).first():
        db.session.add(Config(clave=SEED_CONFIG_KEY, valor=hoy.isoformat()))


def seed_if_empty():
    """Carga datos iniciales solo cuando la base esta vacia."""
    already_seeded = Config.query.filter_by(clave=SEED_CONFIG_KEY).first()
    has_catalog = Insumo.query.first() or Receta.query.first()

    if already_seeded:
        return False

    if has_catalog:
        db.session.add(Config(clave=SEED_CONFIG_KEY, valor="existing_catalog"))
        db.session.commit()
        return False

    cargar_catalogo_inicial()
    db.session.commit()
    return True


def seed():
    """Asegura tablas y carga el catalogo solo si aun no existe."""
    os.environ["AGUAS_SKIP_AUTO_BOOTSTRAP"] = "1"
    from app import app

    with app.app_context():
        db.create_all()
        created = seed_if_empty()
        if created:
            print("Catalogo inicial creado.")
        else:
            print("La base ya tenia catalogo; no se modifico el seed.")


def reset_seed():
    """Reinicia la base completa. Usar solo manualmente."""
    os.environ["AGUAS_SKIP_AUTO_BOOTSTRAP"] = "1"
    from app import app

    with app.app_context():
        db.drop_all()
        db.create_all()
        cargar_catalogo_inicial()
        db.session.commit()
        print("Base de datos reiniciada y poblada con el catalogo inicial.")


if __name__ == "__main__":
    if "--reset" in sys.argv:
        reset_seed()
    else:
        seed()
