import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Square,
  RotateCcw,
  RefreshCw,
  Terminal,
  Users,
  Shield,
  Zap,
  Download,
  Plus,
  Trash2,
  Copy,
  Check,
  Activity,
  Flame,
  BookOpen,
  Smartphone,
  Server,
  AlertTriangle,
  CheckCircle2,
  Pause,
  Search,
  Eye,
  EyeOff,
  UserPlus,
  Compass,
  FileJson,
  Cpu,
  Layers,
  ArrowRight,
  TrendingUp,
  Save,
  ClipboardPaste,
  ShieldCheck,
  ChevronRight,
  LayoutGrid,
  X,
  ExternalLink,
  Bot,
  Sparkles,
  Radio,
  CheckCheck,
  Clock,
  ArrowUpRight,
} from "lucide-react";

interface Account {
  uid?: string;
  account_id?: string;
  name?: string;
  nickname?: string;
  password?: string;
  token?: string;
  region?: string;
  level?: number;
  exp?: number;
  gained_exp?: number;
  matches?: number;
  status?: string;
  is_paused?: boolean;
  created_at?: string;
  clan_id?: string;
}

interface LiveBotBot {
  uid: string;
  name: string;
  role: string;
  status: string;
  stepNumber: number;
  stepName: string;
  region: string;
  lastAction: string;
}

interface LiveTrackerData {
  isRunning: boolean;
  mode: "app" | "main" | "idle";
  runningCount: number;
  totalAccounts: number;
  activeBots: LiveBotBot[];
  currentStep: {
    stepNumber: number;
    title: string;
    detail: string;
    status: "idle" | "running" | "completed" | "warning";
  };
  guidance: {
    statusType: "info" | "success" | "warning" | "alert";
    title: string;
    message: string;
    checklist: string[];
  };
  isGenerating: boolean;
  lastUpdated: number;
}

interface BotStatus {
  isRunning: boolean;
  mode: "app" | "main" | "idle";
  pid: number | null;
  uptime: number;
  port: number;
  guildRunning?: boolean;
}

interface BotStats {
  total_accounts: number;
  active_accounts: number;
  total_matches: number;
  total_matches_started: number;
  total_active_matches: number;
  total_gained_exp: number;
  uptime: number;
  exp_per_hour: number;
  matches_per_hour: number;
  accounts: Account[];
  bot_running: boolean;
  creating: boolean;
  create_progress: string[];
  team_size: number;
  team_code?: string;
  leader_uid?: string;
}

interface LogEntry {
  id: number;
  time: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
  source: "bot" | "guild" | "system";
}

interface ConfirmDeleteTarget {
  uid?: string;
  token?: string;
  name?: string;
  index: number;
}

const REGIONS = [
  { code: "BD", name: "Bangladesh (বাংলাদেশ - ডিফল্ট)" },
  { code: "IND", name: "India / South Asia (ভারত)" },
  { code: "PK", name: "Pakistan (পাকিস্তান)" },
  { code: "ID", name: "Indonesia (ইন্দোনেশিয়া)" },
  { code: "SG", name: "Singapore / Malaysia (সিঙ্গাপুর)" },
  { code: "BR", name: "Brazil (ব্রাজিল)" },
  { code: "ME", name: "Middle East (মিডল ইস্ট)" },
  { code: "VN", name: "Vietnam (ভিয়েতনাম)" },
  { code: "TH", name: "Thailand (থাইল্যান্ড)" },
  { code: "RU", name: "Russia / CIS" },
  { code: "NA", name: "North America" },
];

