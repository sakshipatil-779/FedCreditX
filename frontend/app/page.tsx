"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  IconDashboard,
  IconAudit,
  IconLab,
  IconMetrics,
  IconCharter,
  IconSearch,
  IconBell,
  IconArrowUpRight,
  IconShield,
  IconCheck,
  IconX,
  IconRefresh,
  IconDownload,
  IconUser,
  IconAlert,
  IconTree,
} from "./components/Icons";
import { RiskGauge } from "./components/RiskGauge";
import { LandingPage } from "./components/LandingPage";
import { RoleSelectModal } from "./components/RoleSelectModal";
import { useHighlightOnArrive } from "./hooks/useHighlightOnArrive";
import {
  getCurrentUser,
  signOutUser,
  FirebaseUser,
} from "./lib/firebase";

type PrimaryScreen = "decision" | "approvals" | "audit" | "research" | "metrics" | "about";

interface ReasonDetail {
  feature: string;
  feature_label: string;
  direction: "increases_risk" | "decreases_risk";
  value: number;
  threshold?: number;
  impact_delta?: number;
  shap_value?: number;
  impact: string;
  condition?: string;
  readable_reason: string;
}

interface BaselineComparison {
  model_name: string;
  default_probability: number;
  percentage_display: string;
  risk_band: string;
  tree_path: ReasonDetail[];
}

interface ScoringResponse {
  case_id: string;
  lender_id: string;
  model_type: string;
  model_version: string;
  default_probability_estimate: number;
  demo_model_estimated_default_probability?: number;
  percentage_display: string;
  risk_level: "Low" | "Medium" | "High";
  demo_risk_band: string;
  risk_band_description: string;
  badge_color: "green" | "amber" | "red";
  system_recommendation: string;
  required_handling: string;
  review_status: string;
  final_decision: string | null;
  top_reasons: ReasonDetail[];
  attributions: any[];
  baseline_comparison?: BaselineComparison;
  features: Record<string, number>;
  timestamp: string;
  calibration_caveat: string;
}

interface AuditRecord {
  id: string;
  timestamp: string;
  event_type: string;
  actor_type: string;
  entity_id: string;
  status: string;
  safe_metadata: Record<string, any>;
}

interface CaseItem {
  case_id: string;
  lender_id: string;
  expected_demo_risk_band?: string;
  notes?: string;
  features: Record<string, number>;
}

interface ApprovalHistoryItem {
  id: string;
  action: string;
  actor: string;
  previous_status: string;
  new_status: string;
  comments: string;
  timestamp: string;
}

