import React, { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setError("");
  }, [email, password]);

  if (isLoading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-card">
          <img src="/banyan-logo.svg" alt="Banyan" />
          <span>Loading Banyan CRM…</span>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login(email.trim(), password);
      const destination = location.state?.from || "/dashboard";
      navigate(destination, { replace: true });
    } catch (err) {
      setError(
        err.message || "Unable to sign in. Please check your credentials.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-shell">
        <section className="login-brand-panel">
          <div className="login-brand">
            <img src="/banyan-logo.svg" alt="Banyan" />
            <div>
              <strong>BANYAN</strong>
              <span>WORKSPACE CRM</span>
            </div>
          </div>

          <div className="login-intro">
            <span className="eyebrow">Banyan workspace</span>
            <h1>Everything your team needs to move relationships forward.</h1>
            <p>
              Manage your pipeline, customers, conversations, bookings,
              agreements, invoices and loyalty from one workspace.
            </p>
          </div>

          <div className="login-brand-footer">
            <span>Secure workspace access</span>
            <span>CRM · Operations · Growth</span>
          </div>
        </section>

        <section className="login-form-panel">
          <div className="login-form-wrap">
            <span className="eyebrow">Welcome back</span>
            <h2>Sign in to Banyan</h2>
            <p className="login-subtitle">
              Enter your workspace credentials to continue.
            </p>

            <form className="login-form" onSubmit={handleSubmit}>
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                  autoFocus
                />
              </label>

              <label>
                Password
                <div className="password-field">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              {error && (
                <div className="login-error" role="alert">
                  {error}
                </div>
              )}

              <button
                className="btn primary login-submit"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <p className="login-note">
              Your session is protected by Banyan's access and refresh token
              flow.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
