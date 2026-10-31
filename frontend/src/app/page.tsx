
"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  Activity, AlertCircle, ArrowDownRight, ArrowUpRight, Bell,
  CalendarClock, CheckCircle2, ChevronDown, ChevronLeft,
  ChevronRight, Command, FileUp, Filter, Inbox, LayoutDashboard,
  LoaderCircle, Mail, MailCheck, Menu, Moon, MoreHorizontal,
  Plus, Search, Send, Settings, ShieldCheck, Sparkles, Sun,
  Users, X,
} from "lucide-react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type Status = "SCHEDULED" | "PROCESSING" | "SENT" | "FAILED" | "CANCELLED";
type Tab = "ALL" | "SCHEDULED" | "SENT" | "FAILED";

interface EmailItem {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt: string | null;
  status: Status;
  error: string | null;
}

interface Sender {
  id: string;
  email: string;
  displayName: string;
  hourlyLimit: number;
  minDelayMs: number;
  isActive: boolean;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0]).join("").toUpperCase();
}

function StatusBadge({ status, dark }: { status: Status; dark: boolean }) {
  const styles: Record<Status, string> = dark
    ? {
        SENT: "bg-emerald-950 text-emerald-300 ring-emerald-800",
        FAILED: "bg-red-950 text-red-300 ring-red-800",
        SCHEDULED: "bg-amber-950 text-amber-300 ring-amber-800",
        PROCESSING: "bg-blue-950 text-blue-300 ring-blue-800",
        CANCELLED: "bg-neutral-800 text-neutral-400 ring-neutral-700",
      }
    : {
        SENT: "bg-emerald-50 text-emerald-700 ring-emerald-200",
        FAILED: "bg-red-50 text-red-700 ring-red-200",
        SCHEDULED: "bg-amber-50 text-amber-700 ring-amber-200",
        PROCESSING: "bg-blue-50 text-blue-700 ring-blue-200",
        CANCELLED: "bg-neutral-100 text-neutral-500 ring-neutral-200",
      };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${styles[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function StatCard({
  label, value, detail, icon: Icon, kind = "neutral", dark,
}: {
  label: string;
  value: number | string;
  detail: string;
  icon: typeof Mail;
  kind?: "neutral" | "green" | "red" | "amber";
  dark: boolean;
}) {
  const iconStyles = {
    neutral: dark ? "bg-neutral-800 text-neutral-200" : "bg-neutral-100 text-neutral-800",
    green: dark ? "bg-emerald-950 text-emerald-300" : "bg-emerald-50 text-emerald-700",
    red: dark ? "bg-red-950 text-red-300" : "bg-red-50 text-red-700",
    amber: dark ? "bg-amber-950 text-amber-300" : "bg-amber-50 text-amber-700",
  };

  return (
    <div className="interactive-card rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-[var(--muted)]">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconStyles[kind]}`}>
          <Icon size={17} strokeWidth={1.8} />
        </span>
      </div>
      <p className="mt-5 text-[29px] font-semibold leading-none tracking-tight">{value}</p>
      <p className="mt-2 text-[11px] text-[var(--muted)]">{detail}</p>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [authUserId, setAuthUserId] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [tab, setTab] = useState<Tab>("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [senderFormOpen, setSenderFormOpen] = useState(false);
  const [senderSubmitting, setSenderSubmitting] = useState(false);
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderHourlyLimit, setSenderHourlyLimit] = useState("10");
  const [senderMinDelay, setSenderMinDelay] = useState("2000");

  const [senderId, setSenderId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [csvRecipients, setCsvRecipients] = useState<string[]>([]);
  const [csvName, setCsvName] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("reachinbox-theme");
    setDarkMode(saved === "dark");
    setThemeLoaded(true);
  }, []);
    useEffect(() => {
    const token = localStorage.getItem("reachinbox_token");
    const userId = localStorage.getItem("reachinbox_user_id");

    if (!token || !userId) {
      router.replace("/login");
      return;
    }

    setAuthToken(token);
    setAuthUserId(userId);
    setAuthReady(true);
  }, [router]);

  useEffect(() => {
    if (themeLoaded) {
      localStorage.setItem("reachinbox-theme", darkMode ? "dark" : "light");
    }
  }, [darkMode, themeLoaded]);

    const headers = useMemo(() => ({
    "Content-Type": "application/json",
    "x-user-id": authUserId,
    "Authorization": `Bearer ${authToken}`,
  }), [authUserId, authToken]);

    const loadData = useCallback(async () => {
    if (!authReady) return;

    if (!authUserId || !authToken) {
      router.replace("/login");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [emailResponse, senderResponse] = await Promise.all([
        fetch(`${API_URL}/api/emails?status=ALL&limit=100`, { headers, cache: "no-store" }),
        fetch(`${API_URL}/api/senders`, { headers, cache: "no-store" }),
      ]);

      if (!emailResponse.ok || !senderResponse.ok) {
        throw new Error("Unable to load workspace data. Check the backend server.");
      }

      const emailData = await emailResponse.json();
      const senderData = await senderResponse.json();

      setEmails(emailData.data || []);
      setSenders(senderData.data || []);
      setSenderId((current) => current || senderData.data?.[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [headers, authReady, authUserId, authToken, router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const counts = useMemo(() => ({
    total: emails.length,
    scheduled: emails.filter((e) => ["SCHEDULED", "PROCESSING"].includes(e.status)).length,
    sent: emails.filter((e) => e.status === "SENT").length,
    failed: emails.filter((e) => e.status === "FAILED").length,
  }), [emails]);

  const filteredEmails = useMemo(() => emails.filter((email) => {
    const matchesTab =
      tab === "ALL" ||
      (tab === "SCHEDULED"
      ? ["SCHEDULED", "PROCESSING"].includes(email.status)
      : email.status === tab);
    const query = search.toLowerCase().trim();
    const matchesSearch = !query ||
      email.recipient.toLowerCase().includes(query) ||
      email.subject.toLowerCase().includes(query);
    return matchesTab && matchesSearch;
  }), [emails, tab, search]);

  const theme = darkMode
    ? {
        page: "bg-[#101010] text-white",
        header: "bg-[#171717]/95 border-[#303030]",
        card: "bg-[#1b1b1b] border-[#303030]",
        soft: "bg-[#242424]",
        muted: "text-neutral-400",
        border: "border-[#353535]",
        input: "bg-[#242424] border-[#414141] text-white placeholder:text-neutral-500",
        hover: "hover:bg-[#292929]",
        rowHover: "hover:bg-[#252525]",
        tableHead: "bg-[#202020]",
        secondary: "border-[#414141] text-neutral-300 hover:bg-[#292929]",
      }
    : {
        page: "bg-[#f5f5f5] text-[#171717]",
        header: "bg-white/95 border-neutral-200",
        card: "bg-white border-neutral-200",
        soft: "bg-neutral-100",
        muted: "text-neutral-500",
        border: "border-neutral-200",
        input: "bg-white border-neutral-200 text-neutral-900 placeholder:text-neutral-400",
        hover: "hover:bg-neutral-100",
        rowHover: "hover:bg-neutral-50",
        tableHead: "bg-neutral-50",
        secondary: "border-neutral-200 text-neutral-600 hover:bg-neutral-50",
      };

  const resetCompose = () => {
    setRecipient("");
    setSubject("");
    setBody("");
    setScheduledAt("");
    setCsvRecipients([]);
    setCsvName("");
  };

  const parseCsv = (file?: File) => {
    if (!file) return;

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const column = result.meta.fields?.find((field) =>
          ["email", "recipient", "email address"].includes(field.trim().toLowerCase())
        );

        if (!column) {
          setNotice("Your CSV needs an email or recipient column.");
          return;
        }

        const unique = [...new Set(result.data
          .map((row) => row[column]?.trim())
          .filter((value): value is string =>
            Boolean(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
          ))];

        setCsvRecipients(unique);
        setCsvName(file.name);
        setNotice(`${unique.length} valid unique recipients imported.`);
      },
      error: () => setNotice("Could not read this CSV file."),
    });
  };

  
const createSender = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();

  if (!senderName.trim() || !senderEmail.trim()) {
    setNotice("Enter a sender name and email address.");
    return;
  }

  setSenderSubmitting(true);
  setNotice("");

  try {
    const response = await fetch(`${API_URL}/api/senders`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        displayName: senderName.trim(),
        email: senderEmail.trim().toLowerCase(),
        hourlyLimit: Number(senderHourlyLimit),
        minDelayMs: Number(senderMinDelay),
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || "Could not create sender account.");
    }

    const newSender = result.data as Sender;
    setSenders((current) => [newSender, ...current]);
    setSenderId(newSender.id);
    setSenderFormOpen(false);
    setSenderName("");
    setSenderEmail("");
    setSenderHourlyLimit("10");
    setSenderMinDelay("2000");
    setNotice("Sender account added successfully. You can now use it to schedule campaigns.");
  } catch (err) {
    setNotice(err instanceof Error ? err.message : "Could not create sender account.");
  } finally {
    setSenderSubmitting(false);
  }
};

const scheduleCampaign = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();

  if (!senderId) {
    setNotice("Select an active sender account first.");
    return;
  }

  const recipients = csvRecipients.length
    ? csvRecipients
    : [recipient.trim().toLowerCase()];

  if (!recipients[0]) {
    setNotice("Enter at least one recipient.");
    return;
  }

  if (!subject.trim() || !body.trim()) {
    setNotice("Subject and message are required.");
    return;
  }

  if (!scheduledAt || new Date(scheduledAt) <= new Date()) {
    setNotice("Choose a date and time in the future.");
    return;
  }

  setSubmitting(true);
  setNotice("");

  try {
    const response = await fetch(`${API_URL}/api/campaigns/schedule`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        senderId,
        recipients,
        subject: subject.trim(),
        body: body.trim(),
        scheduledAt: new Date(scheduledAt).toISOString(),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Could not schedule campaign.");
    }

    setNotice(
      `Campaign created successfully! ${result.data.total} email(s) scheduled.`
    );

    resetCompose();
    setComposeOpen(false);

    await loadData();
  } catch (err) {
    setNotice(
      err instanceof Error ? err.message : "Scheduling failed."
    );
  } finally {
    setSubmitting(false);
  }
};


  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "ALL", label: "All emails", count: counts.total },
    { id: "SCHEDULED", label: "Scheduled", count: counts.scheduled },
    { id: "SENT", label: "Sent", count: counts.sent },
    { id: "FAILED", label: "Failed", count: counts.failed },
  ];

  const navigation = [
    { label: "Overview", icon: LayoutDashboard, tab: "ALL" as Tab },
    { label: "All emails", icon: Inbox, tab: "ALL" as Tab },
    { label: "Scheduled", icon: CalendarClock, tab: "SCHEDULED" as Tab },
    { label: "Sent", icon: MailCheck, tab: "SENT" as Tab },
    { label: "Failed", icon: AlertCircle, tab: "FAILED" as Tab },
  ];

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">
        <div className="text-center">
          <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-neutral-600 border-t-white" />
          <p className="text-sm text-neutral-300">Checking your session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.page}`}>
      {mobileNav && (
        <button aria-label="Close navigation" onClick={() => setMobileNav(false)}
          className="fixed inset-0 z-30 bg-black/50 backdrop-enter lg:hidden" />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col bg-[#111111] text-white transition-transform duration-300 ease-out lg:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[76px] items-center gap-3 border-b border-white/[0.08] px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-black">
            <Send size={17} strokeWidth={2.2} />
          </div>
          <div>
            <p className="text-[17px] font-semibold tracking-tight">ReachInbox</p>
            <p className="mt-0.5 text-[9px] font-semibold tracking-[.2em] text-neutral-500">EMAIL WORKSPACE</p>
          </div>
          <button onClick={() => setMobileNav(false)} className="ml-auto text-neutral-400 lg:hidden"><X size={18} /></button>
        </div>

        <div className="px-4 pt-7">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-neutral-600">Workspace</p>
          <div className="space-y-1">
            {navigation.map((item, index) => {
              const Icon = item.icon;
              const selected = index === 0 ? tab === "ALL" : index === 1 ? false : tab === item.tab;
              return (
                <button key={item.label} onClick={() => { setTab(item.tab); setMobileNav(false); }}
                  className={`sidebar-link flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] ${selected ? "bg-white/[0.12] font-medium text-white" : "text-neutral-400 hover:bg-white/[0.06] hover:text-white"}`}>
                  <Icon size={17} strokeWidth={1.8} />
                  <span>{item.label}</span>
                  {item.tab === "SCHEDULED" && <span className="ml-auto rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-neutral-400">{counts.scheduled}</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 pt-8">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-neutral-600">Manage</p>
          <button className="sidebar-link flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] text-neutral-400 hover:bg-white/[0.06] hover:text-white"><Users size={17} /> Contacts</button>
          <button className="sidebar-link mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] text-neutral-400 hover:bg-white/[0.06] hover:text-white"><Settings size={17} /> Settings</button>
        </div>

        <div className="mt-auto p-4">
          <div className="rounded-xl border border-white/[0.09] bg-white/[0.035] p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-neutral-200"><ShieldCheck size={15} /> Sending protection</div>
            <p className="mt-2 text-[11px] leading-5 text-neutral-500">Rate limits and delivery spacing help protect your sender reputation.</p>
            <div className="mt-3 flex items-center gap-2 text-[10px] text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Protection enabled</div>
          </div>
          <div className="mt-4 flex items-center gap-3 border-t border-white/[0.08] px-2 pt-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-xs font-bold text-black">RW</div>
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-neutral-200">Workspace user</p><p className="mt-0.5 truncate text-[10px] text-neutral-500">Development account</p></div>
            <MoreHorizontal size={18} className="text-neutral-500" />
          </div>
        </div>
      </aside>

      <main className="min-h-screen lg:pl-[252px]">
        <header className={`sticky top-0 z-20 flex h-[76px] items-center justify-between border-b px-5 backdrop-blur md:px-8 ${theme.header}`}>
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileNav(true)} className={`rounded-lg p-2 lg:hidden ${theme.hover}`}><Menu size={19} /></button>
            <div><p className="text-[13px] font-semibold">Workspace</p><p className={`mt-0.5 hidden text-[11px] sm:block ${theme.muted}`}>Email operations and campaign activity</p></div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative hidden md:block">
              <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme.muted}`} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search emails..." className={`w-[210px] rounded-lg border py-2 pl-9 pr-12 text-xs outline-none focus:border-neutral-500 ${theme.input}`} />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-neutral-400/40 px-1.5 py-0.5 text-[9px] text-neutral-500"><Command size={9} className="inline" /> K</span>
            </div>

            <button onClick={() => setDarkMode((current) => !current)} title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              className={`rounded-lg border p-2.5 transition-transform duration-200 hover:rotate-12 ${theme.secondary}`}>
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button onClick={() => void loadData()} title="Refresh workspace" className={`rounded-lg border p-2.5 ${theme.secondary}`}><Activity size={16} /></button>
            <button title="Notifications" className={`relative rounded-lg border p-2.5 ${theme.secondary}`}><Bell size={16} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-500" /></button>
            <div className={`hidden h-8 w-px sm:block ${darkMode ? "bg-neutral-700" : "bg-neutral-200"}`} />
            <div className="hidden items-center gap-2 sm:flex"><div className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold ${darkMode ? "bg-white text-black" : "bg-neutral-900 text-white"}`}>RW</div><ChevronDown size={14} className={theme.muted} /></div>
            <button onClick={() => setComposeOpen(true)} className={`flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-semibold transition hover:-translate-y-0.5 ${darkMode ? "bg-white text-black hover:bg-neutral-200" : "bg-black text-white hover:bg-neutral-800"}`}><Plus size={15} /><span className="hidden sm:inline">Compose email</span><span className="sm:hidden">Compose</span></button>
          </div>
        </header>

        <div key={tab} className="page-enter mx-auto max-w-[1500px] px-5 py-7 md:px-8 md:py-8">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className={`mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.16em] ${theme.muted}`}><Sparkles size={13} /> Overview</div>
              <h1 className="text-[25px] font-semibold tracking-tight md:text-[28px]">Good to see you again.</h1>
              <p className={`mt-1.5 text-[12px] ${theme.muted}`}>Here&apos;s an overview of your email performance and activity.</p>
            </div>
            <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] shadow-sm ${theme.card} ${theme.muted}`}><span className={`h-1.5 w-1.5 rounded-full ${darkMode ? "bg-emerald-400" : "bg-emerald-600"}`} /> Workspace data <ChevronDown size={13} /></div>
          </div>

          {error && <div className={`mb-5 flex items-start gap-3 rounded-lg border p-3.5 text-xs ${darkMode ? "border-red-900 bg-red-950/50 text-red-200" : "border-red-200 bg-red-50 text-red-800"}`}><AlertCircle size={17} /><div><p className="font-semibold">Dashboard connection issue</p><p className="mt-1">{error}</p></div></div>}
          {notice && <div className={`notification-enter mb-5 flex items-center justify-between gap-3 rounded-lg border p-3 text-xs ${theme.card}`}><span>{notice}</span><button onClick={() => setNotice("")}><X size={15} /></button></div>}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total emails" value={loading ? "—" : counts.total} detail="All email activity" icon={Inbox} dark={darkMode} />
            <StatCard label="Scheduled" value={loading ? "—" : counts.scheduled} detail="Waiting to be delivered" icon={CalendarClock} kind="amber" dark={darkMode} />
            <StatCard label="Successfully sent" value={loading ? "—" : counts.sent} detail="Recorded as sent" icon={CheckCircle2} kind="green" dark={darkMode} />
            <StatCard label="Failed emails" value={loading ? "—" : counts.failed} detail="Require attention" icon={AlertCircle} kind="red" dark={darkMode} />
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
            <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-[#171717] p-6 text-white md:p-7">
              <div className="absolute -right-8 -top-20 h-64 w-64 rounded-full border border-white/[0.07]" />
              <div className="relative">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.17em] text-neutral-400"><Send size={13} /> Campaign workspace</div>
                <h2 className="mt-4 text-[22px] font-semibold tracking-tight">Make every email count.</h2>
                <p className="mt-2 max-w-md text-[12px] leading-6 text-neutral-400">Create campaigns, import recipients and schedule delivery with intelligent sending controls.</p>
                <button onClick={() => setComposeOpen(true)} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-xs font-semibold text-black transition hover:-translate-y-0.5 hover:bg-neutral-200">Create a campaign <ArrowUpRight size={14} /></button>
              </div>
              <div className="relative mt-7 grid max-w-[420px] grid-cols-3 gap-3 border-t border-white/10 pt-4">
                <div><p className="text-[19px] font-semibold">{counts.total}</p><p className="mt-1 text-[10px] text-neutral-500">Total emails</p></div>
                <div><p className="text-[19px] font-semibold">{counts.scheduled}</p><p className="mt-1 text-[10px] text-neutral-500">In queue</p></div>
                <div><p className="text-[19px] font-semibold">{counts.sent}</p><p className="mt-1 text-[10px] text-neutral-500">Sent</p></div>
              </div>
            </div>

            <div className={`rounded-xl border p-5 shadow-sm ${theme.card}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[13px] font-semibold">Sender accounts</h2>
                  <p className={`mt-1 text-[11px] ${theme.muted}`}>Connected sending identities</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSenderFormOpen(true)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-semibold ${darkMode ? "bg-white text-black hover:bg-neutral-200" : "bg-black text-white hover:bg-neutral-800"}`}
                >
                  <Plus size={13} /> Add sender
                </button>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className={`text-[10px] ${theme.muted}`}>{senders.length} configured</span>
                <span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${darkMode ? "bg-emerald-950 text-emerald-300" : "bg-emerald-50 text-emerald-700"}`}>
                  {senders.filter((s) => s.isActive).length} active
                </span>
              </div>
              {senders.length ? (
                <div className="mt-4 space-y-4">
                  {senders.slice(0, 3).map((sender) => (
                    <div key={sender.id} className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg text-[11px] font-semibold ${theme.soft}`}>
                        {initials(sender.displayName || sender.email)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">{sender.displayName || sender.email}</p>
                        <p className={`mt-1 truncate text-[10px] ${theme.muted}`}>{sender.email}</p>
                      </div>
                      <span className={`h-2 w-2 rounded-full ${sender.isActive ? "bg-emerald-500" : "bg-neutral-400"}`} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`mt-4 rounded-lg p-5 text-center ${theme.soft}`}>
                  <Mail size={21} className={`mx-auto ${theme.muted}`} />
                  <p className="mt-2 text-xs font-semibold">No sender accounts</p>
                  <p className={`mt-1 text-[10px] ${theme.muted}`}>Add a sender account to start scheduling emails.</p>
                  <button type="button" onClick={() => setSenderFormOpen(true)} className="mt-3 text-[11px] font-semibold underline">
                    Add your first sender
                  </button>
                </div>
              )}
              <div className={`mt-5 flex items-center gap-2 border-t pt-4 text-[10px] ${theme.border} ${theme.muted}`}>
                <ShieldCheck size={13} /> Sending limits are configured per sender.
              </div>
            </div>
          </section>

          <section className={`mt-5 overflow-hidden rounded-xl border shadow-sm ${theme.card}`}>
            <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-5 py-5 md:px-6 ${theme.border}`}>
              <div><h2 className="text-[14px] font-semibold">Email activity</h2><p className={`mt-1 text-[11px] ${theme.muted}`}>Monitor your scheduled and outgoing messages</p></div>
              <div className="flex items-center gap-2">
                <div className="relative md:hidden"><Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme.muted}`} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className={`w-36 rounded-lg border py-2 pl-8 pr-2 text-[11px] outline-none ${theme.input}`} /></div>
                <button className={`hidden items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-medium sm:flex ${theme.secondary}`}><Filter size={13} /> Filter</button>
                <button onClick={() => void loadData()} className={`rounded-lg border p-2 ${theme.secondary}`} title="Refresh"><Activity size={15} /></button>
              </div>
            </div>

            <div className={`flex gap-5 overflow-x-auto border-b px-5 md:px-6 ${theme.border}`}>
              {tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`tab-enter flex shrink-0 items-center gap-2 border-b-2 py-3.5 text-[11px] font-semibold transition ${tab === item.id ? `border-current ${darkMode ? "text-white" : "text-black"}` : `border-transparent ${theme.muted}`}`}>{item.label}<span className={`rounded px-1.5 py-0.5 text-[9px] ${theme.soft}`}>{item.count}</span></button>)}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead className={`text-[9px] font-semibold uppercase tracking-[.13em] ${theme.muted} ${theme.tableHead}`}><tr><th className="px-6 py-3.5">Recipient</th><th className="px-6 py-3.5">Subject</th><th className="px-6 py-3.5">Date</th><th className="px-6 py-3.5">Status</th><th className="px-6 py-3.5">Details</th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={5} className={`py-14 text-center text-xs ${theme.muted}`}><LoaderCircle size={19} className="mx-auto mb-2 animate-spin" />Loading workspace data...</td></tr> :
                    filteredEmails.length ? filteredEmails.map((email) => <tr key={email.id} className={`email-row border-t ${theme.border} ${theme.rowHover}`}><td className="px-6 py-4"><p className="text-[12px] font-semibold">{email.recipient}</p></td><td className={`max-w-[240px] truncate px-6 py-4 text-[11px] ${theme.muted}`}>{email.subject}</td><td className={`whitespace-nowrap px-6 py-4 text-[10px] ${theme.muted}`}>{formatDate(email.sentAt || email.scheduledAt)}</td><td className="px-6 py-4"><StatusBadge status={email.status} dark={darkMode} /></td><td className="px-6 py-4">{email.error ? <span title={email.error} className="text-[10px] text-red-500">View error</span> : <span className={theme.muted}>—</span>}</td></tr>) :
                    <tr><td colSpan={5} className="py-14 text-center"><div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-lg ${theme.soft}`}><Inbox size={19} className={theme.muted} /></div><p className="mt-3 text-xs font-semibold">No emails found</p><p className={`mt-1 text-[10px] ${theme.muted}`}>{search ? "Try another search term." : "Your email activity will appear here."}</p>{!search && <button onClick={() => setComposeOpen(true)} className="mt-3 text-[11px] font-semibold underline">Compose your first email <ArrowUpRight size={12} className="inline" /></button>}</td></tr>}
                </tbody>
              </table>
            </div>

            <div className={`flex items-center justify-between border-t px-5 py-3.5 text-[10px] md:px-6 ${theme.border} ${theme.muted}`}><span>Showing {filteredEmails.length} of {emails.length} emails</span><div className="flex items-center gap-2"><button disabled className={`rounded-md border p-1.5 ${theme.border}`}><ChevronLeft size={13} /></button><span className={`rounded-md px-2.5 py-1.5 font-semibold ${theme.soft} ${darkMode ? "text-white" : "text-black"}`}>1</span><button disabled className={`rounded-md border p-1.5 ${theme.border}`}><ChevronRight size={13} /></button></div></div>
          </section>

          <footer className={`flex flex-wrap items-center justify-between gap-2 py-6 text-[10px] ${theme.muted}`}><span>© 2026 ReachInbox · Email scheduling workspace</span><span className="flex items-center gap-1.5"><ShieldCheck size={12} /> Sending protection enabled</span></footer>
        </div>
      </main>

      {senderFormOpen && (
        <div className="backdrop-enter fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-[3px] sm:p-6">
          <div className={`modal-enter my-auto w-full max-w-[480px] overflow-hidden rounded-xl border shadow-2xl ${theme.card}`}>
            <div className={`flex items-center justify-between border-b px-6 py-5 ${theme.border}`}>
              <div>
                <div className={`flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.15em] ${theme.muted}`}>
                  <Users size={12} /> Sender setup
                </div>
                <h2 className="mt-1.5 text-[17px] font-semibold">Add sender account</h2>
                <p className={`mt-1 text-[11px] ${theme.muted}`}>Configure the identity and sending limits for this workspace.</p>
              </div>
              <button type="button" onClick={() => setSenderFormOpen(false)} className={`rounded-lg p-2 ${theme.hover}`}>
                <X size={17} />
              </button>
            </div>

            <form onSubmit={createSender} className="space-y-4 p-6">
              <div>
                <label className={`mb-1.5 block text-[11px] font-semibold ${theme.muted}`}>Display name</label>
                <input required value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="e.g. Timmy" className={`w-full rounded-lg border px-3 py-2.5 text-xs outline-none focus:border-neutral-500 ${theme.input}`} />
              </div>
              <div>
                <label className={`mb-1.5 block text-[11px] font-semibold ${theme.muted}`}>Sender email address</label>
                <input required type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} placeholder="your-ethereal-address@example.com" className={`w-full rounded-lg border px-3 py-2.5 text-xs outline-none focus:border-neutral-500 ${theme.input}`} />
                <p className={`mt-1.5 text-[10px] ${theme.muted}`}>Use the email address belonging to the SMTP account configured in the backend.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`mb-1.5 block text-[11px] font-semibold ${theme.muted}`}>Hourly limit</label>
                  <input required type="number" min="1" value={senderHourlyLimit} onChange={(e) => setSenderHourlyLimit(e.target.value)} className={`w-full rounded-lg border px-3 py-2.5 text-xs outline-none focus:border-neutral-500 ${theme.input}`} />
                </div>
                <div>
                  <label className={`mb-1.5 block text-[11px] font-semibold ${theme.muted}`}>Minimum delay (ms)</label>
                  <input required type="number" min="1" value={senderMinDelay} onChange={(e) => setSenderMinDelay(e.target.value)} className={`w-full rounded-lg border px-3 py-2.5 text-xs outline-none focus:border-neutral-500 ${theme.input}`} />
                </div>
              </div>
              <div className={`flex justify-end gap-2 border-t pt-4 ${theme.border}`}>
                <button type="button" onClick={() => setSenderFormOpen(false)} className={`rounded-lg border px-4 py-2.5 text-xs font-semibold ${theme.secondary}`}>Cancel</button>
                <button type="submit" disabled={senderSubmitting} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold disabled:opacity-50 ${darkMode ? "bg-white text-black" : "bg-black text-white"}`}>
                  {senderSubmitting ? <><LoaderCircle size={14} className="animate-spin" /> Adding...</> : <><Plus size={14} /> Add sender</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {composeOpen && (
        <div className="backdrop-enter fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-[3px] sm:p-6">
          <div className={`modal-enter my-auto w-full max-w-[650px] overflow-hidden rounded-xl border shadow-2xl ${theme.card}`}>
            <div className={`flex items-center justify-between border-b px-6 py-5 ${theme.border}`}>
              <div><div className={`flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.15em] ${theme.muted}`}><Sparkles size={12} /> New campaign</div><h2 className="mt-1.5 text-[17px] font-semibold">Compose email</h2><p className={`mt-1 text-[11px] ${theme.muted}`}>Create a message and schedule its delivery.</p></div>
              <button onClick={() => { setComposeOpen(false); resetCompose(); }} className={`rounded-lg p-2 ${theme.hover}`}><X size={17} /></button>
            </div>

            <form onSubmit={scheduleCampaign} className="space-y-4 p-6">
              <div><label className={`mb-1.5 block text-[11px] font-semibold ${theme.muted}`}>Sender account</label><select required value={senderId} onChange={(e) => setSenderId(e.target.value)} className={`w-full rounded-lg border px-3 py-2.5 text-xs outline-none focus:border-neutral-500 ${theme.input}`}><option value="">Choose a sender</option>{senders.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.displayName || s.email} · {s.email}</option>)}</select></div>

              <div><div className="mb-1.5 flex items-center justify-between"><label className={`text-[11px] font-semibold ${theme.muted}`}>Recipients</label><span className={`text-[10px] ${theme.muted}`}>{csvRecipients.length ? `${csvRecipients.length} imported` : "Single recipient or CSV"}</span></div><input type="email" required={!csvRecipients.length} disabled={csvRecipients.length > 0} value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="name@example.com" className={`w-full rounded-lg border px-3 py-2.5 text-xs outline-none focus:border-neutral-500 disabled:opacity-50 ${theme.input}`} /><div className="mt-2 flex flex-wrap items-center gap-2"><label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-[10px] font-semibold ${theme.secondary}`}><FileUp size={14} /> Import CSV<input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => parseCsv(e.target.files?.[0])} /></label>{csvName && <span className={`max-w-[160px] truncate text-[10px] ${theme.muted}`}>{csvName}</span>}{csvRecipients.length > 0 && <button type="button" onClick={() => { setCsvRecipients([]); setCsvName(""); }} className="text-[10px] text-red-500">Remove CSV</button>}</div>{csvRecipients.length > 0 && <p className="mt-2 text-[10px] text-emerald-600">{csvRecipients.length} valid unique addresses imported.</p>}</div>

              <div><label className={`mb-1.5 block text-[11px] font-semibold ${theme.muted}`}>Subject</label><input required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Enter your subject line" className={`w-full rounded-lg border px-3 py-2.5 text-xs outline-none focus:border-neutral-500 ${theme.input}`} /></div>

              <div><label className={`mb-1.5 block text-[11px] font-semibold ${theme.muted}`}>Message</label><textarea required rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your email message..." className={`w-full resize-y rounded-lg border px-3 py-2.5 text-xs leading-5 outline-none focus:border-neutral-500 ${theme.input}`} /></div>

              <div><label className={`mb-1.5 block text-[11px] font-semibold ${theme.muted}`}>Schedule delivery</label><input required type="datetime-local" min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={`w-full rounded-lg border px-3 py-2.5 text-xs outline-none focus:border-neutral-500 ${theme.input}`} /></div>

              <div className={`flex flex-col-reverse justify-end gap-2 border-t pt-4 sm:flex-row ${theme.border}`}>
                <button type="button" onClick={() => { setComposeOpen(false); resetCompose(); }} className={`rounded-lg border px-4 py-2.5 text-xs font-semibold ${theme.secondary}`}>Cancel</button>
                <button type="submit" disabled={submitting || !senders.some((s) => s.id === senderId && s.isActive)} className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-xs font-semibold transition hover:-translate-y-0.5 disabled:opacity-50 ${darkMode ? "bg-white text-black hover:bg-neutral-200" : "bg-black text-white hover:bg-neutral-800"}`}>
                  {submitting ? <><LoaderCircle size={14} className="animate-spin" /> Scheduling...</> : <><CalendarClock size={14} /> Schedule {csvRecipients.length || 1} email(s)</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
