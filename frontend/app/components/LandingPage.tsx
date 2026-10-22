"use client";

import React, { useState } from "react";
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

interface LandingPageProps {
  onAuthenticated: (user: FirebaseUser) => void;
}

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

export function LandingPage({ onAuthenticated }: LandingPageProps) {
  const [selectedRole, setSelectedRole] = useState<"bank_officer" | "risk_auditor">("bank_officer");
  const [customEmail, setCustomEmail] = useState("");
  const [customName, setCustomName] = useState("");
  const [customRole, setCustomRole] = useState<"bank_officer" | "risk_auditor">("bank_officer");
  const [showCustomGoogle, setShowCustomGoogle] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Official Firebase Google Popup Sign-In
  const handleRealGooglePopup = async () => {
    setAuthError(null);
    setLoading(true);
    try {
      const user = await signInWithGooglePopup(selectedRole);
      onAuthenticated(user);
    } catch (err: any) {
      if (err.code === "auth/popup-closed-by-user") {
        setAuthError("Sign-in cancelled. Please click 'Sign In with Google' again or select a profile below.");
      } else {
        setAuthError(err.message || "Failed to authenticate with Google. You can also use the 1-click profiles below.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAccountLogin = async (acc: (typeof GOOGLE_INSTITUTIONAL_ACCOUNTS)[0]) => {
    setAuthError(null);
    setLoading(true);
    try {
      const user = await signInWithGoogle(acc);
      onAuthenticated(user);
    } catch (err: any) {
      setAuthError(err.message || "Failed to authenticate with Google account.");
    } finally {
      setLoading(false);
    }
  };

  const handleCustomGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim()) {
      setAuthError("Please provide your Google email address.");
      return;
    }
    setAuthError(null);
    setLoading(true);
    try {
      const user = await signInWithGoogle({
        email: customEmail.trim().toLowerCase(),
        displayName: customName.trim() || customEmail.split("@")[0],
        role: customRole,
      });
      onAuthenticated(user);
    } catch (err: any) {
      setAuthError(err.message || "Failed to authenticate with Google.");
    } finally {
      setLoading(false);
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
              under Federated Learning and Differential Privacy, explain real individual default probabilities with SHAP values,
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
                <div className="text-xs font-bold text-[#111713]">SHAP Risk Attribution</div>
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
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#123F36]">
                    Firebase Authentication
                  </span>
                  <span className="w-2 h-2 rounded-full bg-[#238354]"></span>
                </div>
                <h2 className="text-xl font-extrabold text-[#111713] mt-1">
                  Sign In with Google
                </h2>
                <p className="text-xs text-[#758079] mt-0.5">
                  Connect your Google account to access your assigned institutional role.
                </p>
              </div>

              {/* 1. Official Google Sign-In Popup */}
              <div className="space-y-3 p-4 rounded-2xl bg-[#F7F9F8] border border-[#E8ECE9]">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#758079] uppercase tracking-wider block">
                    Choose Your Role For This Session
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedRole("bank_officer")}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                        selectedRole === "bank_officer"
                          ? "bg-[#123F36] text-white border-[#123F36] shadow-xs"
                          : "bg-white text-[#758079] border-[#E8ECE9] hover:text-[#111713]"
                      }`}
                    >
                      Bank Officer
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRole("risk_auditor")}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                        selectedRole === "risk_auditor"
                          ? "bg-[#123F36] text-white border-[#123F36] shadow-xs"
                          : "bg-white text-[#758079] border-[#E8ECE9] hover:text-[#111713]"
                      }`}
                    >
                      Risk Auditor
                    </button>
                  </div>
                  <p className="text-[10px] text-[#758079] mt-1">
                    {selectedRole === "bank_officer"
                      ? "• Bank Officers evaluate applications, score risk, and confirm decisions."
                      : "• Risk Auditors have exclusive access to Immutable Decision Audit Logs."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleRealGooglePopup}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-white hover:bg-[#F2F5F3] border-2 border-[#123F36] text-[#111713] rounded-xl transition flex items-center justify-center gap-3 font-bold text-xs sm:text-sm shadow-sm hover:shadow-md cursor-pointer group"
                >
                  <GoogleLogo className="w-5 h-5 shrink-0" />
                  <span>{loading ? "Connecting to Google..." : "Sign In with Google"}</span>
                </button>
              </div>

              {/* Separator */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-[#E8ECE9]"></div>
                <span className="flex-shrink mx-3 text-[10px] font-bold text-[#758079] uppercase tracking-wider">
                  Or 1-Click Institutional Demo Profiles
                </span>
                <div className="flex-grow border-t border-[#E8ECE9]"></div>
              </div>

              {/* Verified Institutional Google Accounts */}
              <div className="space-y-2.5">
                {GOOGLE_INSTITUTIONAL_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    onClick={() => handleGoogleAccountLogin(acc)}
                    disabled={loading}
                    className="w-full p-3 bg-white hover:bg-[#F7F9F8] border border-[#E8ECE9] hover:border-[#123F36] rounded-2xl transition flex items-center justify-between group cursor-pointer text-left shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#E7F3EB] text-[#123F36] font-bold text-xs flex items-center justify-center border border-[#C5E4D1] shrink-0">
                        {acc.avatar}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#111713] flex items-center gap-2">
                          {acc.displayName}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            acc.role === "bank_officer"
                              ? "bg-[#E7F3EB] text-[#123F36]"
                              : "bg-[#FEF3C7] text-[#92400E]"
                          }`}>
                            {acc.role === "bank_officer" ? "Bank Officer" : "Supervisory Auditor"}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#758079] truncate">{acc.email}</div>
                      </div>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-white border border-[#E8ECE9] flex items-center justify-center group-hover:bg-[#123F36] group-hover:text-white transition shrink-0">
                      <GoogleLogo className="w-3.5 h-3.5" />
                    </div>
                  </button>
                ))}
              </div>

              {/* Custom Google Workspace Account Toggle */}
              <div className="pt-2 border-t border-[#E8ECE9] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#758079]">Need to sign in with another email?</span>
                  <button
                    type="button"
                    onClick={() => setShowCustomGoogle(!showCustomGoogle)}
                    className="text-xs font-bold text-[#123F36] hover:underline cursor-pointer"
                  >
                    {showCustomGoogle ? "Hide form" : "Enter email directly"}
                  </button>
                </div>

                {showCustomGoogle && (
                  <form onSubmit={handleCustomGoogleSubmit} className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#111713]">Google Account Email</label>
                      <input
                        type="email"
                        required
                        value={customEmail}
                        onChange={(e) => setCustomEmail(e.target.value)}
                        placeholder="officer.patel@gmail.com"
                        className="w-full bg-[#F7F8F7] border border-[#E8ECE9] rounded-xl p-2.5 text-xs text-[#111713] focus:outline-none focus:border-[#123F36]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#111713]">Full Name</label>
                      <input
                        type="text"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="e.g. Neha Patel"
                        className="w-full bg-[#F7F8F7] border border-[#E8ECE9] rounded-xl p-2.5 text-xs text-[#111713] focus:outline-none focus:border-[#123F36]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#111713]">Assigned Role</label>
                      <select
                        value={customRole}
                        onChange={(e) => setCustomRole(e.target.value as any)}
                        className="w-full bg-[#F7F8F7] border border-[#E8ECE9] rounded-xl p-2.5 text-xs text-[#111713] focus:outline-none focus:border-[#123F36]"
                      >
                        <option value="bank_officer">Bank Underwriting Officer</option>
                        <option value="risk_auditor">Compliance Risk Auditor</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 bg-[#123F36] hover:bg-[#1b5549] text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <GoogleLogo className="w-4 h-4" />
                      <span>Sign In with Custom Google</span>
                    </button>
                  </form>
                )}
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#CF5555] text-xs font-semibold">
                  {authError}
                </div>
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
            <h3 className="font-extrabold text-sm text-[#111713]">SHAP Explainability & Trust</h3>
            <p className="text-xs text-[#758079] leading-relaxed">
              Transparent credit scores accompanied by exact SHAP attributions, highlighting top positive and negative drivers of risk.
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
