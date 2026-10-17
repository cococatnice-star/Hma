import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Globe, Loader2, TriangleAlert } from "lucide-react";
import {
  getGetIpShareConsentQueryKey,
  useGetIpShareConsent,
  useSendIpShare,
} from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

const WARNINGS = ["idk", "wsp cp3", "hi", "hiiiiii"];

type Result = { ip: string; city: string | null; state: string | null };

function friendly(err: unknown, sending: boolean) {
  const e = err as {
    status?: number;
    data?: { error?: string } | null;
    message?: string;
  };
  const server = e?.data?.error;
  if (!sending) {
    if (e?.status === 503)
      return (
        server || "IP sharing is not available right now. Nothing was sent."
      );
    return server || "Could not prepare the confirmation. Nothing was sent.";
  }
  if (e?.status === undefined || e?.status === 0) {
    return "The connection failed before a reply arrived. Delivery could not be confirmed. It was not posted publicly, but it may or may not have been sent privately.";
  }
  return (
    server ||
    "Your IP was not confirmed as delivered. It was not posted publicly."
  );
}

export function GetIpButton() {
  const [open, setOpen] = useState(false);
  const [nonce, setNonce] = useState("");
  const [loadError, setLoadError] = useState("");
  const [sendError, setSendError] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const openGen = useRef(0);

  const consent = useGetIpShareConsent({
    query: {
      queryKey: getGetIpShareConsentQueryKey(),
      enabled: false,
      gcTime: 0,
      staleTime: 0,
      retry: false,
    },
  });
  const { mutateAsync, isPending } = useSendIpShare();
  const refetchRef = useRef(consent.refetch);
  refetchRef.current = consent.refetch;

  const loadNonce = async () => {
    const gen = ++openGen.current;
    setNonce("");
    setLoadError("");
    setSendError("");
    setResult(null);
    setAgreed(false);
    const r = await refetchRef.current();
    if (gen !== openGen.current) return;
    if (r.data?.nonce) setNonce(r.data.nonce);
    else setLoadError(friendly(r.error, false));
  };

  const onOpenChange = (next: boolean) => {
    if (isPending) return;
    setOpen(next);
    if (next) void loadNonce();
    else {
      openGen.current++;
      setNonce("");
      setAgreed(false);
    }
  };

  const confirm = async () => {
    if (isPending || !nonce || !agreed) return;
    const used = nonce;
    setNonce("");
    setSendError("");
    try {
      const res = await mutateAsync({ data: { consent: true, nonce: used } });
      if (res.delivered === true)
        setResult({
          ip: res.ip,
          city: res.city ?? null,
          state: res.state ?? null,
        });
      else
        setSendError("Delivery was not confirmed. It was not posted publicly.");
    } catch (err) {
      setSendError(friendly(err, true));
    }
  };

  const loadingNonce =
    open && !nonce && !loadError && !result && !sendError && !isPending;

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        data-testid="button-get-ip"
        aria-haspopup="dialog"
        className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-[#ff6a00]/30 bg-[#22130a] px-3 py-1 text-[12px] font-semibold text-[#ff9a4a] transition hover:bg-[#ff6a00]/15 active:scale-95"
      >
        <Globe className="h-3.5 w-3.5" /> Install delta
      </button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          data-testid="dialog-get-ip"
          onEscapeKeyDown={(e) => {
            if (isPending) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (isPending) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (isPending) e.preventDefault();
          }}
          className="max-h-[90dvh] w-[calc(100vw-24px)] max-w-md overflow-y-auto rounded-[20px] border border-[#ff6a00]/25 bg-[#1a0d05] p-5 text-[#fff1e4] sm:p-6"
          style={{
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <DialogTitle
              className="text-[22px] font-bold tracking-tight"
              style={{ fontFamily: "inherit" }}
            >
              Are you really sure?
            </DialogTitle>
            <DialogDescription className="mt-1 text-[13px] text-[#b88a6a]">
              This is optional. Cancelling does not affect signing or
              installation.
            </DialogDescription>

            {result ? (
              <div
                data-testid="status-ip-report"
                role="status"
                className="mt-5 rounded-[14px] border border-[#ffd29a]/30 bg-[#ffd29a]/10 p-4"
              >
                <p className="flex items-center gap-2 text-[14px] font-semibold text-[#ffd29a]">
                  <Check className="h-4 w-4" /> Sent privately to the Discord
                  bot’s owner
                </p>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[14px]">
                  <dt className="text-[#b88a6a]">IP</dt>
                  <dd
                    data-testid="text-shared-ip"
                    className="break-all font-mono"
                  >
                    {result.ip}
                  </dd>
                  <dt className="text-[#b88a6a]">City</dt>
                  <dd data-testid="text-shared-city">
                    {result.city ?? "Not available"}
                  </dd>
                  <dt className="text-[#b88a6a]">State</dt>
                  <dd data-testid="text-shared-state">
                    {result.state ?? "Not available"}
                  </dd>
                </dl>
                <p className="mt-3 text-[12px] text-[#a7826a]">
                  City and state are estimates from your IP, not GPS.
                </p>
              </div>
            ) : (
              <>
                <ol className="mt-4 space-y-2.5">
                  {WARNINGS.map((w, i) => (
                    <li
                      key={i}
                      data-testid={`warning-ip-${i + 1}`}
                      className="flex gap-3 rounded-[12px] bg-[#22130a] p-3 text-[13.5px] leading-snug text-[#e8c8ad]"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ff6a00] text-[11px] font-bold text-[#1a0a00]">
                        {i + 1}
                      </span>
                      {w}
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-[12px] leading-snug text-[#a7826a]">
                  The website uses temporary security hashes to prevent spam,
                  not a raw-IP location history. Old hashes are cleared on later
                  sharing attempts after 24 hours.
                </p>

                {(loadError || sendError) && (
                  <div
                    role="alert"
                    data-testid="status-ip-report"
                    className="mt-4 flex gap-2 rounded-[12px] border border-[#ff3b1f]/40 bg-[#ff3b1f]/12 p-3 text-[13px] text-[#ffd0c4]"
                  >
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#ff5a3c]" />
                    <span>
                      {loadError || sendError}
                      <button
                        type="button"
                        onClick={() => void loadNonce()}
                        className="ml-1 font-semibold text-[#ff9a4a] underline"
                      >
                        Try again
                      </button>
                    </span>
                  </div>
                )}

                <label className="mt-4 flex cursor-pointer items-start gap-3 text-[14px]">
                  <input
                    type="checkbox"
                    checked={agreed}
                    disabled={isPending || !nonce}
                    data-testid="checkbox-ip-consent"
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 h-5 w-5 accent-[#ff6a00]"
                  />
                  <span>
                    install delta.
                  </span>
                </label>
              </>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                data-testid="button-cancel-ip"
                className="rounded-[12px] bg-[#2c1810] px-4 py-3 text-[15px] font-semibold text-[#ff9a4a] disabled:opacity-40"
              >
                {result ? "Done" : "Cancel"}
              </button>
              {!result && (
                <button
                  type="button"
                  onClick={() => void confirm()}
                  disabled={isPending || !nonce || !agreed}
                  data-testid="button-confirm-ip"
                  className="inline-flex items-center justify-center gap-2 rounded-[12px] bg-[#ff6a00] px-4 py-3 text-[15px] font-semibold text-[#1a0a00] disabled:bg-[#ff6a00]/20 disabled:text-[#b88a6a]"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Sending
                    </>
                  ) : loadingNonce ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Preparing
                    </>
                  ) : (
                    "Yes, send my IP"
                  )}
                </button>
              )}
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
    </>
  );
}
