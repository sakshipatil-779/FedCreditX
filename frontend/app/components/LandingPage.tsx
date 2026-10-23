"use client";

import React, { useState, useEffect } from "react";
import {
  IconShield,
  IconCheck,
  IconTree,
  IconLab,
  IconAudit,
  IconArrowUpRight,
} from "./Icons";
import {
  signInWithGoogle,
  signInWithGooglePopup,
  GOOGLE_INSTITUTIONAL_ACCOUNTS,
  FirebaseUser,
} from "../lib/firebase";

interface GoogleUserPayload {
  email: string;
  displayName: string;
  uid: string;
  idToken: string;
  photoURL?: string;
}

export interface DemoSessionPayload {
  sessionToken: string;
  email: string;
  role: string;
  authMethod: string;
  expiresAt: string;
}

export interface DirectSignInPayload {
  email: string;
  password?: string;
  displayName: string;
  role: "bank_officer" | "risk_auditor";
}

interface LandingPageProps {
  onGoogleSignIn: (googleUser: GoogleUserPayload) => void;
  onAuthenticated?: (user: FirebaseUser) => void;
  onDemoAuditorSignIn?: (demoSession: DemoSessionPayload) => void;
  onDirectSignIn?: (payload: DirectSignInPayload) => Promise<{ success: boolean; error?: string }>;
}

const API_BASE = "";

