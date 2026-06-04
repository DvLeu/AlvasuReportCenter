"""
Crea las tablas y carga el catalogo inicial de insumos y recetas.
Ejecutar una sola vez:  python3 seed.py
"""
from datetime import date

from app import app
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


def seed():
    with app.app_context():
        db.drop_all()
        db.create_all()
        hoy = date.today()

        insumo_obj = {}
        for nombre, (unidad, precio) in INSUMOS.items():
            ins = Insumo(nombre=nombre, unidad=unidad)
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

        db.session.add(Config(clave="modo_costeo", valor="LLENADORAS_COMPLETAS"))
        db.session.commit()
        print("Base de datos creada y poblada con datos de ejemplo.")


if __name__ == "__main__":
    seed()
