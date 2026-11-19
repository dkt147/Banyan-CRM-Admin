import React, { useEffect, useState } from "react";
import { deliverGoogleOAuthResult, readGoogleOAuthReturn } from "../utils/googleOAuth";

// Rendered instead of the CRM when the Google sign-in popup comes back
// (/integrations?google_oauth=…). Sends the result to the CRM tab, then closes.
// If the browser won't close it, a short message with a Close button stays.
export default function GoogleOAuthReturn() {
  const [result] = useState(() => readGoogleOAuthReturn());
  const [stayed, setStayed] = useState(false);

  useEffect(() => {
    deliverGoogleOAuthResult(result);
    window.close();
    // Still here a moment later: the browser didn't allow closing.
    const t = setTimeout(() => setStayed(true), 400);
    return () => clearTimeout(t);
  }, [result]);

  return (
    <main className="oauth-return" role="status">
      <div className="oauth-return-card">
        <h1>{result.success ? "Google connected" : "Google not connected"}</h1>
        <p>{result.success ? "You can close this window and go back to the CRM." : result.message}</p>
        {!result.success && result.code && <p className="oauth-return-code">Code: {result.code}</p>}
        {stayed && <div className="oauth-return-actions">
          <button type="button" className="btn primary" onClick={() => window.close()}>Close window</button>
          <a className="btn ghost" href="/integrations">Open the CRM here</a>
        </div>}
      </div>
    </main>
  );
}
