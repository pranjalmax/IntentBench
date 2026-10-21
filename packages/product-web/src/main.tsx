import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/manrope";
import "@fontsource-variable/source-serif-4";
import { App } from "./workbench.js";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Application root is missing");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
