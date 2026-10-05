import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppearanceProvider } from "./Appearance";
import "./style.css";
import "./appearance.css";
import "./reconstruction.css";
import "./convergence.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppearanceProvider>
      <App />
    </AppearanceProvider>
  </React.StrictMode>,
);
