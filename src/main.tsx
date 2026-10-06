import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./brand.tokens.css";
import "./style.css";
import "./brand.motion.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
