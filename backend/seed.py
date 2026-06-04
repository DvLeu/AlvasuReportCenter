"""
Crea las tablas y carga el catalogo inicial de insumos y recetas.
Ejecutar una sola vez:  python3 seed.py
"""
from datetime import date

from models import db, Receta, Insumo, RecetaInsumo, PrecioInsumo, Config

# Insumo -> (unidad, precio inicial)
INSUMOS = {
    "Jarabe": ("l", 0),
    "Leche Clavel": ("l", 0),
    "Agua": ("l", 0),
    "Vainilla": ("l", 0),
    "Botella": ("pza", 0),
    "Jamaica": ("kg", 0),
    "Azúcar": ("kg", 0),
    "Pulpa": ("kg", 0),
    "Limón": ("kg", 0),
}

# Receta -> (rendimiento_aguas_por_llenadora, volumen_llenadora_litros, {insumo: cantidad_por_llenadora})
RECETAS = {
    "Horchata": (160, 80.0, {
        "Jarabe": 0.0, "Leche Clavel": 0.0, "Agua": 0.0, "Vainilla": 0.0, "Botella": 0.0,
    }),
    "Jamaica": (160, 80.0, {
        "Jamaica": 0.0, "Agua": 0.0, "Azúcar": 0.0, "Botella": 0.0,
    }),
    "Maracuya": (160, 80.0, {
        "Pulpa": 0.0, "Agua": 0.0, "Azúcar": 0.0, "Botella": 0.0,
    }),
    "Limón": (160, 80.0, {
        "Limón": 0.0, "Agua": 0.0, "Azúcar": 0.0, "Botella": 0.0,
    }),
}


SEED_CONFIG_KEY = "seed_catalogo_inicial"


def cargar_catalogo_inicial(hoy=None):
    """Inserta catalogo base. Asume que se llama dentro de app_context."""
    hoy = hoy or date.today()

    insumo_obj = {}
    for nombre, (unidad, precio) in INSUMOS.items():
        ins = Insumo(
            nombre=nombre,
            unidad=unidad,
            unidad_compra=unidad,
            factor_conversion=1,
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
    """Reinicia la base completa. Usar solo manualmente."""
    from app import app

    with app.app_context():
        db.drop_all()
        db.create_all()
        cargar_catalogo_inicial()
        db.session.commit()
        print("Base de datos creada y poblada con datos de ejemplo.")


if __name__ == "__main__":
    seed()
