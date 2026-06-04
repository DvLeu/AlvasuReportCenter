# Calculadora de costos de aguas frescas

MVP con **React** (frontend) + **Flask** (backend, Python) + **SQLite** + **Electron** (escritorio).

El cálculo de costos vive en el backend, así que es el mismo sin importar la base de
datos. Empieza con SQLite local y se puede migrar a PostgreSQL en la nube sin tocar la lógica.

## Estructura

```
aguas-costos/
├── backend/     API Flask + SQLite + lógica de cálculo
├── frontend/    React + Vite (UI)
└── electron/    Envoltura de escritorio
```

## Requisitos (Linux)

- Python 3.10+
- Node.js 18+ y npm

## 1. Backend (Flask)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 seed.py        # crea la base y carga datos de ejemplo (una sola vez)
python3 app.py         # corre la API en http://127.0.0.1:5000
```

## 2. Frontend (React)

En otra terminal:

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

Con el backend y el frontend corriendo, ya puedes usar la app en el navegador.

## 3. Escritorio (Electron)

Electron levanta el backend solo y muestra la app en una ventana.

**Modo desarrollo** (usa el servidor de Vite; deja `npm run dev` corriendo):

```bash
cd frontend && npm run dev          # terminal A
cd electron && npm install
AGUAS_DEV=1 npm start               # terminal B
```

**Modo producción** (empaqueta el frontend; no necesita Vite corriendo):

```bash
cd frontend && npm run build        # genera frontend/dist
cd ../electron && npm install && npm start
```

## Qué hace cada parte

- **Precios**: editar el precio por kilo de cada insumo. Solo los que cambian generan
  un registro nuevo en el historial; los demás conservan su precio y su fecha.
- **Producción**: capturar las aguas por sabor del día. El costo se calcula con los
  precios vigentes de esa fecha y se guarda congelado.
- **Dashboard**: costo total y por sabor de una fecha.

## Modo de costeo

En la tabla `configuracion`, la clave `modo_costeo` admite:

- `JARRAS_COMPLETAS`: redondea a jarras enteras (gasto real de insumos). *(por defecto)*
- `PROPORCIONAL`: costo exacto por vaso (análisis teórico).

Se puede cambiar con `PUT /api/config` enviando `{"modo_costeo": "PROPORCIONAL"}`.

## Migrar a PostgreSQL (cuando quieras la versión web)

Cambia la línea `SQLALCHEMY_DATABASE_URI` en `backend/app.py` por la cadena de
PostgreSQL (e instala `psycopg2-binary`). El resto del código no cambia.
