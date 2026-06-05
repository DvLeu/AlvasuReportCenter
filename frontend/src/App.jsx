import React, { useEffect, useState } from "react";
import Precios from "./pages/Precios.jsx";
import Produccion from "./pages/Produccion.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Recetas from "./pages/Recetas.jsx";

const TABS = [
  { id: "precios", label: "Insumos", comp: Precios },
  { id: "recetas", label: "Recetas", comp: Recetas },
  { id: "produccion", label: "Producción", comp: Produccion },
  { id: "dashboard", label: "Resumen", comp: Dashboard },
];

function AlvasuLogo() {
  return (
    <svg
      className="brand-logo"
      viewBox="0 0 760 250"
      role="img"
      aria-labelledby="alvasu-logo-title"
    >
      <title id="alvasu-logo-title">Alvasu más natural imposible</title>
      <defs>
        <linearGradient id="logoBg" x1="0" y1="0" x2="0" y2="250" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#27a9df" />
          <stop offset="0.5" stopColor="#cfe8f7" />
          <stop offset="0.78" stopColor="#ffffff" />
          <stop offset="1" stopColor="#fff7ba" />
        </linearGradient>
        <linearGradient id="letterFill" x1="120" y1="44" x2="650" y2="162" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#109bd5" />
          <stop offset="0.55" stopColor="#087fbd" />
          <stop offset="1" stopColor="#006aa6" />
        </linearGradient>
        <linearGradient id="letterWave" x1="110" y1="114" x2="650" y2="154" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00689f" />
          <stop offset="1" stopColor="#004f83" />
        </linearGradient>
        <filter id="wordShadow" x="-4%" y="-12%" width="108%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.4" floodColor="#075d91" floodOpacity="0.26" />
        </filter>
      </defs>

      <rect x="0" y="0" width="760" height="250" rx="26" fill="url(#logoBg)" />

      <g filter="url(#wordShadow)">
        <text
          x="380"
          y="148"
          textAnchor="middle"
          fill="url(#letterFill)"
          stroke="#ffffff"
          strokeWidth="12"
          paintOrder="stroke"
          fontFamily="Arial Black, Montserrat, system-ui, sans-serif"
          fontSize="122"
          fontWeight="900"
          letterSpacing="2"
        >
          Alvasu
        </text>
        <text
          x="380"
          y="148"
          textAnchor="middle"
          fill="url(#letterFill)"
          stroke="#ffffff"
          strokeWidth="12"
          paintOrder="stroke"
          fontFamily="Arial Black, Montserrat, system-ui, sans-serif"
          fontSize="122"
          fontWeight="900"
          letterSpacing="2"
        >
          Alvasu
        </text>
      </g>

      <text
        x="385"
        y="205"
        textAnchor="middle"
        fill="#087fbd"
        stroke="#ffffff"
        strokeWidth="5"
        paintOrder="stroke"
        fontFamily="DM Sans, Arial, system-ui, sans-serif"
        fontSize="39"
        fontStyle="italic"
        fontWeight="800"
        letterSpacing="8"
      >
        más natural imposible
      </text>
    </svg>
  );
}

export default function App() {
  const [tab, setTab] = useState("precios");
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const Active = TABS.find((t) => t.id === tab).comp;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <AlvasuLogo />
          <div>
            <h1>Alvasu</h1>
            <p>Control de costos</p>
          </div>
        </div>
        <div className="topbar-actions">
          <nav className="tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={"tab" + (tab === t.id ? " active" : "")}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <button
            className="theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-pressed={theme === "dark"}
            aria-label={theme === "dark" ? "Usar modo claro" : "Usar modo oscuro"}
            title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
          >
            <span className="theme-toggle-icon" aria-hidden="true" />
            <span>{theme === "dark" ? "Claro" : "Oscuro"}</span>
          </button>
        </div>
      </header>
      <main>
        <Active theme={theme} />
      </main>
    </div>
  );
}