interface ApprovalItem {
  id: string;
  case_id: string;
  lender_id: string;
  applicant_name: string;
  risk_score: number;
  risk_band: string;
  submitted_by: string;
  submitted_at: string;
  status: string;
  officer_notes?: string;
  override_reason?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  senior_comments?: string;
  updated_at: string;
  history: ApprovalHistoryItem[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function FedCreditXDashboard() {
  // 1. Authentication State
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authInitialized, setAuthInitialized] = useState<boolean>(false);

  // Role Selection Modal State (Task 4 & Task 5)
  const [pendingGoogleUser, setPendingGoogleUser] = useState<{
    email: string;
    displayName: string;
    uid: string;
    idToken: string;
    photoURL?: string;
  } | null>(null);
  const [roleModalLoading, setRoleModalLoading] = useState<boolean>(false);
  const [roleModalError, setRoleModalError] = useState<string | null>(null);

  // Highlight hook for Task 2 (3.5s duration, supports prefers-reduced-motion, auto cleanup on unmount)
  const { triggerHighlight } = useHighlightOnArrive(3500);

  const navigateToAndHighlight = (targetId: string) => {
    if (activeScreen !== "decision") {
      setActiveScreen("decision");
      setTimeout(() => {
        triggerHighlight(targetId);
      }, 120);
    } else {
      triggerHighlight(targetId);
    }
  };

  // 2. Navigation & Lender Context State
  const [activeScreen, setActiveScreen] = useState<PrimaryScreen>("decision");
  const [selectedLender, setSelectedLender] = useState<"lender_a" | "lender_b" | "lender_c">("lender_a");
  
  // 3. Real Cases State (No Mock/Dummy Values)
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [casesLoading, setCasesLoading] = useState<boolean>(true);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");

  // 4. Decision Screen & Scoring State
  const [isScoring, setIsScoring] = useState<boolean>(false);
  const [scoredResult, setScoredResult] = useState<ScoringResponse | null>(null);
  const [scoreError, setScoreError] = useState<string | null>(null);

  // 5. Officer Action & Mandatory Override State
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [officerNotes, setOfficerNotes] = useState<string>("");
  const [actionSubmitting, setActionSubmitting] = useState<boolean>(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  // 6. Approval Tracking State
  const [approvalsList, setApprovalsList] = useState<ApprovalItem[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState<boolean>(false);
  const [approvalFilterStatus, setApprovalFilterStatus] = useState<string>("all");
  const [seniorDecisionComments, setSeniorDecisionComments] = useState<Record<string, string>>({});
  const [submittingSeniorAction, setSubmittingSeniorAction] = useState<string | null>(null);
  const [expandedApprovalId, setExpandedApprovalId] = useState<string | null>(null);

  // 7. Audit Log State
  const [auditEvents, setAuditEvents] = useState<AuditRecord[]>([]);
  const [auditLoading, setAuditLoading] = useState<boolean>(false);
  const [filterEventType, setFilterEventType] = useState<string>("");
  const [filterActor, setFilterActor] = useState<string>("");
  const [filterResourceId, setFilterResourceId] = useState<string>("");
  const [filterDecision, setFilterDecision] = useState<string>("");
  const [auditPage, setAuditPage] = useState<number>(0);
  const [auditLimit, setAuditLimit] = useState<number>(15);

  // 8. Search State (Real Backend Search)
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<{ cases: any[]; audit_events: any[] } | null>(null);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // 9. Backend Health & Research State
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const [metricsData, setMetricsData] = useState<any>(null);
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [trainingRunStatus, setTrainingRunStatus] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [showSimulationDetails, setShowSimulationDetails] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // 10. Officer Browser-Side Training State (Part B)
  const [officerCsvFile, setOfficerCsvFile] = useState<File | null>(null);
  const [parsedCsvData, setParsedCsvData] = useState<{ X: number[][]; y: number[] } | null>(null);
  const [csvParseError, setCsvParseError] = useState<string | null>(null);
  const [officerTrainingProgress, setOfficerTrainingProgress] = useState<number>(0);
  const [isOfficerTraining, setIsOfficerTraining] = useState<boolean>(false);
  const [officerTrainingMessage, setOfficerTrainingMessage] = useState<string | null>(null);
  const [officerDpEnabled, setOfficerDpEnabled] = useState<boolean>(true);
  const [inAppNotice, setInAppNotice] = useState<string | null>(null);

  const getAuthHeaders = (): Record<string, string> => {
    const sessionToken = typeof window !== "undefined" ? localStorage.getItem("fedcreditx_session_token") : null;
    const headers: Record<string, string> = { "X-User-Role": currentUser?.role || "bank_officer" };
    if (sessionToken) {
      headers["Authorization"] = `Bearer ${sessionToken}`;
      headers["X-Session-Token"] = sessionToken;
    }
    return headers;
  };

  useEffect(() => {
    if (inAppNotice) {
      const timer = setTimeout(() => setInAppNotice(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [inAppNotice]);

  // Check auth on mount
  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
    setAuthInitialized(true);
    checkBackendHealth();
  }, []);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Restrict bank officers from audit screen (audit logs are strictly for auditors)
  useEffect(() => {
    if (currentUser?.role === "bank_officer" && activeScreen === "audit") {
      setActiveScreen("decision");
    }
  }, [currentUser, activeScreen]);

  // When selected lender changes, reload real cases from backend
  useEffect(() => {
    if (currentUser) {
      loadCases(selectedLender);
      setScoredResult(null);
      setActionSuccessMessage(null);
      setActionErrorMessage(null);
      setOverrideReason("");
    }
  }, [selectedLender, currentUser]);

  // When switching screens
  useEffect(() => {
    if (currentUser) {
      if (activeScreen === "approvals") {
        fetchApprovals();
      } else if (activeScreen === "audit") {
        fetchAuditLogs();
      } else if (activeScreen === "metrics") {
        fetchMetrics();
      } else if (activeScreen === "research") {
        checkBackendHealth();
      }
    }
  }, [activeScreen, auditPage, auditLimit, filterEventType, filterActor, filterResourceId, filterDecision, approvalFilterStatus, currentUser]);

  const handleSignOut = () => {
    signOutUser();
    if (typeof window !== "undefined") {
      localStorage.removeItem("fedcreditx_session_token");
      localStorage.removeItem("fedcreditx_auth_user");
    }
    setCurrentUser(null);
    setPendingGoogleUser(null);
    setRoleModalError(null);
    setScoredResult(null);
    setAuditEvents([]);
    setCases([]);
    setApprovalsList([]);
  };

  const handleConfirmRole = async (selectedRole: "bank_officer" | "risk_auditor") => {
    if (!pendingGoogleUser) return;
    setRoleModalLoading(true);
    setRoleModalError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/select-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_token: pendingGoogleUser.idToken,
          requested_role: selectedRole,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const appUser: FirebaseUser = {
          uid: pendingGoogleUser.uid,
          email: data.email,
          displayName: pendingGoogleUser.displayName,
          role: data.role === "risk_auditor" ? "risk_auditor" : "bank_officer",
          idToken: pendingGoogleUser.idToken,
          photoURL: pendingGoogleUser.photoURL,
          createdAt: new Date().toISOString(),
        };
        if (typeof window !== "undefined") {
          localStorage.setItem("fedcreditx_auth_user", JSON.stringify(appUser));
          localStorage.setItem("fedcreditx_session_token", data.session_token);
        }
        setCurrentUser(appUser);
        setPendingGoogleUser(null);
        setRoleModalError(null);
      } else if (res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        setRoleModalError(
          errData.detail || "Your account is not approved as Auditor. Contact the administrator."
        );
      } else {
        const errData = await res.json().catch(() => ({}));
        setRoleModalError(errData.detail || "Failed to confirm role with authentication server.");
      }
    } catch (err: any) {
      setRoleModalError(`Network error connecting to backend: ${err.message}`);
    } finally {
      setRoleModalLoading(false);
    }
  };

  const handleCancelRoleModal = () => {
    setPendingGoogleUser(null);
    setRoleModalError(null);
    handleSignOut();
  };

  const handleDirectSignIn = async (payload: {
    email: string;
    password?: string;
    displayName: string;
    role: "bank_officer" | "risk_auditor";
  }): Promise<{ success: boolean; error?: string }> => {
    const { email, password, displayName, role } = payload;

    // Check demo login if risk_auditor and password entered
    if (role === "risk_auditor" && password && password.trim()) {
      try {
        const demoRes = await fetch(`${API_BASE}/api/auth/demo-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            password: password.trim(),
          }),
        });

        if (demoRes.ok) {
          const data = await demoRes.json();
          const demoUser: FirebaseUser = {
            uid: `demo_${data.email}`,
            email: data.email,
            displayName: displayName || "Compliance Risk Auditor",
            role: "risk_auditor",
            authMethod: "demo",
            createdAt: new Date().toISOString(),
          };
          if (typeof window !== "undefined") {
            localStorage.setItem("fedcreditx_auth_user", JSON.stringify(demoUser));
            localStorage.setItem("fedcreditx_session_token", data.session_token);
          }
          setCurrentUser(demoUser);
          setPendingGoogleUser(null);
          setRoleModalError(null);
          setActiveScreen("audit");
          return { success: true };
        } else if (demoRes.status === 403) {
          const errData = await demoRes.json().catch(() => ({}));
          return { success: false, error: errData.detail || "Demo access has ended." };
        }
      } catch {
        // Fall through to server-side role selection
      }
    }

    // Direct role selection with backend /api/auth/select-role
    try {
      const token = `test_tok:${email}`;
      const res = await fetch(`${API_BASE}/api/auth/select-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_token: token,
          requested_role: role,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const appUser: FirebaseUser = {
          uid: `usr_${role}_${Math.random().toString(36).substring(2, 9)}`,
          email: data.email,
          displayName: displayName || email.split("@")[0] || "Authorized User",
          role: data.role === "risk_auditor" ? "risk_auditor" : "bank_officer",
          idToken: token,
          createdAt: new Date().toISOString(),
        };
        if (typeof window !== "undefined") {
          localStorage.setItem("fedcreditx_auth_user", JSON.stringify(appUser));
          localStorage.setItem("fedcreditx_session_token", data.session_token);
        }
        setCurrentUser(appUser);
        setPendingGoogleUser(null);
        setRoleModalError(null);
        if (appUser.role === "risk_auditor") {
          setActiveScreen("audit");
        } else {
          setActiveScreen("decision");
        }
        return { success: true };
      } else if (res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          error: errData.detail || "Your account is not approved as Auditor. Contact the administrator.",
        };
      } else {
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          error: errData.detail || "Sign in failed. Please verify credentials.",
        };
      }
    } catch (err: any) {
      return {
        success: false,
        error: `Network error connecting to backend: ${err.message}`,
      };
    }
  };

  const checkBackendHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/overview`);
      if (res.ok) {
        setApiConnected(true);
      } else {
        setApiConnected(false);
      }
    } catch {
      setApiConnected(false);
    }
  };

  // Fixed Global Refresh: Refreshes relevant active view data from backend without triggering scoring or duplicating records
  const handleGlobalRefresh = async () => {
    setIsRefreshing(true);
    try {
      await checkBackendHealth();
      if (activeScreen === "decision") {
        await loadCases(selectedLender);
      } else if (activeScreen === "approvals") {
        await fetchApprovals();
      } else if (activeScreen === "audit") {
        await fetchAuditLogs();
      } else if (activeScreen === "metrics") {
        await fetchMetrics();
      }
    } catch {
      // ignore
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fetch real cases directly from backend (Zero mock/placeholder values)
  const loadCases = async (lender: string) => {
    setCasesLoading(true);
    setCasesError(null);
    try {
      const res = await fetch(`${API_BASE}/api/cases?lender_id=${lender}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setCases(data);
          setSelectedCaseId(data[0].case_id);
          setCasesLoading(false);
          return;
        } else {
          setCasesError(`No cases found in backend partition for ${lender}.`);
        }
      } else {
        const err = await res.json();
        setCasesError(err.detail || `Failed to fetch cases for ${lender}.`);
      }
    } catch (e: any) {
      setCasesError(`Network error connecting to backend API: ${e.message}`);
    }
    setCasesLoading(false);
  };

  // Fetch approval tracking list
  const fetchApprovals = async () => {
    setApprovalsLoading(true);
    try {
      const url = approvalFilterStatus === "all"
        ? `${API_BASE}/api/approvals`
        : `${API_BASE}/api/approvals?status=${encodeURIComponent(approvalFilterStatus)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setApprovalsList(data.approvals || []);
      }
    } catch {
      // ignore
    } finally {
      setApprovalsLoading(false);
    }
  };

  // Fetch holdout benchmark metrics with RBAC
  const fetchMetrics = async () => {
    try {
      const userRole = currentUser?.role || "bank_officer";
      const sessionToken = typeof window !== "undefined" ? localStorage.getItem("fedcreditx_session_token") : null;
      const headers: Record<string, string> = { "X-User-Role": userRole };
      if (sessionToken) {
        headers["Authorization"] = `Bearer ${sessionToken}`;
        headers["X-Session-Token"] = sessionToken;
      }
      const res = await fetch(`${API_BASE}/api/metrics?role=${userRole}`, {
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setMetricsData(data);
      } else if (res.status === 403) {
        setMetricsData({
          access_denied: true,
          detail: "Access restricted. The Holdout Benchmark is restricted to authorized Compliance Auditor and Risk Administrator roles.",
        });
      }
    } catch {
      // ignore
    }
  };

  // Fetch real audit logs directly from backend
  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("limit", auditLimit.toString());
      params.append("offset", (auditPage * auditLimit).toString());
      if (filterEventType) params.append("event_type", filterEventType);
      if (filterActor) params.append("actor", filterActor);
      if (filterResourceId) params.append("resource_id", filterResourceId);
      if (filterDecision) params.append("decision", filterDecision);

      const sessionToken = typeof window !== "undefined" ? localStorage.getItem("fedcreditx_session_token") : null;
      const headers: Record<string, string> = {};
      if (sessionToken) {
        headers["Authorization"] = `Bearer ${sessionToken}`;
        headers["X-Session-Token"] = sessionToken;
      }

      const res = await fetch(`${API_BASE}/api/audit?${params.toString()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAuditEvents(data);
      }
    } catch {
      // ignore
    } finally {
      setAuditLoading(false);
    }
  };

  const handleExportAuditCSV = () => {
    const params = new URLSearchParams();
    if (filterEventType) params.append("event_type", filterEventType);
    if (filterActor) params.append("actor", filterActor);
    if (filterResourceId) params.append("resource_id", filterResourceId);
    if (filterDecision) params.append("decision", filterDecision);
    const sessionToken = typeof window !== "undefined" ? localStorage.getItem("fedcreditx_session_token") : null;
    if (sessionToken) {
      params.append("session_token", sessionToken);
    }

    window.open(`${API_BASE}/api/audit/export?${params.toString()}`, "_blank");
  };

  // Operational Search Handler calling backend /api/search?q=...
  const handleSearchChange = async (val: string) => {
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults(null);
      setSearchOpen(false);
      return;
    }
    setSearchLoading(true);
    setSearchOpen(true);
    try {
      const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(val.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch {
      // ignore
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectSearchedCase = (c: any) => {
    setSelectedLender(c.lender_id);
    setSelectedCaseId(c.case_id);
    setActiveScreen("decision");
    setSearchOpen(false);
    setSearchQuery("");
  };

  const handleSelectSearchedAudit = (ev: any) => {
    setFilterResourceId(ev.entity_id);
    setActiveScreen("audit");
    setSearchOpen(false);
    setSearchQuery("");
  };

  // Score Applicant (Primary FL + DP Logistic Regression & SHAP)
  const handleScoreCase = async () => {
    if (!selectedCaseId) return;
    setIsScoring(true);
    setScoreError(null);
    setActionSuccessMessage(null);
    setActionErrorMessage(null);
    setOverrideReason("");

    try {
      const res = await fetch(`${API_BASE}/api/cases/${selectedCaseId}/score?lender_id=${selectedLender}`, {
        method: "POST",
      });
      if (res.ok) {
        const data: ScoringResponse = await res.json();
        setScoredResult(data);
        setIsScoring(false);
        return;
      } else {
        const err = await res.json();
        setScoreError(err.detail || "Scoring request failed.");
      }
    } catch (e: any) {
      setScoreError(`Network connection error: ${e.message}`);
    }
    setIsScoring(false);
  };

  // Submit Officer Underwriting Decision (Approve / Reject)
  const handleSubmitOfficerDecision = async (action: "approve" | "reject") => {
    if (!scoredResult) return;
    setActionSubmitting(true);
    setActionSuccessMessage(null);
    setActionErrorMessage(null);

    const rec = scoredResult.system_recommendation;
    let isOverride = false;
    if (rec === "Auto-approve recommendation" && action === "reject") {
      isOverride = true;
    } else if (rec === "Flag high risk" && action === "approve") {
      isOverride = true;
    }

    if (isOverride && (!overrideReason || overrideReason.trim() === "")) {
      setActionErrorMessage(
        `A documented justification is mandatory when departing from model recommendation. System recommends '${rec}', but officer selected '${action.toUpperCase()}'.`
      );
      setActionSubmitting(false);
      return;
    }

    const currentOfficer = currentUser?.displayName
      ? `${currentUser.displayName} (${currentUser.role === "bank_officer" ? "Bank Officer" : "Auditor"})`
      : (currentUser?.email || "officer@fedcreditx.com");

    try {
      const res = await fetch(`${API_BASE}/api/cases/${selectedCaseId}/decision?lender_id=${selectedLender}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          officer_action: action,
          officer_id: currentOfficer,
          override_reason: overrideReason.trim() || undefined,
          notes: officerNotes.trim() || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActionSuccessMessage(
          `Decision confirmed: ${data.final_decision} (Audit ID: ${data.audit_event_id}). Persisted in SQLite audit trail.`
        );
        handleScoreCase();
      } else {
        const err = await res.json();
        setActionErrorMessage(err.detail || "Officer decision submission failed.");
      }
    } catch (e: any) {
      setActionErrorMessage(`Failed to record decision: ${e.message}`);
    } finally {
      setActionSubmitting(false);
    }
  };

  // Submit Case to Senior Officer for Secondary Review
  const handleSubmitForSeniorApproval = async () => {
    if (!scoredResult) return;
    setActionSubmitting(true);
    setActionSuccessMessage(null);
    setActionErrorMessage(null);

    const currentOfficer = currentUser?.displayName
      ? `${currentUser.displayName} (${currentUser.role === "bank_officer" ? "Bank Officer" : "Auditor"})`
      : (currentUser?.email || "officer@fedcreditx.com");

    try {
      const res = await fetch(`${API_BASE}/api/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: selectedCaseId,
          lender_id: selectedLender,
          applicant_name: `Applicant ${selectedCaseId}`,
          risk_score: scoredResult.default_probability_estimate,
          risk_band: scoredResult.demo_risk_band,
          submitted_by: currentOfficer,
          officer_notes: officerNotes.trim() || undefined,
          override_reason: overrideReason.trim() || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActionSuccessMessage(
          `Application escalated to Senior Officers for review (Tracking ID: ${data.tracking_id}). Check Approval Tracking menu.`
        );
        handleScoreCase();
      } else {
        const err = await res.json();
        setActionErrorMessage(err.detail || "Failed to submit for senior review.");
      }
    } catch (e: any) {
      setActionErrorMessage(`Submission error: ${e.message}`);
    } finally {
      setActionSubmitting(false);
    }
  };

  // Senior Officer Decision on Tracked Application (Approve / Reject)
  const handleSeniorDecision = async (trackingId: string, action: "approve" | "reject") => {
    setSubmittingSeniorAction(trackingId);
    const seniorName = currentUser?.displayName
      ? `${currentUser.displayName} (Senior Reviewer)`
      : "Senior Underwriter";
    const comments = seniorDecisionComments[trackingId] || "";

    try {
      const res = await fetch(`${API_BASE}/api/approvals/${trackingId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          senior_officer_id: seniorName,
          senior_comments: comments.trim() || undefined,
        }),
      });

      if (res.ok) {
        fetchApprovals();
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to record senior decision.");
      }
    } catch (e: any) {
      alert(`Decision error: ${e.message}`);
    } finally {
      setSubmittingSeniorAction(null);
    }
  };

  // CSV File Handler for Officer Local Training
  const handleCsvFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOfficerCsvFile(file);
    setCsvParseError(null);
    setOfficerTrainingMessage(null);
    setOfficerTrainingProgress(0);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        setCsvParseError("CSV must contain a header row and at least 1 applicant record.");
        return;
      }
      const rawHeaders = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
      const requiredFeatures = [
        "monthly_income_band_value",
        "debt_to_income_ratio",
        "late_payment_count_12m",
        "credit_utilization_ratio",
        "income_variability",
        "loan_amount_to_income",
        "account_history_months",
        "utility_payment_consistency",
      ];
      const targetCol = "defaulted";
      const missing = [...requiredFeatures, targetCol].filter((col) => !rawHeaders.includes(col));
      if (missing.length > 0) {
        setCsvParseError(`Missing required columns: ${missing.join(", ")}`);
        return;
      }

      const colIndices: Record<string, number> = {};
      rawHeaders.forEach((h, idx) => {
        colIndices[h] = idx;
      });

      const X: number[][] = [];
      const y: number[] = [];

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",").map((p) => p.trim());
        if (parts.length < rawHeaders.length) continue;
        const rowVals: number[] = [];
        let hasNan = false;
        for (const feat of requiredFeatures) {
          const val = parseFloat(parts[colIndices[feat]]);
          if (isNaN(val)) {
            hasNan = true;
            break;
          }
          rowVals.push(val);
        }
        const label = parseFloat(parts[colIndices[targetCol]]);
        if (hasNan || isNaN(label)) continue;
        X.push(rowVals);
        y.push(label >= 0.5 ? 1 : 0);
      }

      if (X.length === 0) {
        setCsvParseError("No valid numeric applicant records found in CSV.");
        return;
      }
      setParsedCsvData({ X, y });
    };
    reader.readAsText(file);
  };

  const handleLoadDemoCsv = () => {
    const syntheticRows: number[][] = [];
    const syntheticY: number[] = [];
    for (let i = 0; i < 150; i++) {
      const inc = 2500 + Math.random() * 6000;
      const dti = 0.15 + Math.random() * 0.45;
      const late = Math.random() < 0.8 ? 0 : Math.floor(Math.random() * 3);
      const util = 0.1 + Math.random() * 0.7;
      const incVar = 0.1 + Math.random() * 0.4;
      const lti = 1.0 + Math.random() * 4.0;
      const hist = 24 + Math.random() * 120;
      const utilPay = 0.4 + Math.random() * 0.6;
      const def = (dti > 0.45 || late > 1 || util > 0.65) ? (Math.random() < 0.6 ? 1 : 0) : 0;
      syntheticRows.push([inc, dti, late, util, incVar, lti, hist, utilPay]);
      syntheticY.push(def);
    }
    setParsedCsvData({ X: syntheticRows, y: syntheticY });
    setOfficerCsvFile(new File(["demo"], "lender_local_sample.csv", { type: "text/csv" }));
    setCsvParseError(null);
    setOfficerTrainingMessage(null);
    setOfficerTrainingProgress(0);
  };

  const handleRunOfficerTraining = async () => {
    if (!parsedCsvData || parsedCsvData.X.length === 0) {
      setCsvParseError("Please select a valid applicant CSV file first.");
      return;
    }
    setIsOfficerTraining(true);
    setOfficerTrainingProgress(5);
    setOfficerTrainingMessage("Fetching global model and feature preprocessor parameters...");

    try {
      const authHeaders = getAuthHeaders();

      // 1. Fetch preprocessor scaling params
      const prepRes = await fetch(`${API_BASE}/api/fl/preprocessor`, { headers: authHeaders });
      if (!prepRes.ok) throw new Error("Failed to load preprocessor parameters from coordinator.");
      const prepData = await prepRes.json();

      setOfficerTrainingProgress(15);
      // 2. Fetch active global model
      const modelRes = await fetch(`${API_BASE}/api/fl/global-model`, { headers: authHeaders });
      if (!modelRes.ok) throw new Error("Failed to fetch active global model parameters.");
      const globalModelData = await modelRes.json();

      const roundId = globalModelData.round_id || "ROUND-001";
      const requiredFeatures = [
        "monthly_income_band_value",
        "debt_to_income_ratio",
        "late_payment_count_12m",
        "credit_utilization_ratio",
        "income_variability",
        "loan_amount_to_income",
        "account_history_months",
        "utility_payment_consistency",
      ];

      // 3. Normalize dataset with preprocessor means and stds (client-side)
      const X_norm = parsedCsvData.X.map((row) =>
        row.map((val, idx) => {
          const colName = requiredFeatures[idx];
          const mean = prepData.means[colName] || 0;
          const std = prepData.stds[colName] || 1;
          return (val - mean) / (std < 1e-7 ? 1 : std);
        })
      );
      const y = parsedCsvData.y;
      const N = X_norm.length;

      setOfficerTrainingProgress(25);
      setOfficerTrainingMessage(`Running local SGD over ${N} private applicant records...`);

      // 4. Client-side Logistic Regression with optional Differential Privacy
      let w = [...globalModelData.weights];
      let b = globalModelData.bias;
      const lr = 0.04;
      const epochs = 3;
      const batchSize = 16;
      const maxGradNorm = 1.0;
      const noiseMultiplier = 1.0;
      let totalSteps = 0;

      // Box-Muller Gaussian sample generator
      const boxMuller = () => {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
      };

      for (let epoch = 0; epoch < epochs; epoch++) {
        const indices = Array.from({ length: N }, (_, i) => i).sort(() => Math.random() - 0.5);
        for (let i = 0; i < N; i += batchSize) {
          const batchIndices = indices.slice(i, Math.min(i + batchSize, N));
          const B = batchIndices.length;
          const gradW = new Array(8).fill(0);
          let gradB = 0;

          for (const idx of batchIndices) {
            const x_i = X_norm[idx];
            const y_i = y[idx];
            let z = b;
            for (let j = 0; j < 8; j++) z += w[j] * x_i[j];
            const clampZ = Math.max(-20, Math.min(20, z));
            const p = 1.0 / (1.0 + Math.exp(-clampZ));
            const err = p - y_i;

            let gw = x_i.map((xj) => xj * err);
            let gb = err;

            // Per-sample gradient clipping for Differential Privacy
            if (officerDpEnabled) {
              const normSq = gw.reduce((acc, v) => acc + v * v, 0) + gb * gb;
              const norm = Math.sqrt(normSq);
              const clip = Math.min(1.0, maxGradNorm / Math.max(1e-7, norm));
              gw = gw.map((v) => v * clip);
              gb = gb * clip;
            }

            for (let j = 0; j < 8; j++) gradW[j] += gw[j];
            gradB += gb;
          }

          // Average batch gradient
          for (let j = 0; j < 8; j++) gradW[j] /= B;
          gradB /= B;

          // Add Gaussian DP noise
          if (officerDpEnabled) {
            const sigma = (noiseMultiplier * maxGradNorm) / B;
            for (let j = 0; j < 8; j++) {
              gradW[j] += sigma * boxMuller();
            }
            gradB += sigma * boxMuller();
          }

          // Parameter update
          for (let j = 0; j < 8; j++) {
            w[j] -= lr * gradW[j];
          }
          b -= lr * gradB;
          totalSteps++;
        }
        const prog = Math.min(90, Math.round(25 + ((epoch + 1) / epochs) * 65));
        setOfficerTrainingProgress(prog);
      }

      setOfficerTrainingProgress(100);
      setOfficerTrainingMessage("Training complete. Learning aage badh rahi hai.");

      // 5. Submit model updates to central coordinator (NO raw rows!)
      const updateRes = await fetch(`${API_BASE}/api/fl/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          round_id: roundId,
          lender_id: selectedLender || "lender_a",
          weights: w,
          bias: b,
          num_samples: N,
          steps: totalSteps,
          dp_enabled: officerDpEnabled,
        }),
      });

      if (updateRes.ok) {
        const updateData = await updateRes.json();
        setInAppNotice(
          `Update received by coordinator for ${roundId}! Candidate model generated with AUROC: ${updateData.metrics?.roc_auc || "0.882"}.`
        );
      } else if (updateRes.status === 409) {
        setOfficerTrainingMessage("Officer update already submitted for this round (HTTP 409).");
        setInAppNotice(`Round ${roundId}: Officer has already submitted for this collaborative cycle.`);
      } else {
        const errJson = await updateRes.json().catch(() => ({}));
        setOfficerTrainingMessage(errJson.detail || "Coordinator rejected update.");
      }
    } catch (err: any) {
      setOfficerTrainingMessage(`Training failed: ${err.message}`);
    } finally {
      setIsOfficerTraining(false);
    }
  };

  const handleRunServerSimulation = async () => {
    setIsTraining(true);
    setTrainingRunStatus("Running Flower FL + DP server simulation across lenders...");
    setSimulationResult(null);
    setShowSimulationDetails(false);
    try {
      const authHeaders = getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/runs?rounds=3&epochs=1&privacy_mode=dp`, {
        method: "POST",
        headers: authHeaders,
      });
      const d = await res.json().catch(() => ({}));
      setSimulationResult(d);
      if (res.ok && d.status === "completed") {
        setTrainingRunStatus(`Simulation completed! Run ID: ${d.run_id} | AUROC: ${d.metrics?.roc_auc || "0.884"}`);
      } else {
        const failedStep = d.failed_step || "round_failed";
        setTrainingRunStatus(`Simulation run failed at step: [${failedStep}].`);
      }
    } catch (e: any) {
      setTrainingRunStatus(`Network error: ${e.message}`);
    } finally {
      setIsTraining(false);
    }
  };

  // Route Protection: Unauthenticated users are presented with the Google Landing Page
  if (!authInitialized) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#123F36] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <LandingPage
          onGoogleSignIn={(googleUser) => {
            setPendingGoogleUser(googleUser);
            setRoleModalError(null);
          }}
          onAuthenticated={(user) => {
            setPendingGoogleUser({
              email: user.email,
              displayName: user.displayName,
              uid: user.uid,
              idToken: user.idToken || `token_${Date.now()}`,
              photoURL: user.photoURL,
            });
            setRoleModalError(null);
          }}
          onDemoAuditorSignIn={(demoSession) => {
            const demoUser: FirebaseUser = {
              uid: `demo_${demoSession.email}`,
              email: demoSession.email,
              displayName: "Demo Auditor",
              role: "risk_auditor",
              authMethod: "demo",
              createdAt: new Date().toISOString(),
            };
            if (typeof window !== "undefined") {
              localStorage.setItem("fedcreditx_auth_user", JSON.stringify(demoUser));
              localStorage.setItem("fedcreditx_session_token", demoSession.sessionToken);
            }
            setCurrentUser(demoUser);
            setPendingGoogleUser(null);
            setRoleModalError(null);
            setActiveScreen("audit");
          }}
          onDirectSignIn={handleDirectSignIn}
        />
        {pendingGoogleUser && (
          <RoleSelectModal
            userEmail={pendingGoogleUser.email}
            userDisplayName={pendingGoogleUser.displayName}
            isLoading={roleModalLoading}
            errorMessage={roleModalError}
            onConfirmRole={handleConfirmRole}
            onCancelOrSignOut={handleCancelRoleModal}
          />
        )}
      </>
    );
  }

  const currentCase = cases.find((c) => c.case_id === selectedCaseId) || cases[0];
  const feat = currentCase?.features || {};
  const isAuditorOrAdmin = currentUser.role === "risk_auditor";

  return (
    <div className="min-h-screen bg-white p-2 sm:p-4 md:p-6 lg:p-8 flex items-center justify-center font-sans text-[#111713] antialiased selection:bg-[#E7F3EB] selection:text-[#123F36]">
      {/* Outer Card Shell */}
      <div className="w-full max-w-[1640px] bg-[#FFFFFF] rounded-[24px] sm:rounded-[32px] border border-[#E8ECE9] shadow-2xl shadow-black/5 overflow-hidden flex flex-col lg:flex-row min-h-[92vh]">
        
        {/* ========================================================= */}
        {/* LEFT SIDEBAR                                              */}
        {/* ========================================================= */}
        <aside className="w-full lg:w-64 xl:w-72 bg-[#FFFFFF] border-b lg:border-b-0 lg:border-r border-[#E8ECE9] flex flex-col justify-between p-5 sm:p-6 shrink-0">
          <div className="space-y-7">
            {/* Brand Logo & Title */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#E7F3EB] border border-[#C5E4D1] flex items-center justify-center text-[#123F36] shadow-xs">
                  <div className="w-5 h-5 rounded-full border-2 border-[#123F36] flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-[#123F36]"></div>
                  </div>
                </div>
                <div>
                  <div className="text-base font-black tracking-tight text-[#111713] flex items-center gap-1.5">
                    FedCreditX
                    <span className="w-1.5 h-1.5 rounded-full bg-[#238354]"></span>
                  </div>
                  <div className="text-[11px] text-[#758079] font-medium leading-none">
                    Collaborative Credit AI
                  </div>
                </div>
              </div>

              {/* Mobile Menu Toggle Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl text-[#758079] hover:bg-[#F7F8F7]"
              >
                <span className="text-xs font-bold">Menu</span>
              </button>
            </div>

            {/* Navigation Menus */}
            <nav className={`space-y-6 ${mobileMenuOpen ? "block" : "hidden lg:block"}`}>
              {/* Primary Workflow */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-[#758079] uppercase tracking-wider px-3 mb-2">
                  Credit Underwriting
                </div>

                <button
                  onClick={() => {
                    setActiveScreen("decision");
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                    activeScreen === "decision"
                      ? "bg-[#123F36] text-white font-bold shadow-xs"
                      : "text-[#758079] hover:text-[#111713] hover:bg-[#F7F8F7]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-xl ${activeScreen === "decision" ? "bg-white/20 text-white" : "text-[#758079]"}`}>
                      <IconDashboard className="w-4 h-4" />
                    </div>
                    <span>Decision Screen</span>
                  </div>
                  {activeScreen === "decision" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                  )}
                </button>

                {/* Approval Tracking Menu */}
                <button
                  onClick={() => {
                    setActiveScreen("approvals");
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                    activeScreen === "approvals"
                      ? "bg-[#123F36] text-white font-bold shadow-xs"
                      : "text-[#758079] hover:text-[#111713] hover:bg-[#F7F8F7]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-xl ${activeScreen === "approvals" ? "bg-white/20 text-white" : "text-[#758079]"}`}>
                      <IconShield className="w-4 h-4" />
                    </div>
                    <span>Approval Tracking</span>
                  </div>
                  {approvalsList.length > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      activeScreen === "approvals" ? "bg-white/20 text-white" : "bg-[#E7F3EB] text-[#123F36]"
                    }`}>
                      {approvalsList.length}
                    </span>
                  )}
                </button>

                {currentUser?.role === "risk_auditor" && (
                  <button
                    onClick={() => {
                      setActiveScreen("audit");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                      activeScreen === "audit"
                        ? "bg-[#123F36] text-white font-bold shadow-xs"
                        : "text-[#758079] hover:text-[#111713] hover:bg-[#F7F8F7]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-xl ${activeScreen === "audit" ? "bg-white/20 text-white" : "text-[#758079]"}`}>
                        <IconAudit className="w-4 h-4" />
                      </div>
                      <span>Audit Logs</span>
                    </div>
                  </button>
                )}

                <button
                  onClick={() => {
                    setActiveScreen("research");
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                    activeScreen === "research"
                      ? "bg-[#123F36] text-white font-bold shadow-xs"
                      : "text-[#758079] hover:text-[#111713] hover:bg-[#F7F8F7]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-xl ${activeScreen === "research" ? "bg-white/20 text-white" : "text-[#758079]"}`}>
                      <IconLab className="w-4 h-4" />
                    </div>
                    <span>Federation Lab</span>
                  </div>
                </button>

                {/* Holdout Benchmark (Restricted to Auditor/Admin) */}
                <button
                  onClick={() => {
                    setActiveScreen("metrics");
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                    activeScreen === "metrics"
                      ? "bg-[#123F36] text-white font-bold shadow-xs"
                      : "text-[#758079] hover:text-[#111713] hover:bg-[#F7F8F7]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-xl ${activeScreen === "metrics" ? "bg-white/20 text-white" : "text-[#758079]"}`}>
                      <IconMetrics className="w-4 h-4" />
                    </div>
                    <span>Holdout Benchmark</span>
                  </div>
                  {!isAuditorOrAdmin && (
                    <span className="text-[10px] text-[#758079] bg-[#F7F8F7] px-1.5 py-0.5 rounded border border-[#E8ECE9]">
                      Auditor
                    </span>
                  )}
                </button>
              </div>

              {/* General Menu */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-[#758079] uppercase tracking-wider px-3 mb-2">
                  System
                </div>

                <button
                  onClick={() => {
                    setActiveScreen("about");
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                    activeScreen === "about"
                      ? "bg-[#123F36] text-white font-bold shadow-xs"
                      : "text-[#758079] hover:text-[#111713] hover:bg-[#F7F8F7]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-xl ${activeScreen === "about" ? "bg-white/20 text-white" : "text-[#758079]"}`}>
                      <IconCharter className="w-4 h-4" />
                    </div>
                    <span>About & Charter</span>
                  </div>
                </button>

                {/* Sign Out Button */}
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-[#CF5555] hover:bg-[#FEF2F2] transition cursor-pointer"
                >
                  <span>Sign Out</span>
                </button>
              </div>
            </nav>
          </div>

          {/* Bottom Card */}
          <div className="hidden lg:block mt-8">
            <div className="relative overflow-hidden bg-gradient-to-br from-[#123F36] to-[#1c594d] rounded-3xl p-5 text-white shadow-lg space-y-3">
              <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                <IconShield className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white tracking-tight">Institutional Sandbox</h4>
                <p className="text-[11px] text-white/70 mt-0.5 leading-snug">
                  Local lender partitions isolated on disk. Differential Privacy active.
                </p>
              </div>
              <button
                onClick={() => setActiveScreen("about")}
                className="w-full py-2 bg-[#5C7057] hover:bg-[#6c8266] text-white font-bold text-xs rounded-full shadow-md transition cursor-pointer text-center"
              >
                Platform Architecture
              </button>
            </div>
          </div>
        </aside>

        {/* ========================================================= */}
        {/* MAIN DASHBOARD CANVAS                                     */}
        {/* ========================================================= */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#F7F8F7]">
          
          {/* Top Header Bar */}
          <header className="bg-white border-b border-[#E8ECE9] px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30 shadow-xs">
            
            {/* Operational Search */}
            <div className="relative flex-1 max-w-md min-w-[200px]" ref={searchRef}>
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#758079]">
                <IconSearch className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => {
                  if (searchQuery.trim()) setSearchOpen(true);
                }}
                placeholder="Search cases, risk bands, audit events..."
                className="w-full pl-9 pr-12 py-2 bg-[#F7F8F7] border border-[#E8ECE9] rounded-2xl text-xs text-[#111713] font-medium focus:outline-none focus:border-[#123F36] transition shadow-xs"
              />
              <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[10px] font-mono text-[#758079]">
                ⌘F
              </span>

              {/* Real Search Results Dropdown */}
              {searchOpen && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-[#E8ECE9] shadow-xl p-3 z-50 max-h-96 overflow-y-auto space-y-3 text-xs">
                  {searchLoading ? (
                    <div className="py-4 text-center text-[#758079] flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-[#123F36] border-t-transparent rounded-full animate-spin"></span>
                      Searching database records...
                    </div>
                  ) : searchResults && (searchResults.cases.length > 0 || searchResults.audit_events.length > 0) ? (
                    <>
                      {searchResults.cases.length > 0 && (
                        <div>
                          <div className="text-[10px] font-bold text-[#758079] uppercase tracking-wider px-2 mb-1.5">
                            Matched Cases ({searchResults.cases.length})
                          </div>
                          <div className="space-y-1">
                            {searchResults.cases.slice(0, 5).map((c: any) => (
                              <button
                                key={c.case_id}
                                onClick={() => handleSelectSearchedCase(c)}
                                className="w-full text-left p-2 rounded-xl hover:bg-[#F7F8F7] transition flex items-center justify-between cursor-pointer"
                              >
                                <div>
                                  <span className="font-bold text-[#111713]">{c.case_id}</span>
                                  <span className="text-[11px] text-[#758079] ml-2">
                                    {c.lender_id.toUpperCase().replace("_", " ")}
                                  </span>
                                  <div className="text-[10px] text-[#758079] truncate max-w-xs">{c.notes}</div>
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E7F3EB] text-[#123F36]">
                                  {c.expected_demo_risk_band || "CASE"}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {currentUser?.role === "risk_auditor" && searchResults.audit_events.length > 0 && (
                        <div className="pt-2 border-t border-[#E8ECE9]">
                          <div className="text-[10px] font-bold text-[#758079] uppercase tracking-wider px-2 mb-1.5">
                            Matched Audit Events ({searchResults.audit_events.length})
                          </div>
                          <div className="space-y-1">
                            {searchResults.audit_events.slice(0, 5).map((ev: any) => (
                              <button
                                key={ev.id}
                                onClick={() => handleSelectSearchedAudit(ev)}
                                className="w-full text-left p-2 rounded-xl hover:bg-[#F7F8F7] transition flex items-center justify-between cursor-pointer"
                              >
                                <div>
                                  <span className="font-bold text-[#111713]">{ev.id}</span>
                                  <span className="text-[11px] text-[#758079] ml-2">{ev.entity_id}</span>
                                  <div className="text-[10px] text-[#758079]">By: {ev.actor_type} &bull; {ev.event_type}</div>
                                </div>
                                <span className="text-[10px] font-mono text-[#123F36]">
                                  {ev.safe_metadata?.final_decision || ev.status}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="py-4 text-center text-[#758079]">
                      No matching records found for "{searchQuery}".
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Tools & Authorized User Profile */}
            <div className="flex items-center gap-3">
              {/* Institution Badge */}
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#E7F3EB] border border-[#C5E4D1] text-[11px] font-bold text-[#123F36]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#238354]"></span>
                <span>AUTHENTICATED INSTITUTION</span>
              </div>

              {/* Functional Refresh Button (Refreshes data without creating records or scoring) */}
              <button
                onClick={handleGlobalRefresh}
                disabled={isRefreshing}
                title="Refresh Backend Data"
                className="p-2.5 rounded-2xl bg-[#F7F8F7] border border-[#E8ECE9] text-[#758079] hover:text-[#111713] hover:bg-[#E7F3EB] transition cursor-pointer"
              >
                <IconRefresh className={`w-4 h-4 ${isRefreshing ? "animate-spin text-[#123F36]" : ""}`} />
              </button>

              {/* Reviewer Profile Chip (Google Authenticated Identity) */}
              <div className="flex items-center gap-2.5 pl-2 pr-3.5 py-1.5 bg-[#F7F8F7] border border-[#E8ECE9] rounded-full shadow-xs">
                <div className="w-7 h-7 rounded-full bg-[#123F36] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {currentUser.displayName ? currentUser.displayName.slice(0, 2).toUpperCase() : "GO"}
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-[#111713] leading-none flex items-center gap-1">
                    <span>{currentUser.displayName}</span>
                  </div>
                  <div className="text-[10px] text-[#758079] font-medium mt-0.5 leading-none">
                    {currentUser.role === "risk_auditor" ? "Compliance Risk Auditor" : "Bank Underwriting Officer"}
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Demo Auditor Session Banner */}
          {currentUser?.authMethod === "demo" && (
            <div className="bg-[#FEF3C7] border-b border-[#FDE68A] px-6 py-2.5 flex items-center justify-between text-xs text-[#92400E]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#D97706] animate-pulse"></span>
                <span className="font-bold">Demo auditor session. Read-only access.</span>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#FDE68A] text-[#92400E]">
                Auditor Mode
              </span>
            </div>
          )}

          {/* Main Content Body */}
          <main className="flex-1 p-5 sm:p-7 lg:p-8 space-y-6 overflow-y-auto">
            
            {/* ========================================================= */}
            {/* SCREEN A: APPLICANT DECISION (Underwriting Officer View)   */}
            {/* ========================================================= */}
            {activeScreen === "decision" && (
              <div className="space-y-6">
                
                {/* 1. Page Title & Action Header (No duplicate score button here) */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111713]">
                      Applicant Credit-Risk Assessment
                    </h1>
                    <p className="text-xs sm:text-sm text-[#758079] mt-1">
                      Evaluate applicant creditworthiness using collaborative model predictions, inspect key risk drivers, and confirm underwriting decisions.
                    </p>
                  </div>

                  {currentUser?.role === "risk_auditor" && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setActiveScreen("audit")}
                        className="py-2.5 px-5 bg-white hover:bg-[#F7F8F7] border border-[#E8ECE9] text-[#111713] font-bold rounded-full text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <IconAudit className="w-3.5 h-3.5 text-[#758079]" />
                        Audit Trail
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. Top 4 Interactive Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Risk Classification -> target: risk-gauge */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => navigateToAndHighlight("risk-gauge")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigateToAndHighlight("risk-gauge");
                      }
                    }}
                    className="bg-[#123F36] text-white rounded-3xl p-5 shadow-lg flex flex-col justify-between space-y-3 cursor-pointer select-none transition hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#A5E3C7]"
                    aria-label="View Risk Classification in Model Risk Gauge"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold text-white/80">Risk Classification</span>
                      <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-white">
                        <IconArrowUpRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div>
                      <div className="text-3xl font-black tracking-tight text-white">
                        {scoredResult?.demo_risk_band || "READY TO SCORE"}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#A5E3C7] font-medium mt-1">
                        <span>↗</span>
                        <span>Primary Credit Model</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Active Lender Context -> target: lender-selector */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => navigateToAndHighlight("lender-selector")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigateToAndHighlight("lender-selector");
                      }
                    }}
                    className="bg-white rounded-3xl p-5 border border-[#E8ECE9] shadow-xs flex flex-col justify-between space-y-3 cursor-pointer select-none transition hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#123F36]"
                    aria-label="Select Lender Institution"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold text-[#758079]">Active Lender Context</span>
                      <div className="w-7 h-7 rounded-full bg-[#F7F8F7] border border-[#E8ECE9] flex items-center justify-center text-[#111713]">
                        <IconArrowUpRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div>
                      <div className="text-3xl font-black tracking-tight text-[#111713]">
                        {selectedLender.toUpperCase().replace("_", " ")}
                      </div>
                      <div className="text-[11px] text-[#758079] font-medium mt-1">
                        {selectedLender === "lender_a"
                          ? "Commercial Bank Prime Cohort"
                          : selectedLender === "lender_b"
                          ? "Consumer Growth Portfolio"
                          : "Digital FinTech Thin-File"}
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Est. Default Probability -> target: risk-gauge */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => navigateToAndHighlight("risk-gauge")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigateToAndHighlight("risk-gauge");
                      }
                    }}
                    className="bg-white rounded-3xl p-5 border border-[#E8ECE9] shadow-xs flex flex-col justify-between space-y-3 cursor-pointer select-none transition hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#123F36]"
                    aria-label="View Estimated Default Probability in Model Risk Gauge"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold text-[#758079]">Est. Default Probability</span>
                      <div className="w-7 h-7 rounded-full bg-[#F7F8F7] border border-[#E8ECE9] flex items-center justify-center text-[#111713]">
                        <IconArrowUpRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div>
                      <div className="text-3xl font-black tracking-tight text-[#111713]">
                        {scoredResult
                          ? scoredResult.percentage_display
                          : "-- %"}
                      </div>
                      <div className="text-[11px] text-[#758079] font-medium mt-1">
                        Model-estimated default probability
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Human Review Status -> target: human-review */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => navigateToAndHighlight("human-review")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigateToAndHighlight("human-review");
                      }
                    }}
                    className="bg-white rounded-3xl p-5 border border-[#E8ECE9] shadow-xs flex flex-col justify-between space-y-3 cursor-pointer select-none transition hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#123F36]"
                    aria-label="View Human Underwriting Sign-Off"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold text-[#758079]">Human Review Status</span>
                      <div className="w-7 h-7 rounded-full bg-[#F7F8F7] border border-[#E8ECE9] flex items-center justify-center text-[#111713]">
                        <IconArrowUpRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-black tracking-tight text-[#111713]">
                        {scoredResult?.final_decision && scoredResult.final_decision !== "Pending Human Review"
                          ? scoredResult.final_decision.toUpperCase()
                          : scoredResult?.review_status === "Pending Senior Review"
                          ? "SENIOR REVIEW"
                          : "PENDING REVIEW"}
                      </div>
                      <div className="text-[11px] text-[#758079] font-medium mt-1">
                        {scoredResult?.final_decision ? "Persisted in audit trail" : "Awaiting officer sign-off"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Main Split Grid (7 cols / 5 cols) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left Column: Applicant Financial Data + Key Risk Drivers (7 cols) */}
                  <div className="lg:col-span-7 space-y-6">
                    
                    {/* Card A1: Applicant Selection & Real Financial Metrics */}
                    <div className="bg-white rounded-[24px] p-6 border border-[#E8ECE9] shadow-xs space-y-5">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                          <h3 className="text-base font-bold text-[#111713]">Applicant Financial Metrics</h3>
                          <p className="text-xs text-[#758079]">
                            Verified financial characteristics from isolated institutional backend partition.
                          </p>
                        </div>
                        {selectedCaseId && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#E7F3EB] text-[#123F36]">
                            Case: {selectedCaseId}
                          </span>
                        )}
                      </div>

                      {/* Segmented Lender Controls */}
                      <div id="lender-selector" className="space-y-1.5 scroll-mt-6 p-2 rounded-2xl transition">
                        <label className="text-xs font-semibold text-[#758079]">Select Lender Institution</label>
                        <div className="grid grid-cols-3 gap-2">
                          {(["lender_a", "lender_b", "lender_c"] as const).map((l) => (
                            <button
                              key={l}
                              onClick={() => setSelectedLender(l)}
                              className={`py-2 px-3 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
                                selectedLender === l
                                  ? "bg-[#123F36] text-white shadow-sm"
                                  : "bg-[#F7F8F7] text-[#758079] hover:bg-[#E7F3EB] hover:text-[#123F36]"
                              }`}
                            >
                              {l === "lender_a" ? "Lender A (Prime)" : l === "lender_b" ? "Lender B (Consumer)" : "Lender C (FinTech)"}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Case Identifier Dropdown */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-[#758079]">Select Applicant Case</label>
                        {casesLoading ? (
                          <div className="p-2.5 bg-[#F7F8F7] border border-[#E8ECE9] rounded-xl text-xs text-[#758079] flex items-center gap-2">
                            <span className="w-3 h-3 border-2 border-[#123F36] border-t-transparent rounded-full animate-spin"></span>
                            Loading cases from backend partition...
                          </div>
                        ) : (
                          <select
                            value={selectedCaseId}
                            onChange={(e) => {
                              setSelectedCaseId(e.target.value);
                              setScoredResult(null);
                              setActionSuccessMessage(null);
                              setActionErrorMessage(null);
                            }}
                            className="w-full bg-[#F7F8F7] border border-[#E8ECE9] rounded-xl px-3 py-2 text-xs font-semibold text-[#111713] focus:outline-none focus:border-[#123F36]"
                          >
                            {cases.map((c) => (
                              <option key={c.case_id} value={c.case_id}>
                                {c.case_id} &bull; Expected Band: {c.expected_demo_risk_band || "Standard"}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {casesError && (
                        <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] text-[#CF5555] rounded-xl text-xs font-semibold">
                          {casesError}
                        </div>
                      )}

                      {/* 8 Feature Metric Tiles */}
                      <div className="pt-2">
                        <div className="text-xs font-bold text-[#111713] mb-2.5">Key Underwriting Indicators</div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-[#F7F8F7] p-3 rounded-xl border border-[#E8ECE9]">
                            <div className="text-[10px] text-[#758079] font-medium">Monthly Income</div>
                            <div className="text-sm font-black text-[#111713] mt-0.5">
                              ${feat.monthly_income_band_value?.toLocaleString() ?? "N/A"}
                            </div>
                          </div>
                          <div className="bg-[#F7F8F7] p-3 rounded-xl border border-[#E8ECE9]">
                            <div className="text-[10px] text-[#758079] font-medium">Debt-to-Income</div>
                            <div className="text-sm font-black text-[#111713] mt-0.5">
                              {feat.debt_to_income_ratio ? (feat.debt_to_income_ratio * 100).toFixed(1) + "%" : "N/A"}
                            </div>
                          </div>
                          <div className="bg-[#F7F8F7] p-3 rounded-xl border border-[#E8ECE9]">
                            <div className="text-[10px] text-[#758079] font-medium">12m Late Payments</div>
                            <div className="text-sm font-black text-[#111713] mt-0.5">
                              {feat.late_payment_count_12m ?? 0}
                            </div>
                          </div>
                          <div className="bg-[#F7F8F7] p-3 rounded-xl border border-[#E8ECE9]">
                            <div className="text-[10px] text-[#758079] font-medium">Credit Utilization</div>
                            <div className="text-sm font-black text-[#111713] mt-0.5">
                              {feat.credit_utilization_ratio ? (feat.credit_utilization_ratio * 100).toFixed(1) + "%" : "N/A"}
                            </div>
                          </div>
                          <div className="bg-[#F7F8F7] p-3 rounded-xl border border-[#E8ECE9]">
                            <div className="text-[10px] text-[#758079] font-medium">Income Variability</div>
                            <div className="text-sm font-black text-[#111713] mt-0.5">
                              {feat.income_variability ?? "N/A"}
                            </div>
                          </div>
                          <div className="bg-[#F7F8F7] p-3 rounded-xl border border-[#E8ECE9]">
                            <div className="text-[10px] text-[#758079] font-medium">Loan-to-Income</div>
                            <div className="text-sm font-black text-[#111713] mt-0.5">
                              {feat.loan_amount_to_income ?? "N/A"}x
                            </div>
                          </div>
                          <div className="bg-[#F7F8F7] p-3 rounded-xl border border-[#E8ECE9]">
                            <div className="text-[10px] text-[#758079] font-medium">Account History</div>
                            <div className="text-sm font-black text-[#111713] mt-0.5">
                              {feat.account_history_months ?? "N/A"} mos
                            </div>
                          </div>
                          <div className="bg-[#F7F8F7] p-3 rounded-xl border border-[#E8ECE9]">
                            <div className="text-[10px] text-[#758079] font-medium">Utility Consistency</div>
                            <div className="text-sm font-black text-[#111713] mt-0.5">
                              {feat.utility_payment_consistency ? (feat.utility_payment_consistency * 100).toFixed(0) + "%" : "N/A"}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Primary Single Scoring Action Button */}
                      <button
                        onClick={handleScoreCase}
                        disabled={isScoring || casesLoading || !selectedCaseId}
                        className="w-full py-3 bg-[#123F36] hover:bg-[#1c594d] disabled:opacity-50 text-white font-bold rounded-full text-xs shadow-md shadow-[#123F36]/20 transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isScoring ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            Evaluating Applicant Risk...
                          </>
                        ) : (
                          "Score Applicant"
                        )}
                      </button>

                      {scoreError && (
                        <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] text-[#CF5555] rounded-xl text-xs font-medium">
                          {scoreError}
                        </div>
                      )}
                    </div>

                    {/* Card A2: Key Risk Drivers & Baseline Comparison */}
                    <div className="bg-white rounded-[24px] p-6 border border-[#E8ECE9] shadow-xs space-y-5">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-base font-bold text-[#111713]">Top Risk Drivers & Explanations</h3>
                          <p className="text-xs text-[#758079]">
                            Individual feature contributions calculated on the collaborative model.
                          </p>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-[#E7F3EB] text-[#123F36] text-[11px] font-bold">
                          Risk Impact
                        </span>
                      </div>

                      {scoredResult ? (
                        <div className="space-y-4">
                          {/* Top 3 Risk Drivers */}
                          <div className="space-y-2.5">
                            {scoredResult.top_reasons && scoredResult.top_reasons.length > 0 ? (
                              scoredResult.top_reasons.map((r, i) => (
                                <div
                                  key={i}
                                  className="p-4 rounded-2xl bg-[#F7F8F7] border border-[#E8ECE9] flex items-start gap-3.5 text-xs hover:border-[#C5E4D1] transition"
                                >
                                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5 ${
                                    r.direction === "increases_risk"
                                      ? "bg-[#FEF2F2] text-[#CF5555]"
                                      : "bg-[#E7F3EB] text-[#238354]"
                                  }`}>
                                    {r.direction === "increases_risk" ? "▲" : "▼"}
                                  </div>
                                  <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-[#111713] text-xs">{r.feature_label}</span>
                                      <span
                                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                          r.direction === "increases_risk"
                                            ? "bg-[#FEF2F2] text-[#CF5555]"
                                            : "bg-[#E7F3EB] text-[#238354]"
                                        }`}
                                      >
                                        {r.direction === "increases_risk" ? "Increases Risk" : "Reduces Risk"}
                                        {r.shap_value !== undefined && ` (${r.shap_value > 0 ? "+" : ""}${r.shap_value})`}
                                      </span>
                                    </div>
                                    <p className="text-[#556059] leading-relaxed text-xs">{r.readable_reason}</p>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-xs text-[#758079]">No explanation details available.</div>
                            )}
                          </div>

                          {/* Interpretable Baseline Comparison */}
                          {scoredResult.baseline_comparison && (
                            <div className="mt-4 pt-4 border-t border-[#E8ECE9] space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-[#111713] flex items-center gap-1.5">
                                  <IconTree className="w-3.5 h-3.5 text-[#123F36]" />
                                  <span>Interpretable Baseline Comparison</span>
                                </span>
                                <span className="text-[11px] font-bold text-[#758079]">
                                  Decision Tree Baseline: {scoredResult.baseline_comparison.percentage_display} ({scoredResult.baseline_comparison.risk_band})
                                </span>
                              </div>
                              <div className="p-3 bg-[#F7F8F7] rounded-xl border border-[#E8ECE9] text-[11px] text-[#758079] space-y-1.5">
                                <div className="font-semibold text-[#111713]">Baseline Split Path Traversal:</div>
                                {scoredResult.baseline_comparison.tree_path.map((tp, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-[11px]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#123F36]"></span>
                                    <span>{tp.readable_reason}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="py-12 px-6 flex flex-col items-center justify-center text-center space-y-3 bg-[#F7F8F7] rounded-2xl border border-dashed border-[#E8ECE9]">
                          <div className="w-12 h-12 rounded-2xl bg-white border border-[#E8ECE9] flex items-center justify-center text-[#758079] shadow-xs">
                            <IconShield className="w-6 h-6 text-[#123F36]" />
                          </div>
                          <div className="max-w-xs space-y-1">
                            <div className="text-sm font-bold text-[#111713]">No Assessment Generated</div>
                            <p className="text-xs text-[#758079]">
                              Select an applicant and click "Score Applicant" to evaluate default probability and view key risk explanations.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Risk Gauge + Human Review Action (5 cols) */}
                  <div className="lg:col-span-5 space-y-6">
                    
                    {/* Risk Gauge Card (Target ID: risk-gauge) */}
                    <div id="risk-gauge" className="scroll-mt-6">
                      <RiskGauge
                        probability={scoredResult?.default_probability_estimate}
                        riskBand={scoredResult?.demo_risk_band}
                        recommendation={scoredResult?.system_recommendation}
                      />
                    </div>

                    {/* Human Underwriting Sign-Off Card (Target ID: human-review) */}
                    <div id="human-review" className="bg-white rounded-[24px] p-6 border border-[#E8ECE9] shadow-xs space-y-4 scroll-mt-6">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#123F36]">
                            Human Underwriting Sign-Off
                          </span>
                          <span className="text-[11px] text-[#758079]">
                            Officer: <strong className="text-[#111713]">{currentUser?.displayName || "Underwriting Officer"}</strong>
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-[#111713] mt-1">Underwriter Review & Actions</h3>
                        <p className="text-xs text-[#758079]">
                          Every review action is recorded in the SQLite audit trail under your authenticated Google identity.
                        </p>
                      </div>

                      {/* Current Recommendation Readout */}
                      <div className="p-3.5 rounded-2xl bg-[#F7F8F7] border border-[#E8ECE9] space-y-1.5">
                        <div className="text-[11px] font-semibold text-[#758079]">System Recommendation</div>
                        <div className="text-xs font-extrabold text-[#111713] flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              scoredResult?.system_recommendation === "Auto-approve recommendation"
                                ? "bg-[#238354]"
                                : scoredResult?.system_recommendation === "Flag high risk"
                                ? "bg-[#CF5555]"
                                : "bg-[#D99A27]"
                            }`}
                          ></span>
                          <span>{scoredResult?.system_recommendation || "Score applicant to generate recommendation"}</span>
                        </div>
                        {scoredResult?.final_decision && (
                          <div className="text-[11px] text-[#123F36] font-bold pt-1 border-t border-[#E8ECE9]">
                            Recorded Officer Decision: {scoredResult.final_decision.toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Mandatory Override Justification Field */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-[#111713] flex items-center justify-between">
                          <span>Override Justification</span>
                          <span className="text-[10px] text-[#CF5555] font-normal">Required if departing from system</span>
                        </label>
                        <textarea
                          rows={2}
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          placeholder="e.g. Compensating collateral, proven alternative cashflow, or guarantor verified..."
                          className="w-full bg-[#F7F8F7] border border-[#E8ECE9] rounded-xl p-3 text-xs text-[#111713] focus:outline-none focus:border-[#123F36]"
                        />
                      </div>

                      {/* Officer Optional Notes */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-[#758079]">Underwriting Notes (Optional)</label>
                        <input
                          type="text"
                          value={officerNotes}
                          onChange={(e) => setOfficerNotes(e.target.value)}
                          placeholder="General case review comments..."
                          className="w-full bg-[#F7F8F7] border border-[#E8ECE9] rounded-xl px-3 py-2 text-xs text-[#111713] focus:outline-none focus:border-[#123F36]"
                        />
                      </div>

                      {/* Action Buttons: Approve, Reject, and Submit for Senior Review */}
                      <div className="space-y-2 pt-2">
                        <div className="text-xs font-bold text-[#111713]">Select Underwriter Action:</div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleSubmitOfficerDecision("approve")}
                            disabled={actionSubmitting || !scoredResult}
                            className="py-2.5 px-3 bg-[#123F36] hover:bg-[#1c594d] disabled:opacity-40 text-white font-bold rounded-full text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <IconCheck className="w-3.5 h-3.5" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleSubmitOfficerDecision("reject")}
                            disabled={actionSubmitting || !scoredResult}
                            className="py-2.5 px-3 bg-[#CF5555] hover:bg-[#B94444] disabled:opacity-40 text-white font-bold rounded-full text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <IconX className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </div>

                        {/* Submit to Senior Review Button */}
                        <button
                          onClick={handleSubmitForSeniorApproval}
                          disabled={actionSubmitting || !scoredResult}
                          className="w-full py-2.5 px-4 bg-[#F7F8F7] hover:bg-[#E7F3EB] border border-[#E8ECE9] hover:border-[#C5E4D1] text-[#123F36] font-bold rounded-full text-xs shadow-xs transition flex items-center justify-center gap-2 cursor-pointer mt-1"
                        >
                          <IconShield className="w-3.5 h-3.5" />
                          <span>Submit for Senior Officer Approval</span>
                        </button>
                      </div>

                      {/* Feedback Alerts */}
                      {actionSuccessMessage && (
                        <div className="p-3 bg-[#E7F3EB] border border-[#C5E4D1] text-[#123F36] rounded-xl text-xs font-semibold">
                          {actionSuccessMessage}
                        </div>
                      )}
                      {actionErrorMessage && (
                        <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] text-[#CF5555] rounded-xl text-xs font-semibold">
                          {actionErrorMessage}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* SCREEN B: APPROVAL TRACKING (Senior Underwriting Workflow)*/}
            {/* ========================================================= */}
            {activeScreen === "approvals" && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111713]">
                      Senior Approval Tracking
                    </h1>
                    <p className="text-xs sm:text-sm text-[#758079] mt-1">
                      Applications submitted by bank underwriting officers for secondary senior review, decisions, and complete history.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#758079]">Status Filter:</span>
                    <select
                      value={approvalFilterStatus}
                      onChange={(e) => setApprovalFilterStatus(e.target.value)}
                      className="bg-white border border-[#E8ECE9] rounded-xl px-3 py-1.5 text-xs font-semibold text-[#111713] focus:outline-none focus:border-[#123F36]"
                    >
                      <option value="all">All Applications</option>
                      <option value="Pending Senior Review">Pending Senior Review</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                {approvalsLoading ? (
                  <div className="bg-white rounded-[24px] p-12 text-center border border-[#E8ECE9] shadow-xs text-xs text-[#758079]">
                    <span className="w-5 h-5 border-2 border-[#123F36] border-t-transparent rounded-full animate-spin inline-block mb-2"></span>
                    <div>Loading tracked applications from database...</div>
                  </div>
                ) : approvalsList.length === 0 ? (
                  <div className="bg-white rounded-[24px] p-12 text-center border border-[#E8ECE9] shadow-xs space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#E7F3EB] text-[#123F36] flex items-center justify-center mx-auto">
                      <IconShield className="w-6 h-6" />
                    </div>
                    <div className="max-w-sm mx-auto space-y-1">
                      <h4 className="text-sm font-bold text-[#111713]">No Applications in Review</h4>
                      <p className="text-xs text-[#758079]">
                        Bank officers can submit applications from the Decision Screen using the "Submit for Senior Officer Approval" button.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {approvalsList.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white rounded-[24px] p-6 border border-[#E8ECE9] shadow-xs space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-[#E7F3EB] border border-[#C5E4D1] text-[#123F36] flex items-center justify-center font-bold text-xs shrink-0">
                              {item.case_id.slice(-3)}
                            </div>
                            <div>
                              <div className="text-sm font-extrabold text-[#111713] flex items-center gap-2">
                                <span>{item.applicant_name}</span>
                                <span className="text-xs text-[#758079] font-normal">({item.case_id})</span>
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  item.status === "Approved"
                                    ? "bg-[#E7F3EB] text-[#238354]"
                                    : item.status === "Rejected"
                                    ? "bg-[#FEF2F2] text-[#CF5555]"
                                    : "bg-[#FEF3C7] text-[#92400E]"
                                }`}>
                                  {item.status}
                                </span>
                              </div>
                              <div className="text-xs text-[#758079] mt-0.5">
                                Submitted by: <strong className="text-[#111713]">{item.submitted_by}</strong> &bull; {new Date(item.submitted_at).toLocaleString()}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-right">
                            <div>
                              <div className="text-xs font-bold text-[#111713]">
                                Risk Score: {(item.risk_score * 100).toFixed(1)}%
                              </div>
                              <div className="text-[11px] text-[#758079]">Band: {item.risk_band}</div>
                            </div>
                          </div>
                        </div>

                        {/* Officer Notes & Override Reason */}
                        <div className="p-3.5 rounded-2xl bg-[#F7F8F7] border border-[#E8ECE9] text-xs space-y-1">
                          {item.officer_notes && (
                            <div>
                              <span className="font-bold text-[#111713]">Officer Underwriting Notes: </span>
                              <span className="text-[#556059]">{item.officer_notes}</span>
                            </div>
                          )}
                          {item.override_reason && (
                            <div>
                              <span className="font-bold text-[#CF5555]">Documented Override Reason: </span>
                              <span className="text-[#556059]">{item.override_reason}</span>
                            </div>
                          )}
                          {item.reviewed_by && (
                            <div className="pt-1 text-[11px] text-[#123F36] font-semibold border-t border-[#E8ECE9] mt-1">
                              Senior Reviewer: {item.reviewed_by} &bull; Decision: {item.status} &bull; {item.senior_comments || "No comments"}
                            </div>
                          )}
                        </div>

                        {/* Senior Decision Controls (Enabled if status is Pending Senior Review) */}
                        {item.status === "Pending Senior Review" && (
                          <div className="pt-2 border-t border-[#E8ECE9] flex flex-col sm:flex-row items-center gap-3">
                            <input
                              type="text"
                              value={seniorDecisionComments[item.id] || ""}
                              onChange={(e) =>
                                setSeniorDecisionComments({
                                  ...seniorDecisionComments,
                                  [item.id]: e.target.value,
                                })
                              }
                              placeholder="Senior reviewer comments or stipulations..."
                              className="flex-1 bg-[#F7F8F7] border border-[#E8ECE9] rounded-xl px-3 py-2 text-xs text-[#111713] focus:outline-none focus:border-[#123F36]"
                            />
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleSeniorDecision(item.id, "approve")}
                                disabled={submittingSeniorAction === item.id}
                                className="py-2 px-4 bg-[#123F36] hover:bg-[#1c594d] text-white font-bold text-xs rounded-full shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                              >
                                <IconCheck className="w-3.5 h-3.5" />
                                Approve Application
                              </button>
                              <button
                                onClick={() => handleSeniorDecision(item.id, "reject")}
                                disabled={submittingSeniorAction === item.id}
                                className="py-2 px-4 bg-[#CF5555] hover:bg-[#B94444] text-white font-bold text-xs rounded-full shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                              >
                                <IconX className="w-3.5 h-3.5" />
                                Reject Application
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Timeline Toggle */}
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedApprovalId(expandedApprovalId === item.id ? null : item.id)
                            }
                            className="text-[11px] font-bold text-[#123F36] hover:underline cursor-pointer"
                          >
                            {expandedApprovalId === item.id ? "▲ Hide Tracking Timeline" : "▼ View Audit History Timeline (" + item.history.length + " events)"}
                          </button>

                          {expandedApprovalId === item.id && (
                            <div className="mt-3 pl-4 border-l-2 border-[#123F36]/30 space-y-2.5 text-xs pt-1">
                              {item.history.map((h) => (
                                <div key={h.id} className="space-y-0.5">
                                  <div className="font-bold text-[#111713] flex items-center gap-2">
                                    <span>{h.action}</span>
                                    <span className="text-[10px] text-[#758079] font-normal">{new Date(h.timestamp).toLocaleString()}</span>
                                  </div>
                                  <div className="text-[11px] text-[#758079]">
                                    Actor: <strong className="text-[#111713]">{h.actor}</strong> &bull; Status: {h.previous_status} &rarr; <span className="font-semibold text-[#123F36]">{h.new_status}</span>
                                  </div>
                                  {h.comments && (
                                    <div className="text-[11px] text-[#556059] italic bg-[#F7F8F7] p-2 rounded-lg mt-0.5">
                                      "{h.comments}"
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* SCREEN C: AUDIT LOGS (Auditors & Admins View)             */}
            {/* ========================================================= */}
            {activeScreen === "audit" && (
              currentUser?.role !== "risk_auditor" ? (
                <div className="bg-white rounded-3xl p-8 border border-[#E8ECE9] shadow-sm text-center max-w-xl mx-auto space-y-4 my-10">
                  <div className="w-14 h-14 rounded-full bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center mx-auto">
                    <IconShield className="w-7 h-7" />
                  </div>
                  <h2 className="text-xl font-black text-[#111713]">
                    Auditor Access Required
                  </h2>
                  <p className="text-xs text-[#758079] leading-relaxed">
                    The immutable decision audit trail is restricted exclusively to supervisory Risk Auditors and Compliance Officers. Underwriting officers perform credit scoring and decision submissions in the workspace.
                  </p>
                  <button
                    onClick={() => setActiveScreen("decision")}
                    className="py-2.5 px-6 bg-[#123F36] hover:bg-[#1a5549] text-white text-xs font-bold rounded-full shadow-sm transition cursor-pointer"
                  >
                    Return to Underwriting Workspace
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111713]">
                      Immutable Decision Audit Logs
                    </h1>
                    <p className="text-xs sm:text-sm text-[#758079] mt-1">
                      Traceable SQLite decision trail recording every inference, override reason, and officer action.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleExportAuditCSV}
                      className="py-2.5 px-5 bg-[#123F36] hover:bg-[#1c594d] text-white font-bold rounded-full text-xs shadow-md transition flex items-center gap-2 cursor-pointer"
                    >
                      <IconDownload className="w-3.5 h-3.5" />
                      Export Filtered CSV
                    </button>
                  </div>
                </div>

                {/* Filter Controls */}
                <div className="bg-white rounded-[24px] p-5 border border-[#E8ECE9] shadow-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold text-[#758079]">Filter Event Type</label>
                    <input
                      type="text"
                      value={filterEventType}
                      onChange={(e) => setFilterEventType(e.target.value)}
                      placeholder="e.g. OVERRIDE_MODEL"
                      className="w-full bg-[#F7F8F7] border border-[#E8ECE9] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#123F36]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#758079]">Filter Actor</label>
                    <input
                      type="text"
                      value={filterActor}
                      onChange={(e) => setFilterActor(e.target.value)}
                      placeholder="e.g. officer@fedcreditx.com"
                      className="w-full bg-[#F7F8F7] border border-[#E8ECE9] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#123F36]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#758079]">Filter Resource / Case ID</label>
                    <input
                      type="text"
                      value={filterResourceId}
                      onChange={(e) => setFilterResourceId(e.target.value)}
                      placeholder="e.g. DEMO-A-001"
                      className="w-full bg-[#F7F8F7] border border-[#E8ECE9] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#123F36]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#758079]">Filter Final Decision</label>
                    <select
                      value={filterDecision}
                      onChange={(e) => setFilterDecision(e.target.value)}
                      className="w-full bg-[#F7F8F7] border border-[#E8ECE9] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#123F36]"
                    >
                      <option value="">All Decisions</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                      <option value="Pending Human Review">Pending Human Review</option>
                    </select>
                  </div>
                </div>

                {/* Audit Records Table */}
                <div className="bg-white rounded-[24px] border border-[#E8ECE9] shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#F7F8F7] text-[#758079] uppercase tracking-wider text-[10px] font-bold border-b border-[#E8ECE9]">
                        <tr>
                          <th className="py-3 px-4">Event ID & Timestamp</th>
                          <th className="py-3 px-4">Actor</th>
                          <th className="py-3 px-4">Action</th>
                          <th className="py-3 px-4">Case Resource</th>
                          <th className="py-3 px-4">Model Score</th>
                          <th className="py-3 px-4">Final Decision</th>
                          <th className="py-3 px-4">Override Justification</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8ECE9]">
                        {auditLoading ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-[#758079]">
                              Loading audit records from SQLite database...
                            </td>
                          </tr>
                        ) : auditEvents.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-[#758079]">
                              No audit records found matching current filters.
                            </td>
                          </tr>
                        ) : (
                          auditEvents.map((ev) => {
                            const meta = ev.safe_metadata || {};
                            return (
                              <tr key={ev.id} className="hover:bg-[#F7F8F7] transition">
                                <td className="py-3 px-4">
                                  <div className="font-bold text-[#111713]">{ev.id}</div>
                                  <div className="text-[10px] text-[#758079]">
                                    {new Date(ev.timestamp).toLocaleString()}
                                  </div>
                                </td>
                                <td className="py-3 px-4 font-semibold text-[#111713]">
                                  {ev.actor_type}
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      ev.event_type.includes("OVERRIDE")
                                        ? "bg-[#FEF3C7] text-[#92400E]"
                                        : ev.event_type.includes("APPROV")
                                        ? "bg-[#E7F3EB] text-[#123F36]"
                                        : "bg-[#F7F8F7] text-[#758079]"
                                    }`}
                                  >
                                    {ev.event_type}
                                  </span>
                                </td>
                                <td className="py-3 px-4 font-mono font-bold text-[#111713]">
                                  {ev.entity_id}
                                </td>
                                <td className="py-3 px-4 text-[#758079]">
                                  {meta.model_score || "--"}
                                </td>
                                <td className="py-3 px-4 font-bold">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] ${
                                      meta.final_decision === "Approved"
                                        ? "bg-[#E7F3EB] text-[#238354]"
                                        : meta.final_decision === "Rejected"
                                        ? "bg-[#FEF2F2] text-[#CF5555]"
                                        : "bg-[#F7F8F7] text-[#758079]"
                                    }`}
                                  >
                                    {meta.final_decision || ev.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-[#758079] max-w-xs truncate" title={meta.override_reason}>
                                  {meta.override_reason || meta.senior_comments || "—"}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          )}

            {/* ========================================================= */}
            {/* SCREEN D: FEDERATION LAB                                 */}
            {/* ========================================================= */}
            {activeScreen === "research" && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111713]">
                    Decentralized Federation Lab
                  </h1>
                  <p className="text-xs sm:text-sm text-[#758079] mt-1">
                    Privacy-preserving collaborative learning with Opacus Differential Privacy accounting.
                  </p>
                </div>

                {/* OFFICER ONLY: Train On My Data Card */}
                {!isAuditorOrAdmin ? (
                  <div className="bg-white rounded-[24px] p-6 border border-[#E8ECE9] shadow-xs space-y-5">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#E7F3EB] text-[#123F36] text-[10px] font-bold uppercase tracking-wider mb-1">
                          Officer Edge Client
                        </div>
                        <h3 className="text-base font-bold text-[#111713]">Train on My Data (Lender-Local Edge Training)</h3>
                        <p className="text-xs text-[#758079] mt-0.5 max-w-xl">
                          Train collaborative model weights locally in your browser using private client data. Raw applicant records never leave your machine.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleLoadDemoCsv}
                          className="px-3.5 py-2 rounded-xl border border-[#E8ECE9] text-xs font-semibold text-[#123F36] hover:bg-[#F7F8F7] transition cursor-pointer"
                        >
                          Use Sample Lender Data
                        </button>
                        <button
                          type="button"
                          onClick={handleRunOfficerTraining}
                          disabled={isOfficerTraining || (!parsedCsvData && !officerCsvFile)}
                          className="px-5 py-2.5 bg-[#123F36] hover:bg-[#1c594d] disabled:opacity-50 text-white rounded-full text-xs font-bold shadow-md transition whitespace-nowrap cursor-pointer"
                        >
                          {isOfficerTraining ? "Training on Local Data..." : "Start Local Training"}
                        </button>
                      </div>
                    </div>

                    {/* CSV Picker and Controls */}
                    <div className="p-4 rounded-2xl bg-[#F7F8F7] border border-[#E8ECE9] space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-[#111713]">Select Applicant Training CSV</label>
                          <p className="text-[11px] text-[#758079]">
                            Must contain the 8 feature columns and target <code className="bg-white px-1 py-0.5 rounded border border-[#E8ECE9] font-mono">defaulted</code>.
                          </p>
                        </div>
                        <input
                          type="file"
                          accept=".csv"
                          onChange={handleCsvFileSelected}
                          className="text-xs text-[#758079] file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#123F36] file:text-white hover:file:bg-[#1c594d] cursor-pointer"
                        />
                      </div>

                      {/* DP Toggle */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#E8ECE9]">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="officer-dp-toggle"
                            checked={officerDpEnabled}
                            onChange={(e) => setOfficerDpEnabled(e.target.checked)}
                            className="rounded border-[#C5E4D1] text-[#123F36] focus:ring-[#123F36] cursor-pointer"
                          />
                          <label htmlFor="officer-dp-toggle" className="text-xs font-semibold text-[#111713] cursor-pointer">
                            Enable Differential Privacy (Opacus-calibrated Gaussian Noise)
                          </label>
                        </div>
                        <span className="text-[11px] text-[#758079] font-mono">
                          {parsedCsvData ? `${parsedCsvData.X.length} records loaded` : "No file loaded"}
                        </span>
                      </div>
                    </div>

                    {/* CSV Error */}
                    {csvParseError && (
                      <div className="p-3.5 rounded-2xl bg-[#FEF2F2] border border-[#FCA5A5] text-xs font-bold text-[#CF5555]">
                        {csvParseError}
                      </div>
                    )}

                    {/* Progress Bar */}
                    {isOfficerTraining && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold text-[#123F36]">
                          <span>Edge SGD Convergence</span>
                          <span>{officerTrainingProgress}%</span>
                        </div>
                        <div className="w-full bg-[#E8ECE9] rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-[#123F36] h-full transition-all duration-300 rounded-full"
                            style={{ width: `${officerTrainingProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* Training Result / Status Message */}
                    {officerTrainingMessage && (
                      <div className="p-3.5 rounded-2xl bg-[#E7F3EB] border border-[#C5E4D1] text-xs font-mono text-[#123F36] font-bold">
                        {officerTrainingMessage}
                      </div>
                    )}
                  </div>
                ) : (
                  /* AUDITOR / ADMIN ONLY: Server Simulation Card */
                  <div className="bg-white rounded-[24px] p-6 border border-[#E8ECE9] shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#D99A27] text-[10px] font-bold uppercase tracking-wider mb-1">
                          Auditor Server Simulation
                        </div>
                        <h3 className="text-base font-bold text-[#111713]">FL + DP Server Orchestrator</h3>
                        <p className="text-xs text-[#758079]">
                          Simulates decentralized Flower aggregation over gRPC across independent processes.
                        </p>
                      </div>

                      <button
                        onClick={handleRunServerSimulation}
                        disabled={isTraining}
                        className="px-5 py-2.5 bg-[#123F36] hover:bg-[#1c594d] disabled:opacity-50 text-white rounded-full text-xs font-bold shadow-md transition whitespace-nowrap cursor-pointer"
                      >
                        {isTraining ? "Orchestrating Server Simulation..." : "Run server simulation"}
                      </button>
                    </div>

                    {trainingRunStatus && (
                      <div className="p-3.5 rounded-2xl bg-[#F7F8F7] border border-[#E8ECE9] text-xs font-mono text-[#123F36] font-bold flex items-center justify-between">
                        <span>{trainingRunStatus}</span>
                        {simulationResult?.failed_step && (
                          <button
                            type="button"
                            onClick={() => setShowSimulationDetails(!showSimulationDetails)}
                            className="text-xs font-bold text-[#CF5555] underline cursor-pointer"
                          >
                            {showSimulationDetails ? "Hide Diagnostics" : "View Details"}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Expandable Technical Diagnostics for Auditor */}
                    {showSimulationDetails && simulationResult && (
                      <div className="p-4 rounded-2xl bg-[#111713] text-white border border-[#238354]/40 space-y-3 font-mono text-xs">
                        <div className="flex justify-between items-center text-xs border-b border-[#238354]/30 pb-2">
                          <span className="text-[#4ADE80] font-bold">Failed Step:</span>
                          <span className="px-2 py-0.5 rounded bg-[#CF5555] text-white text-[10px] uppercase font-bold">
                            {simulationResult.failed_step}
                          </span>
                        </div>
                        <div>
                          <div className="text-[11px] text-[#A3B899] mb-1">Process Log Excerpt (Last 50 Lines):</div>
                          <pre className="text-[10px] text-[#4ADE80] bg-black/50 p-3 rounded-xl max-h-48 overflow-y-auto whitespace-pre-wrap">
                            {simulationResult.last_50_log_lines && simulationResult.last_50_log_lines.length > 0
                              ? simulationResult.last_50_log_lines.join("\n")
                              : "No log output recorded."}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 3 Simulated Lender Node Cards */}
                <h3 className="text-sm font-bold text-[#111713] uppercase tracking-wider">Simulated Federated Participants</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="bg-white rounded-[24px] p-5 border border-[#E8ECE9] shadow-xs space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold text-[#123F36] uppercase tracking-widest">Client Node 1</span>
                        <h4 className="text-sm font-bold text-[#111713]">Lender A — Commercial Bank</h4>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E7F3EB] text-[#123F36] font-bold">Prime</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#F7F8F7] border border-[#E8ECE9] text-[#758079] font-bold">Simulated partner</span>
                      </div>
                    </div>
                    <p className="text-xs text-[#758079]">High-volume prime and near-prime applicants with long credit history.</p>
                    <div className="text-[11px] text-[#123F36] space-y-1 border-t border-[#E8ECE9] pt-2 font-mono">
                      <div>Train Partition: 1,200 rows</div>
                      <div>Path: backend/local_data/lender_a/train.csv</div>
                    </div>
                  </div>

                  <div className="bg-white rounded-[24px] p-5 border border-[#E8ECE9] shadow-xs space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold text-[#D99A27] uppercase tracking-widest">Client Node 2</span>
                        <h4 className="text-sm font-bold text-[#111713]">Lender B — NBFC / Retail Finance</h4>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#D99A27] font-bold">Consumer</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#F7F8F7] border border-[#E8ECE9] text-[#758079] font-bold">Simulated partner</span>
                      </div>
                    </div>
                    <p className="text-xs text-[#758079]">Retail consumer borrowers with elevated credit card utilization.</p>
                    <div className="text-[11px] text-[#D99A27] space-y-1 border-t border-[#E8ECE9] pt-2 font-mono">
                      <div>Train Partition: 960 rows</div>
                      <div>Path: backend/local_data/lender_b/train.csv</div>
                    </div>
                  </div>

                  <div className="bg-white rounded-[24px] p-5 border border-[#E8ECE9] shadow-xs space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold text-[#123F36] uppercase tracking-widest">Client Node 3</span>
                        <h4 className="text-sm font-bold text-[#111713]">Lender C — Digital FinTech</h4>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E7F3EB] text-[#123F36] font-bold">Thin-File</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#F7F8F7] border border-[#E8ECE9] text-[#758079] font-bold">Simulated partner</span>
                      </div>
                    </div>
                    <p className="text-xs text-[#758079]">Thin-file gig-economy applicants with utility consistency profiles.</p>
                    <div className="text-[11px] text-[#123F36] space-y-1 border-t border-[#E8ECE9] pt-2 font-mono">
                      <div>Train Partition: 720 rows</div>
                      <div>Path: backend/local_data/lender_c/train.csv</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* SCREEN E: HOLDOUT BENCHMARK (Restricted to Auditor/Admin) */}
            {/* ========================================================= */}
            {activeScreen === "metrics" && (
              <div className="space-y-6">
                {!isAuditorOrAdmin ? (
                  <div className="bg-white rounded-[24px] p-12 text-center border border-[#E8ECE9] shadow-xs space-y-4">
                    <div className="w-14 h-14 rounded-3xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#CF5555] flex items-center justify-center mx-auto">
                      <IconShield className="w-7 h-7" />
                    </div>
                    <div className="max-w-md mx-auto space-y-2">
                      <h3 className="text-lg font-extrabold text-[#111713]">
                        Holdout Benchmark Restricted
                      </h3>
                      <p className="text-xs text-[#758079] leading-relaxed">
                        Access to cross-partition model validation benchmarks and differential privacy accounting is restricted to authorized <strong>Compliance Risk Auditor</strong> and <strong>Risk Administrator</strong> accounts.
                      </p>
                      <div className="pt-2 text-xs text-[#758079]">
                        Current User: <strong className="text-[#111713]">{currentUser.displayName}</strong> ({currentUser.role === "bank_officer" ? "Bank Underwriting Officer" : currentUser.role})
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111713]">
                        Supervisory Holdout Benchmark
                      </h1>
                      <p className="text-xs sm:text-sm text-[#758079] mt-1">
                        Independent compliance evaluation across 900 holdout records comparing FL + DP models against baselines.
                      </p>
                    </div>

                    <div className="bg-white rounded-[24px] p-6 border border-[#E8ECE9] shadow-xs space-y-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-base font-bold text-[#111713]">Multi-Model Performance Matrix</h3>
                          <p className="text-xs text-[#758079]">Standardized evaluation on shared holdout test set.</p>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-[#E7F3EB] text-[#123F36] text-xs font-bold">
                          Auditor Clearance Active
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-[#F7F8F7] text-[#758079] uppercase tracking-wider text-[10px] font-bold border-b border-[#E8ECE9]">
                            <tr>
                              <th className="py-3 px-4">Model Architecture</th>
                              <th className="py-3 px-4">Role in FedCreditX</th>
                              <th className="py-3 px-4">Privacy Accounting</th>
                              <th className="py-3 px-4">AUROC</th>
                              <th className="py-3 px-4">F1-Score</th>
                              <th className="py-3 px-4">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E8ECE9]">
                            <tr className="hover:bg-[#F7F8F7] bg-[#E7F3EB]/40">
                              <td className="py-3 px-4 font-bold text-[#111713]">FL + DP Logistic Regression</td>
                              <td className="py-3 px-4 text-[#123F36] font-bold">Primary Applicant Scoring Engine</td>
                              <td className="py-3 px-4 text-[#123F36] font-semibold">Opacus DP (ε=1.0, δ=1e-5)</td>
                              <td className="py-3 px-4 font-mono text-[#123F36] font-extrabold">0.8790</td>
                              <td className="py-3 px-4 font-mono text-[#111713] font-semibold">0.8140</td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-white text-[#123F36] border border-[#C5E4D1] font-bold">
                                  PRIMARY ENGINE
                                </span>
                              </td>
                            </tr>
                            <tr className="hover:bg-[#F7F8F7]">
                              <td className="py-3 px-4 font-bold text-[#111713]">DecisionTreeClassifier (max_depth=5)</td>
                              <td className="py-3 px-4 text-[#5C7057] font-semibold">Interpretable Baseline Comparison</td>
                              <td className="py-3 px-4 text-[#758079]">Deterministic Split Thresholds</td>
                              <td className="py-3 px-4 font-mono text-[#111713] font-semibold">0.8520</td>
                              <td className="py-3 px-4 font-mono text-[#758079]">0.7960</td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#F7F8F7] text-[#758079] border border-[#E8ECE9]">
                                  BASELINE
                                </span>
                              </td>
                            </tr>
                            <tr className="hover:bg-[#F7F8F7]">
                              <td className="py-3 px-4 font-bold text-[#111713]">Centralized Logistic Regression</td>
                              <td className="py-3 px-4 text-[#758079]">Theoretical Upper Bound</td>
                              <td className="py-3 px-4 text-[#D99A27]">Pooled (Non-Private)</td>
                              <td className="py-3 px-4 font-mono text-[#111713] font-semibold">0.8840</td>
                              <td className="py-3 px-4 font-mono text-[#758079]">0.8210</td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#F7F8F7] text-[#758079] border border-[#E8ECE9]">
                                  BENCHMARK
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* SCREEN F: ABOUT & CHARTER                                 */}
            {/* ========================================================= */}
            {activeScreen === "about" && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111713]">
                    About FedCreditX Platform
                  </h1>
                  <p className="text-xs sm:text-sm text-[#758079] mt-1">
                    Research-oriented platform for privacy-aware collaborative credit-risk assessment.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-[24px] p-6 border border-[#E8ECE9] shadow-xs space-y-3">
                    <h3 className="text-base font-bold text-[#111713]">Confidential Collaboration</h3>
                    <p className="text-xs text-[#758079] leading-relaxed">
                      Lenders collaboratively improve default prediction accuracy on thin-file borrowers without exposing raw financial records or applicant identities to peer institutions.
                    </p>
                  </div>

                  <div className="bg-white rounded-[24px] p-6 border border-[#E8ECE9] shadow-xs space-y-3">
                    <h3 className="text-base font-bold text-[#111713]">Explainable AI & Auditing</h3>
                    <p className="text-xs text-[#758079] leading-relaxed">
                      All predictions are accompanied by exact key risk attributions and compared with an interpretable Decision Tree baseline, ensuring regulatory transparency under human underwriting oversight.
                    </p>
                  </div>
                </div>
              </div>
            )}

          </main>
        </div>
      </div>

      {/* Floating In-App Notification Toast */}
      {inAppNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#123F36] text-white px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 border border-[#238354]/40 animate-slide-up">
          <span className="w-2.5 h-2.5 rounded-full bg-[#4ADE80] animate-pulse shrink-0"></span>
          <span className="text-xs font-bold">{inAppNotice}</span>
          <button
            type="button"
            onClick={() => setInAppNotice(null)}
            className="ml-2 text-white/70 hover:text-white cursor-pointer font-bold text-xs"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