export default function App() {
  // Navigation: "hub" is the clean organized home view, or a specific feature view
  const [activeTab, setActiveTab] = useState<
    "hub" | "accounts" | "generator" | "guild" | "terminal" | "guide"
  >("hub");

  // Persistent User Config (Real Guild Code & Region)
  const [savedGuildId, setSavedGuildId] = useState<string>(() => {
    return localStorage.getItem("ff_saved_guild_id") || "";
  });
  const [guildInput, setGuildInput] = useState<string>(() => {
    return localStorage.getItem("ff_saved_guild_id") || "";
  });
  const [selectedServerRegion, setSelectedServerRegion] = useState<string>("BD");
  const [showGuildModal, setShowGuildModal] = useState(false);

  // Bot State
  const [status, setStatus] = useState<BotStatus>({
    isRunning: false,
    mode: "idle",
    pid: null,
    uptime: 0,
    port: 25567,
  });

  const [stats, setStats] = useState<BotStats>({
    total_accounts: 0,
    active_accounts: 0,
    total_matches: 0,
    total_matches_started: 0,
    total_active_matches: 0,
    total_gained_exp: 0,
    uptime: 0,
    exp_per_hour: 0,
    matches_per_hour: 0,
    accounts: [],
    bot_running: false,
    creating: false,
    create_progress: [],
    team_size: 0,
  });

  const [rawAccounts, setRawAccounts] = useState<any[]>([]);
  const [liveTracker, setLiveTracker] = useState<LiveTrackerData | null>(null);
  const [lastAutoSyncTime, setLastAutoSyncTime] = useState<string>("এখনই");
  const [isAutoSyncing, setIsAutoSyncing] = useState<boolean>(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<"all" | "bot" | "guild" | "error">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Forms - Defaulting to BD (Bangladesh)
  const [genRegion, setGenRegion] = useState("BD");
  const [genClanId, setGenClanId] = useState(() => savedGuildId || "");
  const [genCount, setGenCount] = useState(4);
  const [genPassword, setGenPassword] = useState("FFFZ");

  const [guildTargetId, setGuildTargetId] = useState(() => savedGuildId || "");
  const [guildApiOverride, setGuildApiOverride] = useState("");
  const [guildJoinLoading, setGuildJoinLoading] = useState(false);

  // Account Add Single Modal - Defaulting to BD
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<"guest" | "token">("guest");
  const [newUid, setNewUid] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newToken, setNewToken] = useState("");
  const [newName, setNewName] = useState("");
  const [newRegion, setNewRegion] = useState("BD");

  // Bulk Paste Real Accounts Modal - Defaulting to BD
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkRegion, setBulkRegion] = useState("BD");

  // Delete In-App Confirmation Modal (NO window.confirm!)
  const [deleteTarget, setDeleteTarget] = useState<ConfirmDeleteTarget | null>(null);
  const [showClearAllModal, setShowClearAllModal] = useState(false);

  // Show Credentials Modal
  const [viewCredsAccount, setViewCredsAccount] = useState<any | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  // Raw JSON edit modal
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [rawJsonText, setRawJsonText] = useState("");

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch bot status, stats, config, accounts, and live tracker
  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/config");
      if (res.ok) {
        const data = await res.json();
        if (data.guild_id) {
          setSavedGuildId(data.guild_id);
          setGuildInput(data.guild_id);
          setGenClanId(data.guild_id);
          setGuildTargetId(data.guild_id);
          localStorage.setItem("ff_saved_guild_id", data.guild_id);
        }
        if (data.region) {
          setSelectedServerRegion(data.region);
          setGenRegion(data.region);
        }
      }
    } catch {}
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/bot/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {}
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/bot/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {}
  };

  const fetchAccounts = async () => {
    try {
      const res = await fetch("/api/accounts");
      if (res.ok) {
        const data = await res.json();
        const accs = data.accounts || [];
        setRawAccounts(accs);
        if (accs.length > 0) {
          localStorage.setItem("ff_local_accounts_backup", JSON.stringify(accs));
        }
      }
    } catch {}
  };

  const fetchLiveTracker = async () => {
    try {
      setIsAutoSyncing(true);
      const res = await fetch("/api/bot/live_tracker");
      if (res.ok) {
        const data: LiveTrackerData = await res.json();
        setLiveTracker(data);
        const now = new Date();
        setLastAutoSyncTime(
          now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        );
      }
    } catch {} finally {
      setTimeout(() => setIsAutoSyncing(false), 300);
    }
  };

  // Fast burst polling for rapid UI sync during bot generation or actions
  const triggerAutoSyncBurst = () => {
    let count = 0;
    fetchAccounts();
    fetchLiveTracker();
    fetchStats();
    const burstTimer = setInterval(() => {
      count++;
      fetchAccounts();
      fetchLiveTracker();
      fetchStats();
      fetchStatus();
      if (count >= 10) clearInterval(burstTimer);
    }, 1200);
  };

  // 100% Automatic continuous background refresh (Runs every 2 seconds without requiring manual page reload)
  useEffect(() => {
    fetchConfig();
    fetchStatus();
    fetchStats();
    fetchAccounts();
    fetchLiveTracker();

    const interval = setInterval(() => {
      fetchStatus();
      fetchStats();
      fetchAccounts();
      fetchLiveTracker();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // SSE Logs & Live Events Listener
  useEffect(() => {
    const eventSource = new EventSource("/api/logs/stream");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "history" && Array.isArray(data.logs)) {
          setLogs(data.logs);
        } else if (data.type === "accounts_updated") {
          // Instant automatic synchronization when accounts file changes on backend
          fetchAccounts();
          fetchStats();
          fetchLiveTracker();
        } else if (data.id && data.message) {
          const msg = data.message;
          setLogs((prev) => {
            const next = [...prev, data];
            if (next.length > 500) next.shift();
            return next;
          });

          // If a bot/account lifecycle message arrives, immediately sync without manual reload
          if (
            msg.includes("1-Click Gen Completed") ||
            msg.includes("Guest Account Generation finished") ||
            msg.includes("saved") ||
            msg.includes("deleted") ||
            msg.includes("joined successfully") ||
            msg.includes("ACCOUNTS_UPDATED")
          ) {
            fetchAccounts();
            fetchStats();
            fetchLiveTracker();
          }
        }
      } catch {}
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    if (autoScroll && activeTab === "terminal" && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll, activeTab]);

  // Save Guild ID Permanently
  const handleSaveGuildId = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanId = guildInput.trim();
    if (!cleanId) {
      showToast("দয়া করে সঠিক গিল্ড কোড লিখুন");
      return;
    }
    setIsActionLoading(true);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guild_id: cleanId, region: selectedServerRegion }),
      });
      if (res.ok) {
        setSavedGuildId(cleanId);
        setGenClanId(cleanId);
        setGuildTargetId(cleanId);
        localStorage.setItem("ff_saved_guild_id", cleanId);
        setShowGuildModal(false);
        showToast(`গিল্ড কোড [${cleanId}] সফলভাবে সেভ হয়েছে!`);
        fetchAccounts();
      } else {
        showToast("গিল্ড কোড সেভ করতে সমস্যা হয়েছে");
      }
    } catch (e: any) {
      showToast(`Error: ${e.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // IN-APP DELETE ACCOUNT (Fixed: 100% working without native confirm)
  const executeDeleteAccount = async () => {
    if (!deleteTarget) return;
    setIsActionLoading(true);
    try {
      const res = await fetch("/api/accounts/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: deleteTarget.uid,
          token: deleteTarget.token,
          index: deleteTarget.index,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`অ্যাকাউন্ট ${deleteTarget.uid || deleteTarget.name} সফলভাবে ডিলিট করা হয়েছে!`);
        setDeleteTarget(null);
        fetchAccounts();
        fetchStats();
      } else {
        showToast(`ডিলিট ব্যর্থ: ${data.error || "Unknown error"}`);
      }
    } catch (e: any) {
      showToast(`ডিলিট ব্যর্থ হয়েছে: ${e.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // IN-APP CLEAR ALL ACCOUNTS (Fixed: 100% working without native confirm)
  const executeClearAllAccounts = async () => {
    setIsActionLoading(true);
    try {
      const res = await fetch("/api/accounts/clear_all", { method: "POST" });
      if (res.ok) {
        setRawAccounts([]);
        localStorage.removeItem("ff_local_accounts_backup");
        setShowClearAllModal(false);
        showToast("সকল অ্যাকাউন্ট সফলভাবে মুছে ফেলা হয়েছে!");
        fetchAccounts();
        fetchStats();
      } else {
        showToast("অ্যাকাউন্ট মুছতে সমস্যা হয়েছে");
      }
    } catch (e: any) {
      showToast(`Error: ${e.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Bulk Import Real Accounts
  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkText.trim()) {
      showToast("দয়া করে অ্যাকাউন্টের তথ্য পেস্ট করুন");
      return;
    }
    setIsActionLoading(true);
    try {
      const res = await fetch("/api/accounts/bulk_import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: bulkText,
          default_region: bulkRegion,
          default_clan_id: savedGuildId || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`${data.imported} টি রিয়েল অ্যাকাউন্ট সফলভাবে সেভ হয়েছে!`);
        setShowBulkModal(false);
        setBulkText("");
        fetchAccounts();
        fetchStats();
      } else {
        showToast(`Error: ${data.error}`);
      }
    } catch (e: any) {
      showToast(`Import failed: ${e.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Bot Actions
  const handleStartBot = async (mode: "app" | "main") => {
    if (rawAccounts.length === 0) {
      showToast("বট চালু করার আগে রিয়েল অ্যাকাউন্ট যোগ করুন!");
      setShowBulkModal(true);
      return;
    }
    setIsActionLoading(true);
    try {
      const res = await fetch("/api/bot/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`স্কোয়াড বট চালু হয়েছে (${mode === "main" ? "main.py" : "app.py"})`);
        setActiveTab("terminal");
      } else {
        showToast(`Error: ${data.error}`);
      }
      fetchStatus();
      fetchStats();
    } catch (e: any) {
      showToast(`Failed: ${e.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleStopBot = async () => {
    setIsActionLoading(true);
    try {
      const res = await fetch("/api/bot/stop", { method: "POST" });
      const data = await res.json();
      showToast(data.message || "বট বন্ধ করা হয়েছে");
      fetchStatus();
      fetchStats();
    } catch (e: any) {
      showToast(`Failed: ${e.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRestartBot = async () => {
    setIsActionLoading(true);
    try {
      await fetch("/api/bot/restart", { method: "POST" });
      showToast("বট রিস্টার্ট হচ্ছে...");
      setTimeout(() => {
        fetchStatus();
        fetchStats();
      }, 2000);
    } catch (e: any) {
      showToast(`Failed: ${e.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // 1-Click Auto Guest Generator (No Password Needed)
  const triggerOneClickGenerate = async (count = 4) => {
    const clanId = (savedGuildId || genClanId || "3105331459").trim();
    setIsActionLoading(true);
    triggerAutoSyncBurst();
    try {
      const res = await fetch("/api/accounts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region: "BD",
          clan_id: clanId,
          count: count,
        }),
      });
      const data = await res.json();
      showToast(data.msg || "১-ক্লিকে ৪টি BD গেস্ট বট তৈরি শুরু হয়েছে! স্বয়ংক্রিয়ভাবে ডিসপ্লেতে যুক্ত হবে।");
      triggerAutoSyncBurst();
    } catch (e: any) {
      showToast(`Generation failed: ${e.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Generator Action
  const handleGenerateGuests = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clanId = (genClanId || savedGuildId || "3105331459").trim();
    setIsActionLoading(true);
    triggerAutoSyncBurst();
    try {
      const res = await fetch("/api/accounts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region: genRegion || "BD",
          clan_id: clanId,
          count: genCount,
        }),
      });
      const data = await res.json();
      showToast(data.msg || "গেস্ট অ্যাকাউন্ট তৈরি শুরু হয়েছে! ডিসপ্লে স্বয়ংক্রিয়ভাবে আপডেট হচ্ছে।");
      triggerAutoSyncBurst();
    } catch (e: any) {
      showToast(`Generation failed: ${e.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Guild Join Action
  const handleGuildJoin = async (e?: React.FormEvent, testSingle: boolean = false) => {
    if (e) e.preventDefault();
    const gId = (guildTargetId || savedGuildId).trim();
    if (!gId) {
      showToast("দয়া করে গিল্ড কোড লিখুন");
      return;
    }
    if (rawAccounts.length === 0) {
      showToast("কোনো অ্যাকাউন্ট নেই। আগে অ্যাকাউন্ট যুক্ত করুন!");
      return;
    }
    setGuildJoinLoading(true);
    try {
      const res = await fetch("/api/guild/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guild_id: gId,
          api_base: guildApiOverride.trim() || undefined,
          test_single: testSingle,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(testSingle ? "১টি বট দিয়ে গিল্ড টেস্ট জয়েন শুরু হয়েছে!" : `${data.accountsCount} টি অ্যাকাউন্ট দিয়ে গিল্ড জয়েন শুরু হয়েছে!`);
        setActiveTab("terminal");
      } else {
        showToast(`Error: ${data.error}`);
      }
    } catch (e: any) {
      showToast(`Guild join failed: ${e.message}`);
    } finally {
      setGuildJoinLoading(false);
    }
  };

  // Add Account Action
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: newName,
        region: newRegion,
        clan_id: savedGuildId || undefined,
      };
      if (addMode === "token") {
        if (!newToken.trim()) {
          showToast("টোকেন আবশ্যক");
          return;
        }
        payload.token = newToken.trim();
      } else {
        if (!newUid.trim() || !newPassword.trim()) {
          showToast("UID এবং পাসওয়ার্ড দুটিই আবশ্যক");
          return;
        }
        payload.uid = newUid.trim();
        payload.password = newPassword.trim();
      }

      const res = await fetch("/api/accounts/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast("অ্যাকাউন্ট সফলভাবে সেভ হয়েছে!");
        setShowAddModal(false);
        setNewUid("");
        setNewPassword("");
        setNewToken("");
        setNewName("");
        fetchAccounts();
        fetchStats();
      } else {
        const d = await res.json();
        showToast(`Error: ${d.error}`);
      }
    } catch (e: any) {
      showToast(`Failed: ${e.message}`);
    }
  };

  // Clear Token Cache
  const handleClearCache = async () => {
    try {
      const res = await fetch("/api/token_cache/clear", { method: "POST" });
      if (res.ok) showToast("টোকেন ক্যাশ পরিষ্কার করা হয়েছে");
    } catch (e: any) {
      showToast(`Failed: ${e.message}`);
    }
  };

  // Clear Logs
  const handleClearLogs = async () => {
    try {
      await fetch("/api/logs/clear", { method: "POST" });
      setLogs([]);
      showToast("টার্মিনাল লগ ক্লিয়ার করা হয়েছে");
    } catch {}
  };

  // Copy helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} কপি করা হয়েছে!`);
  };

  const formatUptime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const filteredLogs = logs.filter((l) => {
    if (logFilter === "bot" && l.source !== "bot") return false;
    if (logFilter === "guild" && l.source !== "guild") return false;
    if (logFilter === "error" && l.level !== "error") return false;
    if (searchTerm && !l.message.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col selection:bg-amber-500 selection:text-black">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-amber-500/50 text-amber-300 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce">
          <Zap className="w-5 h-5 text-amber-400" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Main Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Logo */}
          <div
            onClick={() => setActiveTab("hub")}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 via-orange-500 to-yellow-400 flex items-center justify-center font-black text-lg text-black shadow-lg shadow-orange-500/20">
              FF
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-wide text-slate-100">
                  FREE FIRE GLORY BOT
                </span>
                <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  SUITE
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {savedGuildId ? (
                  <span className="text-emerald-400 font-mono font-medium">
                    গিল্ড: {savedGuildId}
                  </span>
                ) : (
                  <span className="text-amber-400">গিল্ড কোড সেট করুন</span>
                )}
              </p>
            </div>
          </div>

          {/* Quick Engine Status & Master Button */}
          <div className="flex items-center gap-2">
            {!status.isRunning ? (
              <button
                onClick={() => handleStartBot("app")}
                disabled={isActionLoading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Bot</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/80 border border-emerald-500/40 rounded-lg text-emerald-400 text-xs font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>{formatUptime(status.uptime)}</span>
                </div>
                <button
                  onClick={handleStopBot}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                >
                  Stop
                </button>
              </div>
            )}

            <button
              onClick={() => setActiveTab(activeTab === "hub" ? "terminal" : "hub")}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                activeTab === "hub"
                  ? "bg-slate-800 border-slate-700 text-slate-200"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-400"
              }`}
              title="Dashboard Menu"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Saved Guild Code Banner with Quick Change Button */}
        <div className="bg-slate-900/90 border-t border-slate-800 px-4 py-2">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-slate-300 font-medium">টার্গেট গিল্ড:</span>
              {savedGuildId ? (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">
                  {savedGuildId}
                </span>
              ) : (
                <span className="text-rose-400 italic">কোনো গিল্ড কোড সেভ নেই</span>
              )}
            </div>

            <button
              onClick={() => setShowGuildModal(true)}
              className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>{savedGuildId ? "কোড পরিবর্তন" : "গিল্ড কোড পেস্ট করুন"}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 py-5 flex-1 w-full">
        {/* ========================================================= */}
        {/* VIEW 1: ORGANIZED FEATURE HUB (সুন্দর গোছানো বাটন মেন্যু) */}
        {/* ========================================================= */}
        {activeTab === "hub" && (
          <div className="space-y-6">
            {/* Top Stats Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
                <span className="text-[11px] uppercase text-slate-400 font-medium block">
                  মোট গ্লোরি / EXP
                </span>
                <span className="text-xl font-black text-amber-400 font-mono mt-1 block">
                  +{stats.total_gained_exp.toLocaleString()}
                </span>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
                <span className="text-[11px] uppercase text-slate-400 font-medium block">
                  অ্যাক্টিভ বট অ্যাকাউন্ট
                </span>
                <span className="text-xl font-black text-cyan-400 font-mono mt-1 block">
                  {rawAccounts.length} টি অ্যাকাউন্ট
                </span>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
                <span className="text-[11px] uppercase text-slate-400 font-medium block">
                  ম্যাচ সম্পন্ন
                </span>
                <span className="text-xl font-black text-emerald-400 font-mono mt-1 block">
                  {stats.total_matches}
                </span>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
                <span className="text-[11px] uppercase text-slate-400 font-medium block">
                  বট ইঞ্জিন স্ট্যাটাস
                </span>
                <span className={`text-xl font-black font-mono mt-1 block ${status.isRunning ? "text-emerald-400" : "text-slate-400"}`}>
                  {status.isRunning ? "ONLINE" : "STANDBY"}
                </span>
              </div>
            </div>

            {/* ========================================================= */}
            {/* 🔴 LIVE BOT RUNNING DISPLAY & DIRECTIONAL GUIDANCE WIDGET */}
            {/* কয়টা বট রানিং চলতেছে + নিচে পর্যায়ক্রমিক স্টেপ + দিকনির্দেশনা */}
            {/* ========================================================= */}
            <div className="bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border-2 border-emerald-500/30 rounded-3xl p-5 shadow-2xl relative overflow-hidden space-y-5">
              {/* Glowing decorative background glow */}
              <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

              {/* Header: Title, Live Running Counter & Auto-Sync Indicator */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
                    <Bot className="w-5 h-5 animate-bounce" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-extrabold text-white text-base sm:text-lg tracking-tight">
                        লাইভ বট রানিং ডিসপ্লে ও স্টেপ মনিটর
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold">
                        100% Live
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      সার্বক্ষণিক লাইভ প্রগ্রেস ও দিকনির্দেশনা (কোনো পেজ রিফ্রেশ বা F5 লাগবে না)
                    </p>
                  </div>
                </div>

                {/* Auto-Refresh Status Badge with Instant Force Sync Button */}
                <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/70 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                    <span className={`w-2.5 h-2.5 rounded-full bg-emerald-400 ${isAutoSyncing ? "animate-ping" : "animate-pulse"}`}></span>
                    <span>অটো-রিফ্রেশ সক্রিয়</span>
                    <span className="text-[10px] text-emerald-500/80 font-mono">({lastAutoSyncTime})</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      fetchAccounts();
                      fetchLiveTracker();
                      fetchStats();
                      fetchStatus();
                      showToast("সব ডাটা অটো-সিঙ্ক ও রিফ্রেশ হয়েছে!");
                    }}
                    title="তাৎক্ষণিক রিফ্রেশ"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition active:scale-95 shadow-sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isAutoSyncing ? "animate-spin text-emerald-400" : ""}`} />
                    <span className="hidden sm:inline">এখনই রিফ্রেশ</span>
                  </button>
                </div>
              </div>

              {/* 1. Main Live Running Bots Count Banner (কয়টা বট রানিং চলতেছে) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 relative z-10">
                {/* Big Running Counter Card */}
                <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 md:col-span-1 shadow-inner ${
                  status.isRunning
                    ? "bg-gradient-to-r from-emerald-950/80 to-teal-950/60 border-emerald-500/50 text-white"
                    : liveTracker?.isGenerating
                    ? "bg-gradient-to-r from-amber-950/80 to-orange-950/60 border-amber-500/50 text-white"
                    : "bg-slate-950/80 border-slate-800 text-slate-300"
                }`}>
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                      বর্তমানে রানিং বট সংখ্যা
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className={`text-3xl font-black font-mono tracking-tight ${
                        status.isRunning ? "text-emerald-400" : liveTracker?.isGenerating ? "text-amber-400" : "text-slate-400"
                      }`}>
                        {status.isRunning ? (liveTracker?.runningCount || Math.min(4, Math.max(1, rawAccounts.length))) : 0}
                      </span>
                      <span className="text-sm font-bold text-slate-300">টি বট সক্রিয়</span>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      {status.isRunning
                        ? "🟢 ৪-প্লেয়ার স্কোয়াড ম্যাচমেকিং রানিং"
                        : liveTracker?.isGenerating
                        ? "🟡 BD গেস্ট অ্যাকাউন্ট তৈরি হচ্ছে"
                        : "⚪ বট স্ট্যান্ডবাই (চালু করার অপেক্ষায়)"}
                    </span>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    {!status.isRunning ? (
                      <button
                        onClick={() => handleStartBot("app")}
                        disabled={isActionLoading || rawAccounts.length === 0}
                        className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>চালু করুন</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleStopBot}
                        disabled={isActionLoading}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer flex items-center gap-1 active:scale-95"
                      >
                        <Square className="w-3 h-3 fill-current" />
                        <span>থামান</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Target Guild & Region Box */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/80 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                      টার্গেট গিল্ড ও গ্যারেনা সার্ভার
                    </span>
                    <div className="flex items-center gap-2 mt-1.5">
                      <ShieldCheck className="w-5 h-5 text-amber-400" />
                      <span className="text-lg font-black font-mono text-amber-300">
                        {savedGuildId || "3105331459"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-800/80">
                    <span className="flex items-center gap-1">🇧🇩 বাংলাদেশ (BD)</span>
                    <span className="text-emerald-400 font-medium">অটো-জয়েন মোড</span>
                  </div>
                </div>

                {/* Live Match & Glory Status Box */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/80 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                      অ্যান্টি-AFK গ্লোরি অগ্রগতি
                    </span>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Flame className="w-5 h-5 text-orange-400 fill-orange-400" />
                      <span className="text-lg font-black font-mono text-emerald-400">
                        +{stats.total_gained_exp.toLocaleString()} <span className="text-xs font-normal text-slate-400">EXP / গ্লোরি</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-800/80">
                    <span>ম্যাচ শেষ: {stats.total_matches}</span>
                    <span className="text-cyan-400 font-mono">লবি সাইকেল: সক্রিয়</span>
                  </div>
                </div>
              </div>

              {/* 2. Step-by-Step Lifecycle Pipeline (তার নিচে স্টেপ বের হবে) */}
              <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-4 relative z-10 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span>৪-পর্যায়ের লাইভ স্টেপ অগ্রগতি (Step-by-Step Flow)</span>
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">
                    বর্তমান পর্যায়: ধাপ {status.isRunning ? 4 : liveTracker?.isGenerating ? 1 : rawAccounts.length > 0 ? 2 : 1} / ৪
                  </span>
                </div>

                {/* 4 Interactive Visual Step Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {/* Step 1 */}
                  <div className={`p-3 rounded-xl border transition ${
                    liveTracker?.isGenerating
                      ? "bg-amber-500/10 border-amber-500/50 shadow-md ring-1 ring-amber-500/40"
                      : rawAccounts.length > 0
                      ? "bg-emerald-950/30 border-emerald-500/30"
                      : "bg-slate-900/60 border-slate-800"
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${
                        rawAccounts.length > 0 ? "bg-emerald-500 text-black" : "bg-slate-800 text-slate-300"
                      }`}>
                        {rawAccounts.length > 0 ? "✓" : "১"}
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        liveTracker?.isGenerating
                          ? "bg-amber-500/20 text-amber-300 animate-pulse"
                          : rawAccounts.length > 0
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-slate-800 text-slate-400"
                      }`}>
                        {liveTracker?.isGenerating ? "চলছে..." : rawAccounts.length > 0 ? "সম্পন্ন" : "অপেক্ষারত"}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-200">ধাপ ১: BD গেস্ট আইডি প্রস্তুত</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                      {rawAccounts.length}টি অ্যাকাউন্ট তৈরি ও ডাটাবেজে সেভ
                    </p>
                  </div>

                  {/* Step 2 */}
                  <div className={`p-3 rounded-xl border transition ${
                    status.isRunning && status.uptime < 15
                      ? "bg-cyan-500/10 border-cyan-500/50 shadow-md ring-1 ring-cyan-500/40"
                      : rawAccounts.length > 0
                      ? "bg-emerald-950/30 border-emerald-500/30"
                      : "bg-slate-900/60 border-slate-800"
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${
                        rawAccounts.length > 0 ? "bg-emerald-500 text-black" : "bg-slate-800 text-slate-300"
                      }`}>
                        {rawAccounts.length > 0 ? "✓" : "২"}
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        rawAccounts.length > 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-400"
                      }`}>
                        {rawAccounts.length > 0 ? "সম্পন্ন" : "অপেক্ষারত"}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-200">ধাপ ২: গ্যারেনা অথেন্টিকেশন</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                      OAuth হ্যান্ডশেক ও সেশন ভ্যালিডেশন
                    </p>
                  </div>

                  {/* Step 3 */}
                  <div className={`p-3 rounded-xl border transition ${
                    guildJoinLoading
                      ? "bg-amber-500/10 border-amber-500/50 shadow-md ring-1 ring-amber-500/40"
                      : "bg-slate-900/60 border-slate-800"
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${
                        guildJoinLoading ? "bg-amber-500 text-black animate-pulse" : "bg-slate-800 text-slate-300"
                      }`}>
                        ৩
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        guildJoinLoading ? "bg-amber-500/20 text-amber-300" : "bg-slate-800 text-slate-400"
                      }`}>
                        {guildJoinLoading ? "যুক্ত হচ্ছে..." : "যেকোনো সময়"}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-200">ধাপ ৩: গিল্ডে অটো-জয়েন</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                      গিল্ড ৩১০৫৩৩১8৫৯-এ বট মেম্বার অ্যাড
                    </p>
                  </div>

                  {/* Step 4 */}
                  <div className={`p-3 rounded-xl border transition ${
                    status.isRunning
                      ? "bg-emerald-500/15 border-emerald-500/60 shadow-lg ring-1 ring-emerald-500/40"
                      : "bg-slate-900/60 border-slate-800"
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${
                        status.isRunning ? "bg-emerald-500 text-black animate-pulse" : "bg-slate-800 text-slate-300"
                      }`}>
                        {status.isRunning ? "▶" : "৪"}
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        status.isRunning ? "bg-emerald-500/20 text-emerald-300 font-bold" : "bg-slate-800 text-slate-400"
                      }`}>
                        {status.isRunning ? "রানিং" : "অপেক্ষারত"}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-200">ধাপ ৪: গ্লোরি ম্যাচ লুপ</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                      {status.isRunning ? "অ্যান্টি-AFK ম্যাচ ও EXP বৃদ্ধি" : "Start Bot চাপলে চালু হবে"}
                    </p>
                  </div>
                </div>

                {/* Live Step Status Action Note */}
                <div className="bg-slate-900/80 px-3.5 py-2 rounded-xl flex items-center justify-between text-xs text-slate-300 border border-slate-800">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <strong className="text-slate-200">লাইভ আপডেট:</strong>
                    <span>
                      {liveTracker?.currentStep.detail || (status.isRunning ? "বট ব্যাকএন্ডে ৪-স্কোয়াড ম্যাচমেকিং করছে ও গিল্ড গ্লোরি বাড়াচ্ছে।" : "বট প্রস্তুত অবস্থায় আছে।")}
                    </span>
                  </span>
                  <span className="text-[11px] text-emerald-400 font-mono hidden sm:inline">স্বয়ংক্রিয় সিঙ্ক</span>
                </div>
              </div>

              {/* 3. Directional Guidance Board (আমাকে দিকনির্দেশনা দিতে হবে) */}
              <div className={`p-4 rounded-2xl border relative z-10 transition ${
                liveTracker?.guidance.statusType === "alert"
                  ? "bg-rose-950/40 border-rose-500/50"
                  : status.isRunning
                  ? "bg-emerald-950/30 border-emerald-500/40"
                  : "bg-slate-950/80 border-slate-800"
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                    liveTracker?.guidance.statusType === "alert"
                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      : status.isRunning
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  }`}>
                    {liveTracker?.guidance.statusType === "alert" ? (
                      <AlertTriangle className="w-5 h-5 text-rose-400 animate-pulse" />
                    ) : status.isRunning ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <BookOpen className="w-5 h-5 text-amber-400" />
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <h4 className="font-bold text-white text-sm">
                        {liveTracker?.guidance.title || "লাইভ সিস্টেম দিকনির্দেশনা"}
                      </h4>
                      <span className="text-[11px] text-slate-400">
                        {status.isRunning ? "সার্বক্ষণিক সক্রিয় লুপ" : "সহজ নির্দেশনা"}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {liveTracker?.guidance.message || "আপনার স্ক্রিন রিলোড করার কোনো দরকার নেই। ডাটা প্রতি ২ সেকেন্ডে নিজে থেকেই লাইভ আপডেট হচ্ছে।"}
                    </p>

                    {/* Step-by-step checklist guidance */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs text-slate-300">
                      {(liveTracker?.guidance.checklist || [
                        "১-ক্লিক বাটনে ৪টি BD গেস্ট অ্যাকাউন্ট স্বয়ংক্রিয় তৈরি করুন।",
                        "গিল্ডে বট যুক্ত করতে 'গিল্ডে বট জয়েন করান' বাটনে চাপ দিন।",
                        "'Start Bot' চেপে সার্বক্ষণিক অ্যান্টি-এএফকে গ্লোরি লুপ চালু করুন।"
                      ]).map((tip, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-800/80">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{tip}</span>
                        </div>
                      ))}
                    </div>

                    {/* Quick Action Button within guidance */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={() => handleGuildJoin(undefined, true)}
                        disabled={guildJoinLoading || rawAccounts.length === 0}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl shadow transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>১টি বট দিয়ে টেস্ট জয়েন করুন</span>
                      </button>

                      <button
                        onClick={() => triggerOneClickGenerate(4)}
                        disabled={isActionLoading}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-400" />
                        <span>আরো ৪টি BD বট যোগ করুন</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Live Running Bots Display (ডিসপ্লের ভেতরে রানিং বটের তথ্য) */}
              {rawAccounts.length > 0 && (
                <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-4 relative z-10 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <Users className="w-4 h-4 text-cyan-400" />
                      <span>ডিসপ্লেতে সক্রিয় বট স্কোয়াড ({rawAccounts.length} টি অ্যাকাউন্ট উপলব্ধ)</span>
                    </h3>
                    <button
                      onClick={() => setActiveTab("accounts")}
                      className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <span>সকল অ্যাকাউন্ট দেখুন</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {rawAccounts.slice(0, 4).map((acc, index) => {
                      const uid = acc.uid || acc.account_id || `Bot_${index + 1}`;
                      const isLeader = index === 0;
                      return (
                        <div
                          key={index}
                          className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 transition flex flex-col justify-between space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isLeader
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : "bg-slate-800 text-slate-300"
                            }`}>
                              {isLeader ? "👑 স্কোয়াড লিডার" : `মেম্বার #${index + 1}`}
                            </span>
                            <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              BD 🇧🇩
                            </span>
                          </div>

                          <div>
                            <span className="text-[11px] text-slate-400 block">ফ্রি ফায়ার UID</span>
                            <span className="font-mono font-bold text-white text-xs sm:text-sm tracking-wide block truncate">
                              {uid}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
                            <span className="text-slate-400 truncate max-w-[120px]">
                              {status.isRunning ? "🟢 ম্যাচমেকিং চলছে" : "⚪ প্রস্তুত আছে"}
                            </span>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ uid: acc.uid, token: acc.token, name: acc.name, index })}
                              className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-500/10 cursor-pointer transition"
                              title="ডিলিট করুন"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 1-Click Auto BD Guest Bot Banner (পাসওয়ার্ড ছাড়া ১-ক্লিকে বট জেনারেট) */}
            <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-slate-900 border border-amber-500/40 rounded-2xl p-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
                  <Zap className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-100 text-sm sm:text-base">
                      ১-ক্লিক অটো BD গেস্ট বট জেনারেটর
                    </h3>
                    <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-md font-bold">
                      পাসওয়ার্ড ছাড়া (No Password)
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    কোনো পাসওয়ার্ড লেখা লাগবে না! শুধু বাটনে ক্লিক করলেই স্বয়ংক্রিয়ভাবে ৪টি বাংলাদেশ (BD) গেস্ট বট তৈরি হয়ে স্কোয়াডে যুক্ত হবে।
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isActionLoading}
                onClick={() => triggerOneClickGenerate(4)}
                className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition transform active:scale-95 shrink-0"
              >
                <Zap className="w-4 h-4 fill-current" />
                <span>{isActionLoading ? "বট তৈরি হচ্ছে..." : "১-ক্লিকে ৪টি BD বট তৈরি করুন"}</span>
              </button>
            </div>

            {/* Feature Button Cards Grid (প্রতিটি ফিচারের আলাদা আলাদা গোছানো বাটন) */}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-amber-400" />
                <span>মেইন ফিচার ও টুলস মেন্যু (Feature Controls)</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {/* 1. Account Manager & Delete Card */}
                <div
                  onClick={() => setActiveTab("accounts")}
                  className="bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/50 p-5 rounded-2xl transition cursor-pointer group shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition">
                      <Users className="w-6 h-6" />
                    </div>
                    <span className="px-2.5 py-1 text-xs font-mono font-bold rounded-full bg-slate-800 text-amber-400">
                      {rawAccounts.length} IDs
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-slate-100 mt-3.5">
                    অ্যাকাউন্ট লিস্ট ও ডিলিট অপশন
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    সেভ করা আইডি দেখুন, পাসওয়ার্ড চেক করুন অথবা অপ্রয়োজনীয় আইডি ডিলিট করুন।
                  </p>
                  <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-amber-400 font-medium">
                    <span>Manage & Delete IDs</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                  </div>
                </div>

                {/* 2. Quick Paste Real Accounts */}
                <div
                  onClick={() => setShowBulkModal(true)}
                  className="bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-emerald-500/50 p-5 rounded-2xl transition cursor-pointer group shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition">
                      <ClipboardPaste className="w-6 h-6" />
                    </div>
                    <span className="px-2.5 py-1 text-xs font-mono font-bold rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                      1-Click Paste
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-slate-100 mt-3.5">
                    রিয়েল অ্যাকাউন্ট পেস্ট করুন
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    আপনার আসল গেস্ট অ্যাকাউন্টের UID:Password বা Token পেস্ট করে ইনস্ট্যান্ট সেভ করুন।
                  </p>
                  <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-emerald-400 font-medium">
                    <span>Paste Accounts</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                  </div>
                </div>

                {/* 3. Guild Glory Joiner */}
                <div
                  onClick={() => setActiveTab("guild")}
                  className="bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-purple-500/50 p-5 rounded-2xl transition cursor-pointer group shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-105 transition">
                      <Shield className="w-6 h-6" />
                    </div>
                    <span className="px-2.5 py-1 text-xs font-mono font-bold rounded-full bg-purple-950/60 text-purple-400 border border-purple-800/40">
                      guild.py
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-slate-100 mt-3.5">
                    গিল্ড গ্লোরি জয়নার
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    সবগুলো অ্যাকাউন্ট এক ক্লিকে আপনার সেভ করা গিল্ডে জয়েন রিকোয়েস্ট পাঠাবে।
                  </p>
                  <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-purple-400 font-medium">
                    <span>Join Guild Bot</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                  </div>
                </div>

                {/* 4. Guest Account Generator */}
                <div
                  onClick={() => setActiveTab("generator")}
                  className="bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/50 p-5 rounded-2xl transition cursor-pointer group shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition">
                      <UserPlus className="w-6 h-6" />
                    </div>
                    <span className="px-2.5 py-1 text-xs font-mono font-bold rounded-full bg-cyan-950/60 text-cyan-400 border border-cyan-800/40">
                      Auto Gen
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-slate-100 mt-3.5">
                    গেস্ট অ্যাকাউন্ট জেনারেটর
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    অটোমেটিকভাবে নতুন গেস্ট আইডি জেনারেট করে স্কোয়াডে যুক্ত করুন।
                  </p>
                  <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-cyan-400 font-medium">
                    <span>Generate Accounts</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                  </div>
                </div>

                {/* 5. Live Termux Console */}
                <div
                  onClick={() => setActiveTab("terminal")}
                  className="bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-green-500/50 p-5 rounded-2xl transition cursor-pointer group shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center text-green-400 group-hover:scale-105 transition">
                      <Terminal className="w-6 h-6" />
                    </div>
                    <span className="px-2.5 py-1 text-xs font-mono font-bold rounded-full bg-green-950/60 text-green-400 border border-green-800/40">
                      {logs.length} Lines
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-slate-100 mt-3.5">
                    টারমেক্স লাইভ টার্মিনাল
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    টারমেক্সের মতো লাইভ কালারফুল কন্সোল আউটপুট এবং ম্যাচমেকিং লগ দেখুন।
                  </p>
                  <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-green-400 font-medium">
                    <span>View Terminal Logs</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                  </div>
                </div>

                {/* 6. Setup & Hosting Guide */}
                <div
                  onClick={() => setActiveTab("guide")}
                  className="bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/50 p-5 rounded-2xl transition cursor-pointer group shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <span className="px-2.5 py-1 text-xs font-mono font-bold rounded-full bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
                      Guide
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-slate-100 mt-3.5">
                    হোস্টিং ও সেটআপ গাইড
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    টারমেক্স ও লিনাক্স ভিপিএস সার্ভারে ২৪/৭ বট চালানোর ফুল বাংলা গাইড।
                  </p>
                  <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-indigo-400 font-medium">
                    <span>Read Instructions</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Bot Starter Bar */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <span>Free Fire 4-Squad Engine</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                    Anti-AFK Movement Active
                  </span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  সেভ করা {rawAccounts.length} টি অ্যাকাউন্ট দিয়ে অটোমেটিক ম্যাচমেকিং শুরু করুন।
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!status.isRunning ? (
                  <button
                    onClick={() => handleStartBot("app")}
                    disabled={isActionLoading || rawAccounts.length === 0}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Start 4-Squad Bot</span>
                  </button>
                ) : (
                  <button
                    onClick={handleStopBot}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg transition cursor-pointer"
                  >
                    Stop Bot
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: MANAGE & DELETE ACCOUNTS (ডিলিট সিস্টেম ১০০% ঠিক) */}
        {/* ========================================================= */}
        {activeTab === "accounts" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <div>
                <button
                  onClick={() => setActiveTab("hub")}
                  className="text-xs text-amber-400 hover:underline flex items-center gap-1 mb-1 cursor-pointer"
                >
                  <span>← ফিরে যান (Back to Menu)</span>
                </button>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <span>অ্যাকাউন্ট লিস্ট ও ডিলিট অপশন</span>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-slate-800 text-amber-400 font-mono">
                    {rawAccounts.length}
                  </span>
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBulkModal(true)}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  + পেস্ট করুন
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl transition cursor-pointer"
                >
                  + সিঙ্গেল যোগ
                </button>
                {rawAccounts.length > 0 && (
                  <button
                    onClick={() => setShowClearAllModal(true)}
                    className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/40 text-xs rounded-xl transition cursor-pointer"
                  >
                    সব ডিলিট করুন
                  </button>
                )}
              </div>
            </div>

            {/* Account Cards List */}
            {rawAccounts.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-base text-slate-200">
                  কোনো অ্যাকাউন্ট সেভ নেই (Clean State)
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  নতুন রিয়েল অ্যাকাউন্ট পেস্ট করুন অথবা গেস্ট জেনারেটর দিয়ে তৈরি করুন।
                </p>
                <button
                  onClick={() => setShowBulkModal(true)}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl cursor-pointer"
                >
                  Paste Real Accounts Now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {rawAccounts.map((acc, idx) => {
                  const uid = acc.uid || (acc.token ? `tok_${acc.token.slice(0, 8)}` : `acc_${idx + 1}`);
                  const isToken = !!acc.token;
                  const isRevealed = revealedPasswords[uid];

                  return (
                    <div
                      key={idx}
                      className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold font-mono text-sm shrink-0">
                            #{idx + 1}
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-slate-100">
                              {acc.name || `Real_Account_${idx + 1}`}
                            </h4>
                            <span className="text-[11px] text-slate-400">
                              Region: {acc.region || "IND"} • Guild: {acc.clan_id || savedGuildId || "Default"}
                            </span>
                          </div>
                        </div>

                        {/* DELETE BUTTON (Direct In-App Modal) */}
                        <button
                          onClick={() =>
                            setDeleteTarget({
                              uid: acc.uid,
                              token: acc.token,
                              name: acc.name || `Account #${idx + 1}`,
                              index: idx,
                            })
                          }
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 hover:text-rose-200 border border-rose-800/50 rounded-xl text-xs font-medium transition cursor-pointer"
                          title="Delete this account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>ডিলিট (Delete)</span>
                        </button>
                      </div>

                      {/* Credentials display with copy & show password */}
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 font-mono text-xs space-y-1">
                        {acc.uid && (
                          <div className="flex items-center justify-between text-slate-300">
                            <span className="text-slate-500">UID:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="select-all font-bold">{acc.uid}</span>
                              <button
                                onClick={() => copyToClipboard(acc.uid, "UID")}
                                className="text-amber-400 hover:text-amber-300 p-0.5"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}

                        {acc.password && (
                          <div className="flex items-center justify-between text-slate-300">
                            <span className="text-slate-500">Password:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] select-all max-w-[160px] truncate">
                                {isRevealed ? acc.password : "••••••••••••"}
                              </span>
                              <button
                                onClick={() =>
                                  setRevealedPasswords((prev) => ({
                                    ...prev,
                                    [uid]: !prev[uid],
                                  }))
                                }
                                className="text-slate-400 hover:text-slate-200"
                              >
                                {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                              <button
                                onClick={() => copyToClipboard(acc.password, "Password")}
                                className="text-amber-400 hover:text-amber-300"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}

                        {acc.token && (
                          <div className="flex items-center justify-between text-slate-300">
                            <span className="text-slate-500">Token:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] truncate max-w-[150px]">
                                {acc.token.slice(0, 16)}...
                              </span>
                              <button
                                onClick={() => copyToClipboard(acc.token, "Token")}
                                className="text-amber-400 hover:text-amber-300"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 3: GUEST ACCOUNT GENERATOR */}
        {/* ========================================================= */}
        {activeTab === "generator" && (
          <div className="max-w-2xl mx-auto space-y-4">
            <button
              onClick={() => setActiveTab("hub")}
              className="text-xs text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>← ফিরে যান (Back to Menu)</span>
            </button>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3.5 mb-4">
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">
                    Free Fire Guest Account Generator
                  </h3>
                  <p className="text-xs text-slate-400">
                    অটোমেটিকভাবে নতুন গেস্ট আইডি জেনারেট করে স্কোয়াডে সেভ করুন।
                  </p>
                </div>
              </div>

              <form onSubmit={handleGenerateGuests} className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-300 uppercase mb-1">
                    সার্ভার অঞ্চল (Server Region)
                  </label>
                  <select
                    value={genRegion}
                    onChange={(e) => setGenRegion(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                  >
                    {REGIONS.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.code} - {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 uppercase mb-1">
                    টার্গেট গিল্ড আইডি (Guild ID) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 3105331459"
                    value={genClanId}
                    onChange={(e) => setGenClanId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono"
                  />
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">অটোমেটিক গ্যারেনা পাসওয়ার্ড</span>
                    <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full font-bold">
                      পাসওয়ার্ড দেওয়া লাগবে না (100% Auto)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    আপনার কোনো পাসওয়ার্ড লিখতে হবে না। সিস্টেম স্বয়ংক্রিয়ভাবে গ্যারেনা সার্ভার থেকে আসল এনক্রিপ্টেড পাসওয়ার্ড তৈরি করে নতুন ফ্রেশ গেস্ট আইডি বানিয়ে দেবে।
                  </p>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 uppercase mb-1">
                    বট অ্যাকাউন্ট সংখ্যা
                  </label>
                  <select
                    value={genCount}
                    onChange={(e) => setGenCount(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                  >
                    <option value={4}>৪টি অ্যাকাউন্ট (Full Squad - গ্লোরির জন্য সেরা)</option>
                    <option value={2}>২টি অ্যাকাউন্ট (Duo Squad)</option>
                    <option value={1}>১টি অ্যাকাউন্ট (Single Bot)</option>
                  </select>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                  <span className="text-[11px] text-slate-400">
                    সার্ভার: <strong className="text-amber-400">{genRegion}</strong> | গিল্ড: <strong className="text-amber-400">{genClanId || savedGuildId || "3105331459"}</strong>
                  </span>
                  <button
                    type="submit"
                    disabled={isActionLoading}
                    className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs rounded-xl shadow-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Zap className="w-4 h-4 fill-current" />
                    <span>{isActionLoading ? "বট জেনারেট হচ্ছে..." : "১-ক্লিকে বট তৈরি করুন"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 4: GUILD GLORY JOINER */}
        {/* ========================================================= */}
        {activeTab === "guild" && (
          <div className="max-w-2xl mx-auto space-y-4">
            <button
              onClick={() => setActiveTab("hub")}
              className="text-xs text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>← ফিরে যান (Back to Menu)</span>
            </button>

            {/* Diagnostic Alert Box: BR_CLAN_CLAN_IS_FULL Explained */}
            <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-amber-300">
                    গিল্ডে বট যুক্ত না হওয়ার কারণ: BR_CLAN_CLAN_IS_FULL
                  </h4>
                  <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
                    আপনার তৈরি করা BD গেস্ট আইডিগুলোর পাসওয়ার্ড এবং গ্যারেনায় লগইন <strong>১০০% সফল হয়েছে</strong>। কিন্তু গ্যারেনা সার্ভার আপনার গিল্ড <strong className="text-white font-mono">{guildTargetId || savedGuildId}</strong>-এ বট ঢুকাতে বাধা দিচ্ছে কারণ <strong>গিল্ডের মেম্বার লিমিট পূর্ণ অথবা পেন্ডিং আবেদন তালিকা (Pending Requests) ফুল</strong> রয়েছে।
                  </p>
                </div>
              </div>

              {/* 4-Step Checklist for Free Fire In-Game */}
              <div className="bg-slate-950/80 rounded-xl p-3.5 border border-amber-500/20 space-y-2.5 text-xs">
                <p className="font-bold text-slate-200 flex items-center gap-1.5">
                  <span>🛠️</span>
                  <span>ফ্রি ফায়ার গেমে গিয়ে ১ মিনিটে যা করতে হবে (ফিক্স করার নিয়ম):</span>
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-300">
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="font-bold text-amber-400 block mb-1">১. মেম্বার স্লট খালি করুন:</span>
                    গিল্ড লিডার আইডি দিয়ে গেমে ঢুকে Member List থেকে ৪-৮ জন অফলাইন মেম্বার কিক (Kick) করুন।
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="font-bold text-amber-400 block mb-1">২. পেন্ডিং রিকোয়েস্ট বক্স ক্লিয়ার:</span>
                    গিল্ডের Apply বা রিকোয়েস্ট ট্যাবে যান। ৫০টি পেন্ডিং রিকোয়েস্ট জমে থাকলে সব ক্লিয়ার করুন।
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="font-bold text-amber-400 block mb-1">৩. লেভেল রিকোয়ারমেন্ট কমান:</span>
                    বটগুলো নতুন তৈরি হওয়ায় Level 1 থাকে। গিল্ড সেটিংসে রিকোয়ারমেন্ট লেভেল ১ (বা Default) করুন।
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="font-bold text-amber-400 block mb-1">৪. জয়েন মেথড Auto করুন:</span>
                    Approval মোডের বদলে Auto-Approve দিলে বট রিকোয়েস্ট পাঠানোর সাথে সাথেই ঢুকে যাবে।
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3.5 mb-4">
                <div className="p-2.5 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-400">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">
                    Free Fire Guild Glory Joiner
                  </h3>
                  <p className="text-xs text-slate-400">
                    সকল বট অ্যাকাউন্ট একসঙ্গে আপনার গিল্ডে জয়েন রিকোয়েস্ট পাঠাবে।
                  </p>
                </div>
              </div>

              <form onSubmit={(e) => handleGuildJoin(e, false)} className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-300 uppercase mb-1">
                    Free Fire Guild ID (গিল্ড আইডি দিন) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter Guild ID (যেমন: 3105331459)"
                    value={guildTargetId}
                    onChange={(e) => setGuildTargetId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 font-mono"
                  />
                </div>

                <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-slate-400">
                    রেডি অ্যাকাউন্ট: <strong className="text-amber-400">{rawAccounts.length} টি</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={guildJoinLoading || rawAccounts.length === 0}
                      onClick={() => handleGuildJoin(undefined, true)}
                      className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition cursor-pointer disabled:opacity-50"
                      title="১টি আইডি দিয়ে টেস্ট করুন স্লট খালি হয়েছে কিনা"
                    >
                      ১টি বট দিয়ে টেস্ট জয়েন
                    </button>
                    <button
                      type="submit"
                      disabled={guildJoinLoading || rawAccounts.length === 0}
                      className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 text-white font-bold text-xs rounded-xl shadow-lg cursor-pointer disabled:opacity-50"
                    >
                      {guildJoinLoading ? "জয়েন হচ্ছে..." : "Join All Accounts to Guild"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 5: TERMUX LIVE TERMINAL */}
        {/* ========================================================= */}
        {activeTab === "terminal" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setActiveTab("hub")}
                className="text-xs text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>← ফিরে যান (Back to Menu)</span>
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleClearLogs}
                  className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                >
                  Clear Console
                </button>
                <button
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`px-2.5 py-1 text-xs rounded-lg border cursor-pointer ${
                    autoScroll ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}
                >
                  Auto-Scroll: {autoScroll ? "ON" : "OFF"}
                </button>
              </div>
            </div>

            <div className="bg-[#040608] border border-slate-800 rounded-2xl p-4 font-mono text-xs h-[480px] overflow-y-auto space-y-1 terminal-glow">
              {logs.length === 0 ? (
                <div className="text-slate-600 py-12 text-center font-sans">
                  কন্সোল প্রস্তুত। বট চালু করলে বা কোনো অ্যাকশন নিলে এখানে লাইভ আউটপুট দেখতে পাবেন।
                </div>
              ) : (
                logs.map((log) => {
                  let color = "text-slate-300";
                  if (log.level === "error") color = "text-rose-400";
                  else if (log.level === "warning") color = "text-amber-400";
                  else if (log.level === "success") color = "text-emerald-400";

                  return (
                    <div key={log.id} className="flex items-start gap-2 py-0.5 px-1 hover:bg-slate-900/40">
                      <span className="text-slate-600 text-[11px] shrink-0">[{log.time}]</span>
                      <span className={`break-all leading-relaxed ${color}`}>{log.message}</span>
                    </div>
                  );
                })
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 6: HOSTING & SETUP GUIDE */}
        {/* ========================================================= */}
        {activeTab === "guide" && (
          <div className="max-w-3xl mx-auto space-y-4">
            <button
              onClick={() => setActiveTab("hub")}
              className="text-xs text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>← ফিরে যান (Back to Menu)</span>
            </button>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
                <Smartphone className="w-5 h-5 text-amber-400" />
                <span>টারমেক্স ও ভিপিএস সেটআপ গাইড</span>
              </h3>

              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-amber-400">১. মোবাইল টারমেক্সে চালানোর কমান্ড:</h4>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-emerald-400 relative">
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `pkg update && pkg upgrade -y\npkg install python git -y\npip install httpx google-play-scraper pycryptodome protobuf-decoder protobuf requests aiohttp\npython app.py`,
                        "Termux Commands"
                      )
                    }
                    className="absolute top-2.5 right-2.5 px-2 py-1 bg-slate-800 text-slate-200 text-[10px] rounded"
                  >
                    কপি করুন
                  </button>
                  <p>pkg update && pkg upgrade -y</p>
                  <p>pkg install python git -y</p>
                  <p>pip install httpx google-play-scraper pycryptodome protobuf-decoder protobuf requests aiohttp</p>
                  <p>python app.py</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================= */}
      {/* IN-APP CONFIRMATION MODAL: DELETE SINGLE ACCOUNT (Fixed!) */}
      {/* ========================================================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-100">
                অ্যাকাউন্ট ডিলিট নিশ্চিতকরণ
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              আপনি কি নিশ্চিত যে এই অ্যাকাউন্টটি পুরোপুরি মুছে ফেলতে চান?
            </p>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs space-y-1">
              <div className="text-slate-400">
                আইডি / UID: <strong className="text-amber-400">{deleteTarget.uid || deleteTarget.name}</strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
              >
                বাতিল (Cancel)
              </button>
              <button
                type="button"
                disabled={isActionLoading}
                onClick={executeDeleteAccount}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg cursor-pointer disabled:opacity-50"
              >
                {isActionLoading ? "মুছে ফেলা হচ্ছে..." : "মুছে ফেলুন (Delete Now)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* IN-APP CONFIRMATION MODAL: CLEAR ALL ACCOUNTS */}
      {/* ========================================================= */}
      {showClearAllModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-100">
                সব অ্যাকাউন্ট মুছে ফেলবেন?
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              আপনার সেভ করা সব ({rawAccounts.length} টি) অ্যাকাউন্ট এবং ডেমো আইডি মুছে ফেলা হবে। আপনি একদম ফ্রেশ লিস্ট পাবেন।
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowClearAllModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isActionLoading}
                onClick={executeClearAllAccounts}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg cursor-pointer disabled:opacity-50"
              >
                সব মুছুন (Clear All)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* GUILD CODE INPUT MODAL */}
      {/* ========================================================= */}
      {showGuildModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" />
                <span>টার্গেট গিল্ড কোড সেভ করুন</span>
              </h3>
              <button onClick={() => setShowGuildModal(false)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGuildId} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Free Fire Guild ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: 3105331459"
                  value={guildInput}
                  onChange={(e) => setGuildInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-amber-400 font-mono focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  সার্ভার রিজিয়ন (Default: BD - বাংলাদেশ)
                </label>
                <select
                  value={selectedServerRegion}
                  onChange={(e) => setSelectedServerRegion(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                >
                  {REGIONS.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  বাংলাদেশ সার্ভারের গিল্ডের জন্য অবশ্যই <b>BD</b> সিলেক্ট রাখবেন।
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowGuildModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionLoading}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-xl"
                >
                  Save Guild ID
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* BULK PASTE REAL ACCOUNTS MODAL */}
      {/* ========================================================= */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <ClipboardPaste className="w-5 h-5 text-amber-400" />
                <span>রিয়েল গেস্ট অ্যাকাউন্ট পেস্ট করুন</span>
              </h3>
              <button onClick={() => setShowBulkModal(false)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              প্রতি লাইনে একটি করে <code className="text-amber-400 font-bold">UID:Password</code> পেস্ট করুন।
            </p>

            <form onSubmit={handleBulkImport} className="space-y-4">
              <textarea
                required
                rows={7}
                placeholder={`8317389851:PASSWORD_HERE\n8317389858:PASSWORD_HERE\n8317389850:PASSWORD_HERE\n8317389869:PASSWORD_HERE`}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-emerald-400 font-mono focus:outline-none focus:border-amber-500"
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionLoading}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-xl"
                >
                  Save Real Accounts
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ADD SINGLE ACCOUNT MODAL */}
      {/* ========================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100">
                সিঙ্গেল অ্যাকাউন্ট যোগ করুন
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-[11px] text-amber-300 leading-relaxed">
              💡 <b>গুরুত্বপূর্ণ তথ্য:</b> গেমের মূল পার্সোনাল প্রোফাইল আইডি দিয়ে পাসওয়ার্ড হিসেবে <code>FFFZ</code> দিলে গ্যারেনা এক্সেস দেয় না (OAuth Failed আসবে)। এখানে টারমেক্স থেকে পাওয়া আসল গেস্ট অ্যাকাউন্টের UID ও পাসওয়ার্ড (বা হ্যাশ) দিন।
            </div>

            <form onSubmit={handleAddAccount} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Guest Account UID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 8317389851"
                  value={newUid}
                  onChange={(e) => setNewUid(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Password</label>
                <input
                  type="text"
                  required
                  placeholder="Password or Hash"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 text-black font-bold rounded-xl"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
