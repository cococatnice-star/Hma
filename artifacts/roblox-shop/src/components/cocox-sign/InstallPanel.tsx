import { motion } from "framer-motion";
import { Check, CloudUpload, Download, Loader2, LogIn, Smartphone, Trash2, TriangleAlert, X } from "lucide-react";

export const UPLOAD_DISCLOSURE =
  "Installing uploads only the signed IPA, which contains its embedded provisioning profile. Anyone with the link can download it until it expires after 24 hours. Your P12, private key and password are never uploaded. Hosted files are cleaned up after expiry while the service is awake.";

export function LoginNotice({ onLogin, loading }: { onLogin: () => void; loading: boolean }) {
  return (
    <div role="alert" className="mt-3 rounded-[14px] border border-[#ffb27a]/30 bg-[#ffb27a]/[0.08] p-3 text-[13px] text-[#ffdcc0]">
      <p>iOS installation needs you to log in. Logging in reloads this page and clears selected files, so log in before importing them.</p>
      <button type="button" onClick={onLogin} disabled={loading} data-testid="button-login-install"
        className="mt-2.5 inline-flex items-center gap-2 rounded-full bg-[#ff6a00] px-4 py-2 text-[13.5px] font-semibold text-[#1a0a00] active:scale-95 disabled:opacity-50">
        <LogIn className="h-4 w-4" /> Log in for installation
      </button>
    </div>
  );
}

export function InstallPanel(props: {
  phase: "idle" | "uploading" | "preparing" | "ready" | "error";
  progress: number; error: string; installUrl: string; expiresAt: string;
  isIOS: boolean; isAuthenticated: boolean; authLoading: boolean;
  onPrepare: () => void; onCancel: () => void; onRevoke: () => void; onLogin: () => void; onDownload: () => void;
}) {
  const { phase, progress, error, installUrl, expiresAt, isIOS, isAuthenticated } = props;
  const expires = expiresAt ? new Date(expiresAt) : null;

  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 overflow-hidden rounded-[18px] border border-[#ff6a00]/20 bg-[#22130a]">
      <div className="flex items-center gap-3 border-b border-[#ff6a00]/10 px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#ff6a00] text-[#1a0a00]"><Smartphone className="h-5 w-5" /></span>
        <div>
          <div className="text-[15.5px] font-semibold">Install on iOS</div>
          <div className="text-[12.5px] text-[#b88a6a]">{isIOS ? "Opens the iOS install prompt" : "Works only in Safari on iPhone or iPad"}</div>
        </div>
      </div>
      <div className="px-4 py-3 text-[13.5px] text-[#e8c8ad]">
        {!isIOS && <p className="mb-3 text-[#ffdcc0]">This device is not iOS. Download the IPA here, or open this page in Safari on your iPhone or iPad to install.</p>}

        {(phase === "idle") && (
          <>
            <p className="text-[12.5px] leading-snug text-[#a7826a]">{UPLOAD_DISCLOSURE}</p>
            {isAuthenticated ? (
              <button type="button" onClick={props.onPrepare} data-testid="button-prepare-install"
                className="mt-3 inline-flex items-center gap-2 rounded-[12px] bg-[#ff6a00] px-4 py-3 text-[15px] font-semibold text-[#1a0a00] active:scale-95">
                <CloudUpload className="h-4 w-4" /> I agree, upload and prepare install
              </button>
            ) : <LoginNotice onLogin={props.onLogin} loading={props.authLoading} />}
          </>
        )}

        {(phase === "uploading" || phase === "preparing") && (
          <div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-[#ff9a4a]" />{phase === "uploading" ? `Uploading signed IPA ${progress}%` : "Preparing install link"}</span>
              <button type="button" onClick={props.onCancel} data-testid="button-cancel-upload" className="inline-flex items-center gap-1 font-semibold text-[#ff6b52]"><X className="h-4 w-4" /> Cancel</button>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#ff6a00]/15" role="progressbar" aria-label="Upload progress"
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={phase === "uploading" ? progress : undefined}>
              {phase === "uploading"
                ? <div className="h-full rounded-full bg-[#ff6a00] transition-[width] duration-200" style={{ width: `${progress}%` }} />
                : <motion.div className="h-full w-1/3 rounded-full bg-[#ff6a00]" animate={{ x: ["-100%", "300%"] }} transition={{ duration: 1.2, repeat: Infinity }} />}
            </div>
            <p className="mt-2 text-[12px] text-[#a7826a]">Cancelling keeps your signed IPA available to download.</p>
          </div>
        )}

        {phase === "ready" && installUrl && (
          <div>
            <p className="flex items-center gap-2 text-[#ffd29a]"><Check className="h-4 w-4" /> Install link ready. iOS will ask you to confirm; that prompt, not this page, controls installation.</p>
            {expires && <p className="mt-1 text-[12px] text-[#a7826a]" data-testid="text-install-expiry">Link expires {expires.toLocaleString()}</p>}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <a href={installUrl} data-testid="link-install-ipa"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-[12px] bg-[#ff6a00] px-4 py-3 text-[15px] font-semibold text-[#1a0a00] active:scale-95">
                <Smartphone className="h-4 w-4" /> Install on iOS
              </a>
              <button type="button" onClick={props.onRevoke} data-testid="button-revoke-install"
                className="inline-flex items-center justify-center gap-2 rounded-[12px] bg-[#2c1810] px-4 py-3 text-[14px] font-semibold text-[#ff6b52] active:scale-95">
                <Trash2 className="h-4 w-4" /> Delete hosted copy
              </button>
            </div>
          </div>
        )}

        {phase === "error" && (
          <div role="alert">
            <p className="flex gap-2 text-[#ffd0c4]"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#ff5a3c]" />{error}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {isAuthenticated && <button type="button" onClick={props.onPrepare} data-testid="button-prepare-install" className="rounded-[12px] bg-[#ff6a00] px-4 py-2.5 text-[14px] font-semibold text-[#1a0a00]">Retry upload</button>}
              <button type="button" onClick={props.onDownload} className="inline-flex items-center gap-2 rounded-[12px] bg-[#2c1810] px-4 py-2.5 text-[14px] font-semibold text-[#ff9a4a]"><Download className="h-4 w-4" /> Download IPA</button>
              <button type="button" onClick={props.onRevoke} data-testid="button-revoke-install" className="rounded-[12px] px-3 py-2.5 text-[13px] text-[#ff6b52]">Delete hosted copy</button>
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
}
