import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { DefaultProviders } from "@/components/providers/default";
import App from "@/App";
import "@/styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DefaultProviders>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </DefaultProviders>
  </StrictMode>,
);
