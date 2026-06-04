const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const path = require("path");

let flask = null;

// AGUAS_DEV=1 carga el servidor de Vite (desarrollo).
// Sin esa variable, carga el build de produccion (frontend/dist).
const DEV = !!process.env.AGUAS_DEV;

function startFlask() {
  const backend = path.join(__dirname, "..", "backend");
  const py = process.platform === "win32" ? "python" : "python3";
  // Usa el python del venv si existe; si no, el del sistema.
  const venvPy =
    process.platform === "win32"
      ? path.join(backend, ".venv", "Scripts", "python.exe")
      : path.join(backend, ".venv", "bin", "python3");
  const fs = require("fs");
  const interp = fs.existsSync(venvPy) ? venvPy : py;

  flask = spawn(interp, ["app.py"], { cwd: backend, stdio: "inherit" });
  flask.on("error", (e) => console.error("No se pudo iniciar Flask:", e));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 740,
    minWidth: 720,
    backgroundColor: "#f6f3ec",
    webPreferences: { contextIsolation: true },
  });

  if (DEV) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "..", "frontend", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  startFlask();
  // Pequeña espera para que Flask alcance a levantar antes de la primera petición.
  setTimeout(createWindow, 1500);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (flask) flask.kill();
  if (process.platform !== "darwin") app.quit();
});
