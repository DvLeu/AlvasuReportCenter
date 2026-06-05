"""
Crea las tablas y carga el catalogo inicial de insumos y recetas.
Ejecutar una sola vez:  python3 seed.py
"""
from datetime import date

from models import db, Receta, Insumo, RecetaInsumo, PrecioInsumo, Config

# Insumo -> (unidad_receta, unidad_compra, contenido_compra, precio_compra)
INSUMOS = {
    "Jarabe Horchata": ("l", "garrafa", 5, 420),
    "Leche Clavel": ("l", "l", 1, 58),
    "Agua": ("l", "garrafón", 20, 35),
    "Concentrado de Vainilla": ("l", "botella", 1, 95),
    "Botella": ("pza", "caja", 100, 240),
    "Jamaica": ("kg", "kg", 1, 160),
    "Azúcar": ("kg", "costal", 50, 950),
    "Pulpa de Maracuya": ("kg", "cubeta", 5, 520),
    "Limón": ("kg", "kg", 1, 38),
}

# Receta -> (rendimiento_aguas_por_llenadora, volumen_llenadora_litros, {insumo: cantidad_por_llenadora})
RECETAS = {
    "Horchata": (160, 80.0, {
        "Jarabe Horchata": 4.0,
        "Leche Clavel": 3.0,
        "Agua": 72.0,
        "Concentrado de Vainilla": 0.25,
        "Botella": 160.0,
    }),
    "Jamaica": (160, 80.0, {
        "Jamaica": 1.6,
        "Agua": 80.0,
        "Azúcar": 8.0,
        "Botella": 160.0,
    }),
    "Maracuya": (160, 80.0, {
        "Pulpa de Maracuya": 8.0,
        "Agua": 80.0,
        "Azúcar": 6.0,
        "Botella": 160.0,
    }),
    "Limón": (160, 80.0, {
        "Limón": 6.0,
        "Agua": 80.0,
        "Azúcar": 7.0,
        "Botella": 160.0,
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
