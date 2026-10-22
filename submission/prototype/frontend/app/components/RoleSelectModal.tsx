"use client";

import React, { useState } from "react";
import { IconShield, IconCheck, IconUser } from "./Icons";

interface RoleSelectModalProps {
  userEmail: string;
  userDisplayName: string;
  onConfirmRole: (role: "bank_officer" | "risk_auditor") => Promise<void>;
  onCancelOrSignOut: () => void;
  isLoading: boolean;
  errorMessage: string | null;
}

export function RoleSelectModal({
  userEmail,
  userDisplayName,
  onConfirmRole,
  onCancelOrSignOut,
  isLoading,
  errorMessage,
}: RoleSelectModalProps) {
  const [selectedRole, setSelectedRole] = useState<"bank_officer" | "risk_auditor" | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole || isLoading) return;
    await onConfirmRole(selectedRole);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-modal-title"
    >
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 border border-[#E8ECE9] shadow-2xl space-y-6 text-[#111713]">
        {/* Header */}
        <div className="space-y-1 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#E7F3EB] border border-[#C5E4D1] text-[#123F36] flex items-center justify-center mx-auto mb-3 shadow-xs">
            <IconShield className="w-6 h-6" />
          </div>
          <h2 id="role-modal-title" className="text-xl sm:text-2xl font-black tracking-tight text-[#111713]">
            Select your role
          </h2>
          <p className="text-xs text-[#758079]">
            Authenticated as <span className="font-semibold text-[#111713]">{userEmail}</span> ({userDisplayName})
          </p>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#CF5555] text-xs font-semibold space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#CF5555]"></span>
              <span>Authorization Notice</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[#991B1B]">
              {errorMessage}
            </p>
          </div>
        )}

        {/* Role Options Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2.5">
            {/* Option 1: Bank Underwriting Officer */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setSelectedRole("bank_officer")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedRole("bank_officer");
                }
              }}
              className={`w-full p-4 rounded-2xl border-2 transition text-left cursor-pointer flex items-start gap-3.5 ${
                selectedRole === "bank_officer"
                  ? "border-[#123F36] bg-[#F7FBF9] shadow-xs"
                  : "border-[#E8ECE9] hover:border-[#CBD5E1] bg-white"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                  selectedRole === "bank_officer"
                    ? "border-[#123F36] bg-[#123F36] text-white"
                    : "border-[#CBD5E1] bg-white"
                }`}
              >
                {selectedRole === "bank_officer" && <IconCheck className="w-3 h-3" />}
              </div>
              <div className="space-y-0.5">
                <div className="text-sm font-bold text-[#111713]">
                  Bank Underwriting Officer
                </div>
                <div className="text-xs text-[#758079] leading-relaxed">
                  Review applicants and record decisions.
                </div>
              </div>
            </div>

            {/* Option 2: Auditor */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setSelectedRole("risk_auditor")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedRole("risk_auditor");
                }
              }}
              className={`w-full p-4 rounded-2xl border-2 transition text-left cursor-pointer flex items-start gap-3.5 ${
                selectedRole === "risk_auditor"
                  ? "border-[#123F36] bg-[#F7FBF9] shadow-xs"
                  : "border-[#E8ECE9] hover:border-[#CBD5E1] bg-white"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                  selectedRole === "risk_auditor"
                    ? "border-[#123F36] bg-[#123F36] text-white"
                    : "border-[#CBD5E1] bg-white"
                }`}
              >
                {selectedRole === "risk_auditor" && <IconCheck className="w-3 h-3" />}
              </div>
              <div className="space-y-0.5">
                <div className="text-sm font-bold text-[#111713]">
                  Auditor
                </div>
                <div className="text-xs text-[#758079] leading-relaxed">
                  Read-only access to audit trail and model governance.
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              type="submit"
              disabled={!selectedRole || isLoading}
              className={`w-full py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-sm ${
                !selectedRole || isLoading
                  ? "bg-[#E8ECE9] text-[#758079] cursor-not-allowed"
                  : "bg-[#123F36] hover:bg-[#1a5549] text-white cursor-pointer shadow-md"
              }`}
            >
              {isLoading ? "Verifying Permissions..." : "Continue"}
            </button>

            <button
              type="button"
              onClick={onCancelOrSignOut}
              className="w-full py-2.5 px-4 text-xs font-semibold text-[#758079] hover:text-[#111713] transition text-center cursor-pointer"
            >
              Cancel & Sign Out
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
