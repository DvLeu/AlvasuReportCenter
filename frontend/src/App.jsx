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
      className="brand-mark"
      viewBox="0 0 64 64"
      role="img"
      aria-labelledby="alvasu-logo-title"
    >
      <title id="alvasu-logo-title">Alvasu</title>
      <defs>
        <linearGradient id="markBg" x1="10" y1="6" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#32b5e8" />
          <stop offset="1" stopColor="#0d6f9f" />
        </linearGradient>
        <filter id="markShadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#0f2530" floodOpacity="0.18" />
        </filter>
      </defs>
      <rect x="7" y="7" width="50" height="50" rx="14" fill="url(#markBg)" filter="url(#markShadow)" />
      <path d="M20 44 31.8 16 44 44" fill="none" stroke="#ffffff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24.5 35.5h15" fill="none" stroke="#ffffff" strokeWidth="5.5" strokeLinecap="round" />
      <text
        x="32"
        y="51"
        textAnchor="middle"
        fill="#dff7ff"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="7"
        fontWeight="700"
        letterSpacing="1"
      >
        COSTOS
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
      <footer className="app-footer">
        <span>Alvasu 2026</span>
        <span aria-hidden="true">·</span>
        <span>
          Made with{" "}
          <svg
            className="footer-heart"
            viewBox="0 0 1792 1792"
            preserveAspectRatio="xMidYMid meet"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="love"
            role="img"
          >
            <path
              d="M896 1664q-26 0-44-18l-624-602q-10-8-27.5-26T145 952.5 77 855 23.5 734 0 596q0-220 127-344t351-124q62 0 126.5 21.5t120 58T820 276t76 68q36-36 76-68t95.5-68.5 120-58T1314 128q224 0 351 124t127 344q0 221-229 450l-623 600q-18 18-44 18z"
              fill="#e25555"
            />
          </svg>{" "}
          in Mexico by{" "}
          <a href="https://www.dvleu.dev/" target="_blank" rel="noreferrer">
            David Leon Salas AKA "Dvleu"
          </a>
        </span>
      </footer>
    </div>
  );
}
