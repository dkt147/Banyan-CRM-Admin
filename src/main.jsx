// Must run first: every date on screen is shown in Hong Kong time.
import "./utils/hkDefaultTimeZone";
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import "./tokens.css";
import "./styles.css";
import "./brevo-theme.css";
import "./crm-ui.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