function GoogleLogo({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export function LandingPage({
  onGoogleSignIn,
  onAuthenticated,
  onDemoAuditorSignIn,
  onDirectSignIn,
}: LandingPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"bank_officer" | "risk_auditor">("bank_officer");
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Demo Auditor Authentication State
  const [demoAuditorEnabled, setDemoAuditorEnabled] = useState(false);
  const [showDemoAuditorForm, setShowDemoAuditorForm] = useState(false);
  const [demoEmail, setDemoEmail] = useState("");
  const [demoPassword, setDemoPassword] = useState("");
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch(`${API_BASE}/api/auth/config`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data && typeof data.demoAuditorEnabled === "boolean") {
          setDemoAuditorEnabled(data.demoAuditorEnabled);
        }
      })
      .catch(() => {
        // Fallback gracefully
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleDemoLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDemoError(null);
    if (!demoEmail.trim() || !demoPassword) {
      setDemoError("Invalid email or password.");
      return;
    }
    setDemoLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/demo-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: demoEmail.trim(),
          password: demoPassword,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Clear plaintext password immediately
        setDemoPassword("");
        if (onDemoAuditorSignIn) {
          onDemoAuditorSignIn({
            sessionToken: data.session_token,
            email: data.email,
            role: data.role,
            authMethod: data.auth_method || "demo",
            expiresAt: data.expires_at,
          });
        }
      } else if (res.status === 401) {
        const errData = await res.json().catch(() => ({}));
        setDemoError(errData.detail || "Invalid email or password.");
      } else if (res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        setDemoError(errData.detail || "Demo access has ended.");
      } else if (res.status === 429) {
        const errData = await res.json().catch(() => ({}));
        setDemoError(errData.detail || "Too many attempts. Rate limit exceeded.");
      } else {
        const errData = await res.json().catch(() => ({}));
        setDemoError(errData.detail || "Login failed. Please verify credentials.");
      }
    } catch (err: any) {
      setDemoError(`Network error: ${err.message}`);
    } finally {
      setDemoLoading(false);
    }
  };

  // Official Firebase Google Popup Sign-In
  const handleRealGooglePopup = async () => {
    setAuthError(null);
    setLoading(true);
    try {
      const user = await signInWithGooglePopup("bank_officer");
      onGoogleSignIn({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        idToken: user.idToken || `google_token_${Date.now()}`,
        photoURL: user.photoURL,
      });
    } catch (err: any) {
      if (err.code === "auth/popup-closed-by-user") {
        setAuthError("Sign-in cancelled. Please click 'Sign In with Google' again or select a profile below.");
      } else {
        setAuthError(err.message || "Failed to authenticate with Google. You can also use the institutional profiles below.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDirectSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setAuthError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setFormError("Please provide your email address.");
      return;
    }
    setFormLoading(true);
    try {
      if (onDirectSignIn) {
        const res = await onDirectSignIn({
          email: cleanEmail,
          password: password,
          displayName: fullName.trim() || cleanEmail.split("@")[0],
          role: role,
        });
        if (!res.success) {
          setFormError(res.error || "Authentication failed. Please verify credentials.");
        }
      } else {
        onGoogleSignIn({
          uid: `direct_${role}_${Math.random().toString(36).substring(2, 8)}`,
          email: cleanEmail,
          displayName: fullName.trim() || cleanEmail.split("@")[0],
          idToken: `test_token:${cleanEmail}`,
        });
      }
    } catch (err: any) {
      setFormError(err.message || "Sign in failed. Please try again.");
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#111713] flex flex-col font-sans selection:bg-[#E7F3EB] selection:text-[#123F36]">
      {/* Top Header Navbar */}
      <header className="bg-white/95 backdrop-blur-md border-b border-[#E8ECE9] sticky top-0 z-40 px-6 sm:px-10 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E7F3EB] border border-[#C5E4D1] flex items-center justify-center text-[#123F36] shadow-xs">
              <div className="w-5 h-5 rounded-full border-2 border-[#123F36] flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-[#123F36]"></div>
              </div>
            </div>
            <div>
              <div className="text-base font-black tracking-tight text-[#111713] flex items-center gap-1.5">
                <span>FedCreditX</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E7F3EB] text-[#123F36] font-bold">
                  FL + DP CREDIT ENGINE
                </span>
              </div>
              <div className="text-[11px] text-[#758079]">
                Privacy-Aware Collaborative Underwriting
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6 text-xs font-semibold text-[#758079]">
            <a href="#pillars" className="hover:text-[#111713] transition">Architecture</a>
            <a href="#compliance" className="hover:text-[#111713] transition">Supervisory Trust</a>
            <span className="w-1 h-1 rounded-full bg-[#E8ECE9]"></span>
            <span className="text-[#238354] font-bold">Production Ready</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRealGooglePopup}
              disabled={loading}
              className="py-2 px-5 bg-[#123F36] hover:bg-[#1b5549] text-white font-bold text-xs rounded-full shadow-sm transition cursor-pointer flex items-center gap-2"
            >
              <GoogleLogo className="w-4 h-4" />
              <span>Sign In with Google</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-5 sm:p-8 lg:p-10 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center pt-4 sm:pt-8">
          
          {/* Left Column: Hero Copy & Capabilities */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E7F3EB] border border-[#C5E4D1] text-[11px] font-bold text-[#123F36]">
              <span className="w-2 h-2 rounded-full bg-[#238354] animate-pulse"></span>
              <span>MULTI-INSTITUTIONAL COLLABORATIVE CREDIT INTELLIGENCE</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[#111713] leading-[1.15]">
              Privacy-Preserving Collaborative Credit Risk Assessment
            </h1>

            <p className="text-sm sm:text-base text-[#758079] leading-relaxed max-w-2xl">
              Enable commercial lenders and financial institutions to collaboratively train credit-risk models
              under Federated Learning and Differential Privacy, explain real individual default probabilities with key risk drivers,
              and record auditable senior underwriting approvals.
            </p>

            {/* 3 Value Pillars */}
            <div id="pillars" className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
              <div className="bg-white rounded-2xl p-4 border border-[#E8ECE9] shadow-xs space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#123F36]">Pillar 01</div>
                <div className="text-xs font-bold text-[#111713]">FL + Differential Privacy</div>
                <p className="text-[11px] text-[#758079]">Local gradient clipping and noise addition guarantees mathematical privacy.</p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-[#E8ECE9] shadow-xs space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#123F36]">Pillar 02</div>
                <div className="text-xs font-bold text-[#111713]">Key Risk Attribution</div>
                <p className="text-[11px] text-[#758079]">Exact linear feature contributions and plain-English risk drivers.</p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-[#E8ECE9] shadow-xs space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#123F36]">Pillar 03</div>
                <div className="text-xs font-bold text-[#111713]">Role-Based Governance</div>
                <p className="text-[11px] text-[#758079]">Strict separation between Underwriting Officers and Supervisory Auditors.</p>
              </div>
            </div>
          </div>

          {/* Right Column: Google Authentication Card */}
          <div className="lg:col-span-5" id="auth-portal-card">
            <div className="bg-white rounded-[28px] p-6 sm:p-8 border border-[#E8ECE9] shadow-xl shadow-black/5 space-y-5">
              {showDemoAuditorForm ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E8ECE9]">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#123F36]">
                        Supervisory Evaluation Access
                      </div>
                      <h3 className="text-lg font-extrabold text-[#111713]">
                        Demo Auditor Sign In
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDemoAuditorForm(false);
                        setDemoError(null);
                        setDemoPassword("");
                      }}
                      className="text-xs font-semibold text-[#758079] hover:text-[#111713] cursor-pointer"
                    >
                      &larr; Back
                    </button>
                  </div>

                  <p className="text-xs text-[#758079]">
                    Enter evaluator credentials for direct read-only access to Audit Logs and Holdout Benchmark metrics.
                  </p>

                  <form onSubmit={handleDemoLoginSubmit} autoComplete="off" className="space-y-3.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#111713]">
                        Auditor Email
                      </label>
                      <input
                        type="email"
                        required
                        autoComplete="off"
                        value={demoEmail}
                        onChange={(e) => setDemoEmail(e.target.value)}
                        placeholder="auditor@fedcreditx.org"
                        className="w-full bg-[#F7F8F7] border border-[#E8ECE9] rounded-xl p-2.5 text-xs text-[#111713] focus:outline-none focus:border-[#123F36]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#111713]">
                        Password
                      </label>
                      <input
                        type="password"
                        required
                        autoComplete="new-password"
                        value={demoPassword}
                        onChange={(e) => setDemoPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-[#F7F8F7] border border-[#E8ECE9] rounded-xl p-2.5 text-xs text-[#111713] focus:outline-none focus:border-[#123F36]"
                      />
                    </div>

                    {demoError && (
                      <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#CF5555] text-xs font-semibold">
                        {demoError}
                      </div>
                    )}

                    <div className="pt-2 space-y-2">
                      <button
                        type="submit"
                        disabled={demoLoading}
                        className="w-full py-3 bg-[#123F36] hover:bg-[#1b5549] text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        {demoLoading ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <span>Sign In as Demo Auditor</span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowDemoAuditorForm(false);
                          setDemoError(null);
                          setDemoPassword("");
                        }}
                        className="w-full py-2 text-center text-xs font-semibold text-[#758079] hover:text-[#111713] cursor-pointer"
                      >
                        Return to Google sign-in
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#123F36]">
                        Institutional Access
                      </span>
                      <span className="w-2 h-2 rounded-full bg-[#238354]"></span>
                    </div>
                    <h2 className="text-xl font-extrabold text-[#111713] mt-1">
                      Sign In to FedCreditX
                    </h2>
                    <p className="text-xs text-[#758079] mt-0.5">
                      Connect via Google Workspace or sign in with your email and role.
                    </p>
                  </div>

                  {/* 1. Official Google Sign-In Popup */}
                  <div className="space-y-3 p-4 rounded-2xl bg-[#F7F9F8] border border-[#E8ECE9]">
                    <button
                      type="button"
                      onClick={handleRealGooglePopup}
                      disabled={loading || formLoading}
                      className="w-full py-3.5 px-4 bg-white hover:bg-[#F2F5F3] border-2 border-[#123F36] text-[#111713] rounded-xl transition flex items-center justify-center gap-3 font-bold text-xs sm:text-sm shadow-sm hover:shadow-md cursor-pointer group"
                    >
                      <GoogleLogo className="w-5 h-5 shrink-0" />
                      <span>{loading ? "Connecting to Google..." : "Sign In with Google"}</span>
                    </button>

                    {demoAuditorEnabled && (
                      <div className="pt-1 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setShowDemoAuditorForm(true);
                            setDemoError(null);
                          }}
                          className="text-xs font-semibold text-[#123F36] hover:text-[#1b5549] hover:underline cursor-pointer transition inline-flex items-center gap-1.5"
                        >
                          <span>Demo auditor login</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#E7F3EB] text-[#123F36] font-bold">Evaluator</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Separator */}
                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-[#E8ECE9]"></div>
                    <span className="flex-shrink mx-3 text-[10px] font-bold text-[#758079] uppercase tracking-wider">
                      Or Sign In with Email &amp; Password
                    </span>
                    <div className="flex-grow border-t border-[#E8ECE9]"></div>
                  </div>

                  {/* 2. Direct Email, Password & Role Form */}
                  <form onSubmit={handleDirectSignInSubmit} className="space-y-3.5" autoComplete="off">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#111713]">
                        Email
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="officer@fedcreditx.com"
                        className="w-full bg-[#F7F8F7] border border-[#E8ECE9] rounded-xl p-2.5 text-xs text-[#111713] focus:outline-none focus:border-[#123F36]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#111713]">
                        Password
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-[#F7F8F7] border border-[#E8ECE9] rounded-xl p-2.5 text-xs text-[#111713] focus:outline-none focus:border-[#123F36]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#111713]">
                        Full Name <span className="text-[#758079] font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Underwriting Officer"
                        className="w-full bg-[#F7F8F7] border border-[#E8ECE9] rounded-xl p-2.5 text-xs text-[#111713] focus:outline-none focus:border-[#123F36]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#111713]">
                        Assigned Role
                      </label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as "bank_officer" | "risk_auditor")}
                        className="w-full bg-[#F7F8F7] border border-[#E8ECE9] rounded-xl p-2.5 text-xs text-[#111713] focus:outline-none focus:border-[#123F36]"
                      >
                        <option value="bank_officer">Bank Underwriting Officer</option>
                        <option value="risk_auditor">Compliance Risk Auditor</option>
                      </select>
                    </div>

                    {formError && (
                      <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#CF5555] text-xs font-semibold">
                        {formError}
                      </div>
                    )}

                    <div className="pt-1">
                      <button
                        type="submit"
                        disabled={formLoading || loading}
                        className="w-full py-3 bg-[#123F36] hover:bg-[#1b5549] text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        {formLoading ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <span>Sign In</span>
                        )}
                      </button>
                    </div>
                  </form>

                  {authError && (
                    <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#CF5555] text-xs font-semibold">
                      {authError}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Feature Grid / Trust Section */}
        <section id="compliance" className="pt-10 border-t border-[#E8ECE9] grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-3xl bg-[#F7F9F8] border border-[#E8ECE9] space-y-2">
            <div className="w-8 h-8 rounded-full bg-[#E7F3EB] text-[#123F36] flex items-center justify-center font-bold text-xs">
              01
            </div>
            <h3 className="font-extrabold text-sm text-[#111713]">Federated Privacy Preservation</h3>
            <p className="text-xs text-[#758079] leading-relaxed">
              Applicant data never leaves participating bank boundaries. Only DP-clipped gradient weights are shared for model updates.
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-[#F7F9F8] border border-[#E8ECE9] space-y-2">
            <div className="w-8 h-8 rounded-full bg-[#E7F3EB] text-[#123F36] flex items-center justify-center font-bold text-xs">
              02
            </div>
            <h3 className="font-extrabold text-sm text-[#111713]">Risk Explainability & Trust</h3>
            <p className="text-xs text-[#758079] leading-relaxed">
              Transparent credit scores accompanied by exact risk attributions, highlighting top positive and negative drivers of risk.
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-[#F7F9F8] border border-[#E8ECE9] space-y-2">
            <div className="w-8 h-8 rounded-full bg-[#E7F3EB] text-[#123F36] flex items-center justify-center font-bold text-xs">
              03
            </div>
            <h3 className="font-extrabold text-sm text-[#111713]">Role-Based Audit Isolation</h3>
            <p className="text-xs text-[#758079] leading-relaxed">
              Audit trails are isolated to compliance auditors to maintain operational segregation of duties from underwriting officers.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E8ECE9] py-6 px-6 sm:px-10 text-center text-xs text-[#758079] bg-white">
        <p>FedCreditX &bull; Privacy-Aware Collaborative Credit Intelligence Platform &bull; Research-Grade Demonstration</p>
      </footer>
    </div>
  );
}
