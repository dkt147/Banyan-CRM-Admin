// Must run first: every date on screen is shown in Hong Kong time.
import "./utils/hkDefaultTimeZone";
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import GoogleOAuthReturn from "./components/GoogleOAuthReturn";
import { googleOAuthReturnMode } from "./utils/googleOAuth";
import { AuthProvider } from "./auth/AuthContext";
import "./tokens.css";
import "./styles.css";
import "./brevo-theme.css";
import "./crm-ui.css";

const root = createRoot(document.getElementById("root"));
// The Google sign-in popup returns to /integrations?google_oauth=…: show a small result
// page there (and close it) instead of loading the whole CRM inside the popup.
if (googleOAuthReturnMode() === "popup") {
  root.render(<GoogleOAuthReturn />);
} else {
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>,
  );
}
