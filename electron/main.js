const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const DEV = !!process.env.AGUAS_DEV;
const ICON_PATH =
  process.platform === "win32"
    ? path.join(__dirname, "assets", "alvasu-logo.ico")
    : path.join(__dirname, "assets", "alvasu-logo.png");

app.setName("Alvasu Cost Report");
if (process.platform === "win32") {
  app.setAppUserModelId("com.alvasu.reportcenter");
}

let flask = null;
let vite = null;

function killProcess(child) {
  if (!child) return;

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", child.pid, "/f", "/t"]);
  } else {
    child.kill();
  }
}

function cleanupProcesses() {
  killProcess(vite);
  killProcess(flask);
  vite = null;
  flask = null;
}

function startVite() {
  if (!DEV) return;

  vite = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1"], {
    cwd: path.join(__dirname, "..", "frontend"),
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  vite.on("error", (e) => console.error("No se pudo iniciar Vite:", e));
}

function startFlask() {
  const backend = path.join(__dirname, "..", "backend");
  const py = process.platform === "win32" ? "python" : "python3";
  const venvPy =
    process.platform === "win32"
      ? path.join(backend, ".venv", "Scripts", "python.exe")
      : path.join(backend, ".venv", "bin", "python3");
  const interp = fs.existsSync(venvPy) ? venvPy : py;

  flask = spawn(interp, ["app.py"], { cwd: backend, stdio: "inherit" });
  flask.on("error", (e) => console.error("No se pudo iniciar Flask:", e));
}

function createWindow() {
  const win = new BrowserWindow({
    title: "Alvasu Cost Report",
    width: 1100,
    height: 740,
    minWidth: 720,
    icon: ICON_PATH,
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
  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(ICON_PATH);
  }
  startVite();
  startFlask();
  setTimeout(createWindow, 2000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  cleanupProcesses();
});

app.on("window-all-closed", () => {
  cleanupProcesses();
  app.quit();
});
