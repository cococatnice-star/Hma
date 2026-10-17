import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, Check, ChevronRight, Download, FileArchive, FileBadge, FileKey, Folder,
  KeyRound, Loader2, Lock, PenTool, Plus, RotateCcw, Settings, ShieldAlert, Smartphone,
  Trash2, TriangleAlert, X,
} from "lucide-react";
import { useCocoXSigner, type SignedIpa } from "@/hooks/useCocoXSigner";
import { useCocoXInstaller } from "@/hooks/useCocoXInstaller";
import { useAuth } from "@workspace/replit-auth-web";
import { GetIpButton } from "@/components/cocox-sign/GetIpButton";
import { InstallPanel, LoginNotice, UPLOAD_DISCLOSURE } from "@/components/cocox-sign/InstallPanel";
import { InspectionPanel } from "@/components/cocox-sign/InspectionPanel";

const IS_IOS = typeof navigator !== "undefined" &&
  (/iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

const BASE = import.meta.env.BASE_URL;
const PROFILE_URL = `${BASE}api/cocox-sign-profile`;
const NATIVE_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Rajdhani", system-ui, sans-serif';

type Tab = "files" | "certs" | "sign" | "settings";
type Slot = "ipa" | "p12" | "profile";

const TABS: { id: Tab; label: string; Icon: typeof Folder }[] = [
  { id: "files", label: "Files", Icon: Folder },
  { id: "certs", label: "Certificates", Icon: KeyRound },
  { id: "sign", label: "Sign", Icon: PenTool },
  { id: "settings", label: "Settings", Icon: Settings },
];

const SLOT_META: Record<Slot, { label: string; accept: string; exts: string[]; hint: string }> = {
  ipa: { label: "App package", accept: ".ipa,.zip", exts: ["ipa", "zip"], hint: ".ipa or .zip" },
  p12: { label: "Certificate", accept: ".p12,.pfx", exts: ["p12", "pfx"], hint: ".p12 or .pfx" },
  profile: { label: "Provisioning profile", accept: ".mobileprovision", exts: ["mobileprovision"], hint: ".mobileprovision" },
};

function fmtSize(n: number) {
  return n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

/* ---------- presentational pieces ---------- */

function Group({ title, footer, children }: { title?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-6">
      {title && <h3 className="mb-2 px-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#b88a6a]">{title}</h3>}
      <div className="overflow-hidden rounded-[18px] border border-[#ff6a00]/15 bg-[#22130a] shadow-[0_1px_0_rgba(255,180,120,0.06)_inset]">
        {children}
      </div>
      {footer && <p className="mt-2 px-4 text-[12.5px] leading-snug text-[#a7826a]">{footer}</p>}
    </section>
  );
}

function Row({ icon, tint = "#ff6a00", title, sub, right, onClick, testId, danger }: {
  icon: ReactNode; tint?: string; title: ReactNode; sub?: ReactNode; right?: ReactNode;
  onClick?: () => void; testId?: string; danger?: boolean;
}) {
  const inner = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#1a0a00]" style={{ background: tint }}>{icon}</span>
      <span className="min-w-0 flex-1 text-left">
        <span className={`block truncate text-[15.5px] font-medium ${danger ? "text-[#ff6b52]" : "text-[#fff1e4]"}`}>{title}</span>
        {sub && <span className="block truncate text-[12.5px] text-[#b88a6a]">{sub}</span>}
      </span>
      {right}
    </>
  );
  const cls = "flex w-full items-center gap-3 px-4 py-3 border-b border-[#ff6a00]/10 last:border-b-0";
  return onClick ? (
    <button type="button" onClick={onClick} data-testid={testId} className={`${cls} transition-colors hover:bg-[#ff6a00]/[0.06] active:bg-[#ff6a00]/[0.12]`}>{inner}</button>
  ) : (
    <div className={cls} data-testid={testId}>{inner}</div>
  );
}

function Alert({ children, tone = "error", testId }: { children: ReactNode; tone?: "error" | "warn"; testId?: string }) {
  const err = tone === "error";
  return (
    <motion.div role={err ? "alert" : "note"} data-testid={testId}
      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
      className={`mb-4 flex gap-2.5 rounded-[14px] border p-3 text-[13.5px] leading-snug ${err ? "border-[#ff3b1f]/40 bg-[#ff3b1f]/12 text-[#ffd0c4]" : "border-[#ffb27a]/25 bg-[#ffb27a]/[0.08] text-[#ffdcc0]"}`}>
      {err ? <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#ff5a3c]" /> : <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#ffb27a]" />}
      <span>{children}</span>
    </motion.div>
  );
}

function PickButton({ label, onClick, disabled, testId }: { label: string; onClick: () => void; disabled?: boolean; testId?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} data-testid={testId}
      className="rounded-full bg-[#ff6a00]/15 px-3 py-1.5 text-[13px] font-semibold text-[#ff9a4a] transition hover:bg-[#ff6a00]/25 active:scale-95 disabled:opacity-40">
      {label}
    </button>
  );
}

/* ---------- page ---------- */

export default function CocoXSign() {
  const installer = useCocoXInstaller();
  const { isAuthenticated, isLoading: authLoading, login } = useAuth();
  const [autoInstall, setAutoInstall] = useState(false);
  const autoAttempted = useRef<SignedIpa | null>(null);
  const prepareRef = useRef(installer.prepare);
  prepareRef.current = installer.prepare;
  const clearInstallRef = useRef(installer.clear);
  clearInstallRef.current = installer.clear;
  const [tab, setTab] = useState<Tab>("files");
  const [files, setFiles] = useState<Record<Slot, File | null>>({ ipa: null, p12: null, profile: null });
  const [password, setPassword] = useState("");
  const [outputName, setOutputName] = useState("");
  const [formError, setFormError] = useState("");
  const [warningsAcknowledged, setWarningsAcknowledged] = useState(false);
  const { status, error, logs, result, sign, cancel, download, inspection, inspecting } =
    useCocoXSigner({ ...files, password });
  const inputs = { ipa: useRef<HTMLInputElement>(null), p12: useRef<HTMLInputElement>(null), profile: useRef<HTMLInputElement>(null) };

  const signing = status === "signing";
  const missing = (Object.keys(files) as Slot[]).filter((k) => !files[k]);
  const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Any change to signing inputs invalidates a running job or a stale result.
  const invalidate = () => {
    setWarningsAcknowledged(false);
    if (status !== "idle") cancel();
    installer.clear();
    autoAttempted.current = null;
    setFormError("");
  };

  const runPrepare = (target: SignedIpa) => {
    autoAttempted.current = target;
    void prepareRef.current(target).then((url) => {
      if (url && IS_IOS) window.location.href = url;
    });
  };

  // Auto-prepare exactly once per real signing result when the user consented.
  useEffect(() => {
    if (status !== "success" || !result || !autoInstall || !isAuthenticated) return;
    if (autoAttempted.current === result) return;
    runPrepare(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, result, autoInstall, isAuthenticated]);

  // If the signer leaves success (cancel/reset/new run), discard install state for the old result.
  useEffect(() => {
    if (status !== "success") clearInstallRef.current();
  }, [status]);

  const pick = (slot: Slot) => inputs[slot].current?.click();
  const onFile = (slot: Slot, f: File | undefined) => {
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!SLOT_META[slot].exts.includes(ext)) {
      setFormError(`${SLOT_META[slot].label} must be ${SLOT_META[slot].hint}. "${f.name}" was not accepted.`);
      return;
    }
    invalidate();
    setFiles((p) => ({ ...p, [slot]: f }));
  };
  const remove = (slot: Slot) => { invalidate(); setFiles((p) => ({ ...p, [slot]: null })); };

  const start = () => {
    if (missing.length) {
      setFormError(`Missing: ${missing.map((m) => SLOT_META[m].label.toLowerCase()).join(", ")}. Add ${missing.length > 1 ? "them" : "it"} in ${missing.includes("ipa") ? "Files" : "Certificates"}.`);
      return;
    }
    if (autoInstall && !isAuthenticated) {
      setFormError("Log in before signing to prepare iOS installation, or turn off Prepare iOS installation to sign locally.");
      return;
    }
    setFormError("");
    if (inspecting || !inspection) {
      setFormError("Wait for local certificate and profile inspection before signing.");
      return;
    }
    if (inspection.warnings.length && !warningsAcknowledged) {
      setFormError("Review and acknowledge the local inspection warnings before signing.");
      return;
    }
    installer.clear();
    autoAttempted.current = null;
    sign({ ipa: files.ipa!, p12: files.p12!, profile: files.profile!, password, outputName: outputName.trim() || undefined }, warningsAcknowledged);
  };
  const resetAll = () => {
    cancel();
    installer.clear();
    autoAttempted.current = null;
    setFiles({ ipa: null, p12: null, profile: null });
    setPassword(""); setOutputName(""); setFormError("");
    setWarningsAcknowledged(false);
  };

  const statusLabel = status === "idle" ? (missing.length ? "Not ready" : "Ready") : status === "signing" ? "Signing" : status === "success" ? "Signed" : "Failed";
  const statusColor = status === "success" ? "#ffd29a" : status === "error" ? "#ff5a3c" : status === "signing" || !missing.length ? "#ff6a00" : "#6b4a35";

  const titles: Record<Tab, string> = { files: "Files", certs: "Certificates", sign: "Sign", settings: "Settings" };

  const shortcutCard = (
    <Group title="Home Screen" footer="Adds only a CocoX Sign shortcut that opens this page. No DNS or network changes, no silent install, not a native app. Remove it anytime in Settings > General > VPN & Device Management.">
      <a href={PROFILE_URL} data-testid="link-mobileconfig" className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#ff6a00]/[0.06]">
        <img src={`${BASE}cocox-sign-icon.png`} alt="" className="h-9 w-9 rounded-[10px] object-cover" />
        <span className="flex-1">
          <span className="block text-[15.5px] font-medium text-[#ff9a4a]">Add to Home Screen</span>
          <span className="block text-[12.5px] text-[#b88a6a]">Downloads the shortcut profile</span>
        </span>
        <Download className="h-4 w-4 text-[#ff9a4a]" />
      </a>
      <ol className="space-y-2 border-t border-[#ff6a00]/10 px-4 py-3 text-[13.5px] text-[#e8c8ad]">
        {["In Safari, tap Add to Home Screen, then Allow.", "Open Settings and tap Profile Downloaded.", "Tap Install, enter your passcode, then Install."].map((s, i) => (
          <li key={s} className="flex gap-3"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ff6a00] text-[11px] font-bold text-[#1a0a00]">{i + 1}</span>{s}</li>
        ))}
      </ol>
    </Group>
  );

  return (
    <div className="min-h-[100dvh] bg-[#120904] text-[#fff1e4] antialiased" style={{ fontFamily: NATIVE_FONT }}>
      <div className="pointer-events-none fixed -left-32 -top-40 h-[440px] w-[440px] rounded-full bg-[#ff5a00]/20 blur-[140px]" />
      <div className="pointer-events-none fixed -bottom-40 right-0 h-[380px] w-[380px] rounded-full bg-[#ff9a1f]/10 blur-[140px]" />

      {(["ipa", "p12", "profile"] as Slot[]).map((s) => (
        <input key={s} ref={inputs[s]} type="file" accept={SLOT_META[s].accept} className="hidden" data-testid={`input-${s}`}
          onChange={(e) => { onFile(s, e.target.files?.[0]); e.target.value = ""; }} />
      ))}

      <div className="relative mx-auto flex min-h-[100dvh] max-w-6xl">
        {/* Sidebar: tablet/desktop */}
        <aside className="sticky top-0 hidden h-[100dvh] w-64 shrink-0 flex-col border-r border-[#ff6a00]/10 px-4 py-6 md:flex">
          <div className="flex items-center gap-3 px-2">
            <img src={`${BASE}cocox-sign-icon.png`} alt="" className="h-11 w-11 rounded-[12px] object-cover shadow-[0_8px_24px_rgba(255,106,0,0.35)]" />
            <div>
              <div className="font-display text-[15px] font-black tracking-wide">COCOX <span className="text-[#ff6a00]">SIGN</span></div>
              <div className="text-[11px] text-[#b88a6a]">Private on-device signer</div>
            </div>
          </div>
          <nav className="mt-8 space-y-1" role="tablist" aria-label="CocoX Sign sections">
            {TABS.map(({ id, label, Icon }) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} aria-label={`${label} tab`} data-testid={`tab-${id}`}
                onClick={() => setTab(id)}
                className={`relative flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-[15px] font-medium transition-colors ${tab === id ? "text-[#1a0a00]" : "text-[#e8c8ad] hover:bg-[#ff6a00]/[0.07]"}`}>
                {tab === id && <motion.span layoutId="side-pill" className="absolute inset-0 rounded-[12px] bg-[#ff6a00]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                <Icon className="relative h-[18px] w-[18px]" /><span className="relative">{label}</span>
              </button>
            ))}
          </nav>
          <Link href="/" data-testid="link-home" className="mt-auto flex items-center gap-2 rounded-[12px] px-3 py-2.5 text-[14px] text-[#b88a6a] transition-colors hover:text-[#ff9a4a]">
            <ArrowLeft className="h-4 w-4" /> CocoX homepage
          </Link>
        </aside>

        <main className="min-w-0 flex-1 pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-10">
          {/* Large-title header */}
          <header className="sticky top-0 z-20 border-b border-[#ff6a00]/10 bg-[#120904]/80 px-5 pb-3 pt-[calc(12px+env(safe-area-inset-top))] backdrop-blur-xl md:px-10 md:pt-8">
            <div className="flex items-center justify-between md:hidden">
              <Link href="/" aria-label="CocoX homepage" className="flex items-center gap-1 text-[15px] text-[#ff9a4a]"><ArrowLeft className="h-4 w-4" /> Home</Link>
              <span className="flex items-center gap-2 font-display text-[11px] font-black tracking-[0.18em]"><img src={`${BASE}cocox-sign-icon.png`} alt="" className="h-7 w-7 rounded-[8px] object-cover" />COCOX <span className="text-[#ff6a00]">SIGN</span></span>
            </div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <AnimatePresence mode="wait">
                <motion.h1 key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}
                  className="text-[32px] font-bold tracking-tight" style={{ fontFamily: NATIVE_FONT }}>{titles[tab]}</motion.h1>
              </AnimatePresence>
              <div className="flex items-center gap-2">
              <GetIpButton />
              <span data-testid="status-signer" className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-[#22130a] px-3 py-1 text-[12px] font-semibold">
                <motion.span className="h-2 w-2 rounded-full" style={{ background: statusColor }}
                  animate={signing ? { opacity: [1, 0.3, 1] } : { opacity: 1 }} transition={{ duration: 1, repeat: signing ? Infinity : 0 }} />
                {statusLabel}
              </span>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-2xl px-4 pt-5 md:px-10">
            <AnimatePresence>
              {(formError || (status === "error" && error)) && <Alert testId="text-error">{formError || error}</Alert>}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2, ease: "easeOut" }}>
                {tab === "files" && (
                  <>
                    <Group title="Selected app" footer="Files stay in this tab's memory only. Your P12 and password stay local; the signed IPA is uploaded only if you choose installation. Closing the page clears them.">
                      {files.ipa ? (
                        <Row icon={<FileArchive className="h-5 w-5" />} title={files.ipa.name} sub={fmtSize(files.ipa.size)} testId="text-file-ipa"
                          right={<div className="flex items-center gap-2">
                            <PickButton label="Replace" onClick={() => pick("ipa")} disabled={signing} />
                            <button type="button" aria-label="Delete selected IPA" data-testid="button-delete-ipa" onClick={() => remove("ipa")} disabled={signing}
                              className="rounded-full p-2 text-[#ff6b52] transition hover:bg-[#ff3b1f]/15 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
                          </div>} />
                      ) : (
                        <Row icon={<Plus className="h-5 w-5" />} title="Import IPA" sub="Choose an .ipa or .zip from your device" onClick={() => pick("ipa")} testId="button-import-ipa"
                          right={<ChevronRight className="h-4 w-4 text-[#6b4a35]" />} />
                      )}
                    </Group>
                    <Group title="Signed output">
                      {result ? (
                        <Row icon={<Check className="h-5 w-5" strokeWidth={3} />} tint="#ffd29a" title={result.name} sub={`${fmtSize(result.blob.size)} · ready to download`} testId="text-result"
                          right={<PickButton label="Download" onClick={download} />} />
                      ) : (
                        <Row icon={<PenTool className="h-5 w-5" />} tint="#4a2e1c" title={<span className="text-[#b88a6a]">No signed IPA yet</span>}
                          sub="Sign an app to create one" onClick={() => setTab("sign")} right={<ChevronRight className="h-4 w-4 text-[#6b4a35]" />} />
                      )}
                    </Group>
                  </>
                )}

                {tab === "certs" && (
                  <>
                    <Group title="Signing identity" footer="Dates and profile matching are inspected locally. Apple revocation status and installation eligibility cannot be verified offline.">
                      {(["p12", "profile"] as Slot[]).map((s) => {
                        const f = files[s];
                        return (
                          <Row key={s} icon={s === "p12" ? <FileKey className="h-5 w-5" /> : <FileBadge className="h-5 w-5" />}
                            tint={f ? "#ff6a00" : "#4a2e1c"} title={SLOT_META[s].label} sub={f ? `${f.name} · ${fmtSize(f.size)}` : `Choose ${SLOT_META[s].hint}`}
                            testId={`text-file-${s}`}
                            right={<div className="flex items-center gap-2">
                              <PickButton label={f ? "Replace" : "Choose"} onClick={() => pick(s)} disabled={signing} testId={`button-pick-${s}`} />
                              {f && <button type="button" aria-label={`Delete ${SLOT_META[s].label}`} data-testid={`button-delete-${s}`} onClick={() => remove(s)} disabled={signing}
                                className="rounded-full p-2 text-[#ff6b52] transition hover:bg-[#ff3b1f]/15 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>}
                            </div>} />
                        );
                      })}
                    </Group>
                    <Group title="Password" footer="Leave empty only if the certificate was exported without a password. The password is used in memory for this signing run and never stored.">
                      <label className="flex items-center gap-3 px-4 py-3">
                        <Lock className="h-4 w-4 text-[#ff9a4a]" />
                        <input type="password" autoComplete="off" value={password} disabled={signing} placeholder="Certificate password (optional)"
                          data-testid="input-password" aria-label="Certificate password"
                          onChange={(e) => { invalidate(); setPassword(e.target.value); }}
                          className="w-full bg-transparent text-[16px] text-[#fff1e4] outline-none placeholder:text-[#6b4a35] disabled:opacity-50" />
                      </label>
                    </Group>
                    <InspectionPanel report={inspection} inspecting={inspecting} acknowledge={warningsAcknowledged}
                      onAcknowledge={setWarningsAcknowledged} disabled={signing} canAcknowledge={false} />
                  </>
                )}

                {tab === "sign" && (
                  <>
                    <Group title="Checklist">
                      {(["ipa", "p12", "profile"] as Slot[]).map((s) => (
                        <Row key={s} icon={files[s] ? <Check className="h-5 w-5" strokeWidth={3} /> : <X className="h-5 w-5" />}
                          tint={files[s] ? "#ff6a00" : "#4a2e1c"} title={SLOT_META[s].label}
                          sub={files[s]?.name ?? "Missing"} onClick={() => setTab(s === "ipa" ? "files" : "certs")}
                          right={<ChevronRight className="h-4 w-4 text-[#6b4a35]" />} />
                      ))}
                      <Row icon={<KeyRound className="h-5 w-5" />} tint={password ? "#ff6a00" : "#4a2e1c"} title="Password" sub={password ? "Entered" : "Empty (passwordless certificate)"}
                        onClick={() => setTab("certs")} right={<ChevronRight className="h-4 w-4 text-[#6b4a35]" />} />
                    </Group>
                    <Group title="Output name">
                      <input value={outputName} disabled={signing} data-testid="input-output-name" aria-label="Output file name"
                        onChange={(e) => { invalidate(); setOutputName(e.target.value); }}
                        placeholder={files.ipa ? files.ipa.name.replace(/\.(ipa|zip)$/i, "") + "_signed" : "MyApp_signed"}
                        className="w-full bg-transparent px-4 py-3.5 text-[16px] text-[#fff1e4] outline-none placeholder:text-[#6b4a35] disabled:opacity-50" />
                    </Group>

                    <InspectionPanel report={inspection} inspecting={inspecting} acknowledge={warningsAcknowledged}
                      onAcknowledge={checked => { setWarningsAcknowledged(checked); setFormError(""); }} disabled={signing} canAcknowledge={!missing.length} />

                    <Group title="Installation" footer={UPLOAD_DISCLOSURE}>
                      <label className="flex cursor-pointer items-center gap-3 px-4 py-3.5">
                        <input type="checkbox" checked={autoInstall} disabled={signing} data-testid="checkbox-auto-install"
                          onChange={(e) => { setAutoInstall(e.target.checked); setFormError(""); }}
                          className="h-5 w-5 accent-[#ff6a00]" />
                        <span className="flex-1 text-[15.5px]">Prepare iOS installation after signing</span>
                      </label>
                    </Group>
                    {autoInstall && !isAuthenticated && <LoginNotice onLogin={login} loading={authLoading} />}

                    {isMobile && status !== "success" && <Alert tone="warn" testId="text-memory-warning">Phones have limited memory. Keep this tab in front; large apps may fail, desktop is more reliable.</Alert>}

                    {signing && (
                      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[#ff6a00]/15" role="progressbar" aria-label="Signing in progress" aria-busy="true">
                        <motion.div className="h-full w-1/3 rounded-full bg-gradient-to-r from-[#ff6a00] to-[#ffb27a]" animate={{ x: ["-100%", "300%"] }} transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }} />
                      </div>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row">
                      {status === "success" && result ? (
                        <>
                          <motion.button type="button" onClick={download} data-testid="button-download" initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} whileTap={{ scale: 0.97 }}
                            className="flex flex-1 items-center justify-center gap-2 rounded-[14px] bg-[#ff6a00] py-4 text-[16px] font-semibold text-[#1a0a00] shadow-[0_12px_30px_-10px_rgba(255,106,0,0.8)]">
                            <Download className="h-5 w-5" /> Download signed IPA
                          </motion.button>
                          <button type="button" onClick={resetAll} data-testid="button-reset" className="flex items-center justify-center gap-2 rounded-[14px] bg-[#22130a] px-5 py-4 text-[15px] font-semibold text-[#ff9a4a] active:scale-95">
                            <RotateCcw className="h-4 w-4" /> Start over
                          </button>
                        </>
                      ) : signing ? (
                        <>
                          <div className="flex flex-1 items-center justify-center gap-2 rounded-[14px] bg-[#ff6a00]/15 py-4 text-[16px] font-semibold text-[#ff9a4a]"><Loader2 className="h-5 w-5 animate-spin" /> Signing on this device</div>
                          <button type="button" onClick={cancel} data-testid="button-cancel" className="flex items-center justify-center gap-2 rounded-[14px] bg-[#22130a] px-5 py-4 text-[15px] font-semibold text-[#ff6b52] active:scale-95">
                            <X className="h-4 w-4" /> Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <motion.button type="button" onClick={start} data-testid="button-sign"
                            disabled={!missing.length && (inspecting || !inspection || (!!inspection.warnings.length && !warningsAcknowledged))}
                            aria-disabled={missing.length > 0 || inspecting || !inspection || (!!inspection.warnings.length && !warningsAcknowledged)} whileTap={{ scale: 0.97 }}
                            className={`flex-1 rounded-[14px] py-4 text-[16px] font-semibold transition ${missing.length ? "bg-[#ff6a00]/15 text-[#b88a6a]" : "bg-[#ff6a00] text-[#1a0a00] shadow-[0_12px_30px_-10px_rgba(255,106,0,0.8)]"}`}>
                            {inspecting ? "Inspecting locally…" : status === "error" ? "Retry signing" : "Sign IPA"}
                          </motion.button>
                          <button type="button" onClick={resetAll} data-testid="button-reset" className="flex items-center justify-center gap-2 rounded-[14px] bg-[#22130a] px-5 py-4 text-[15px] font-semibold text-[#ff9a4a] active:scale-95">
                            <RotateCcw className="h-4 w-4" /> Reset
                          </button>
                        </>
                      )}
                    </div>
                    <p className="mt-3 text-[12.5px] text-[#a7826a]">A signed file does not prove Apple trusts the certificate; revoked certificates stop apps from opening.</p>

                    {status === "success" && result && (
                      <InstallPanel phase={installer.phase} progress={installer.progress} error={installer.error}
                        installUrl={installer.installUrl} expiresAt={installer.expiresAt} isIOS={IS_IOS}
                        isAuthenticated={isAuthenticated} authLoading={authLoading}
                        onPrepare={() => runPrepare(result)}
                        onCancel={() => installer.clear()}
                        onRevoke={() => { void installer.revoke(); }}
                        onLogin={login} onDownload={download} />
                    )}

                    {logs.length > 0 && (
                      <div className="mt-6">
                        <h3 className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#b88a6a]">Engine log</h3>
                        <pre data-testid="text-logs" aria-live="polite" className="max-h-56 overflow-auto whitespace-pre-wrap rounded-[14px] border border-[#ff6a00]/10 bg-[#0b0502] p-3 font-mono text-[11.5px] leading-relaxed text-[#ffd8b8]/80">{logs.join("\n")}</pre>
                      </div>
                    )}
                  </>
                )}

                {tab === "settings" && (
                  <>
                    {shortcutCard}
                    <Group title="Privacy">
                      <Row icon={<Lock className="h-5 w-5" />} title="Private signing" sub="P12 and password stay local; IPA uploaded only if you choose installation" />
                      <Row icon={<KeyRound className="h-5 w-5" />} title="No secret retention" sub="Password and keys live in memory only" />
                      <Row icon={<Smartphone className="h-5 w-5" />} title="Memory" sub="Large apps sign best on desktop Chrome or Edge" />
                    </Group>
                    <Group title="Session">
                      <Row icon={<Trash2 className="h-5 w-5" />} tint="#ff3b1f" danger title="Clear all files and password" onClick={resetAll} testId="button-clear-session" />
                    </Group>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Bottom tab bar: phone */}
      <nav role="tablist" aria-label="CocoX Sign sections"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[#ff6a00]/15 bg-[#160b05]/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-lg">
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button key={id} type="button" role="tab" aria-selected={active} aria-label={`${label} tab`} data-testid={`tabbar-${id}`}
                onClick={() => setTab(id)} className="relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 pt-1.5">
                {active && <motion.span layoutId="tab-dot" className="absolute top-0 h-[3px] w-8 rounded-full bg-[#ff6a00]" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
                <motion.span animate={{ scale: active ? 1.1 : 1, y: active ? -1 : 0 }}>
                  <Icon className={`h-[22px] w-[22px] ${active ? "text-[#ff6a00]" : "text-[#8a6650]"}`} />
                </motion.span>
                <span className={`text-[10.5px] font-medium ${active ? "text-[#ff9a4a]" : "text-[#8a6650]"}`}>{label}</span>
                {id === "sign" && signing && <span className="absolute right-[30%] top-2 h-2 w-2 animate-pulse rounded-full bg-[#ff6a00]" />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
