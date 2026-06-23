# Aguas Frescas Cost Calculator

Aguas Frescas Cost Calculator is a local desktop and browser app for tracking ingredient prices, recording daily production, and reviewing the cost of each agua fresca flavor.

The app uses a React interface, a Flask API, SQLite for local storage, and Electron for the desktop build. Cost calculations live in the backend, so browser and desktop runs use the same logic.

## Project Structure

```text
aguas-costos/
├── backend/     Flask API, SQLite database, and cost logic
├── frontend/    React + Vite interface
├── electron/    Desktop shell and packaging settings
└── scripts/     Build scripts
```

## Requirements

- Python 3.10 or newer
- Node.js 18 or newer
- npm

## Run the Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 seed.py
python3 app.py
```

The API runs at `http://127.0.0.1:5000`.

`seed.py` loads the starter catalog only when the database is empty. To reset the database and load the starter data again:

```bash
cd backend
python3 seed.py --reset
```

## Run the Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` while the backend is running.

## Run the Desktop App

Development mode uses the Vite server:

```bash
cd frontend
npm run dev
```

```bash
cd electron
npm install
AGUAS_DEV=1 npm start
```

Production mode uses the compiled frontend:

```bash
cd frontend
npm run build
cd ../electron
npm install
npm start
```

## Build the Windows Installer

From PowerShell on Windows:

```powershell
.\scripts\build-windows.ps1
```

The installer is created in `electron\dist`. It includes Electron, the compiled frontend, and the Flask backend packaged as `aguas-backend.exe`, so the target computer does not need Python or Node.js installed.

The SQLite database is stored in the user's Windows data folder, not inside Program Files. This allows the app to save prices, recipes, and production records without administrator permissions.

## Main Features

- **Prices**: update ingredient prices by kilogram. Only changed prices create a new history entry.
- **Production**: record daily production by flavor. Costs are calculated with the prices active on that date and saved with the record.
- **Dashboard**: review total cost and cost by flavor for a selected date.

## Costing Mode

The `modo_costeo` key in the `configuracion` table accepts two values:

- `JARRAS_COMPLETAS`: rounds production to full pitchers and reflects actual ingredient use. This is the default mode.
- `PROPORCIONAL`: calculates the exact theoretical cost per serving.

To change the mode, send a `PUT /api/config` request:

```json
{"modo_costeo": "PROPORCIONAL"}
```

---

# Calculadora de costos de aguas frescas

Calculadora de costos de aguas frescas es una app local de escritorio y navegador para administrar precios de insumos, capturar producción diaria y revisar el costo de cada sabor.

La app usa una interfaz en React, una API en Flask, SQLite como almacenamiento local y Electron para la versión de escritorio. Los cálculos de costos viven en el backend, así que el navegador y la app de escritorio usan la misma lógica.

## Estructura del proyecto

```text
aguas-costos/
├── backend/     API Flask, base SQLite y lógica de costos
├── frontend/    Interfaz React + Vite
├── electron/    Envoltura de escritorio y configuración de empaquetado
└── scripts/     Scripts de build
```

## Requisitos

- Python 3.10 o superior
- Node.js 18 o superior
- npm

## Ejecutar el backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 seed.py
python3 app.py
```

La API queda disponible en `http://127.0.0.1:5000`.

`seed.py` carga el catálogo inicial solo cuando la base está vacía. Para reiniciar la base y volver a cargar los datos iniciales:

```bash
cd backend
python3 seed.py --reset
```

## Ejecutar el frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173` mientras el backend está corriendo.

## Ejecutar la app de escritorio

El modo desarrollo usa el servidor de Vite:

```bash
cd frontend
npm run dev
```

```bash
cd electron
npm install
AGUAS_DEV=1 npm start
```

El modo producción usa el frontend compilado:

```bash
cd frontend
npm run build
cd ../electron
npm install
npm start
```

## Crear el instalador de Windows

Desde PowerShell en Windows:

```powershell
.\scripts\build-windows.ps1
```

El instalador se crea en `electron\dist`. Incluye Electron, el frontend compilado y el backend Flask empaquetado como `aguas-backend.exe`, así que la computadora destino no necesita tener Python ni Node.js instalados.

La base SQLite se guarda en la carpeta de datos del usuario de Windows, no dentro de Archivos de programa. Así la app puede guardar precios, recetas y registros de producción sin permisos de administrador.

## Funciones principales

- **Precios**: actualiza precios de insumos por kilogramo. Solo los cambios crean una entrada nueva en el historial.
- **Producción**: registra la producción diaria por sabor. Los costos se calculan con los precios vigentes de esa fecha y se guardan con el registro.
- **Dashboard**: muestra el costo total y el costo por sabor de una fecha seleccionada.

## Modo de costeo

La clave `modo_costeo` en la tabla `configuracion` acepta dos valores:

- `JARRAS_COMPLETAS`: redondea la producción a jarras completas y refleja el consumo real de insumos. Es el modo predeterminado.
- `PROPORCIONAL`: calcula el costo teórico exacto por vaso.

Para cambiar el modo, envía una petición `PUT /api/config`:

```json
{"modo_costeo": "PROPORCIONAL"}
```
