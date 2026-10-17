import { Link } from "wouter";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  getGetDeltaInstallCountQueryKey,
  useGetDeltaInstallCount,
} from "@workspace/api-client-react";
import { SiVisa, SiMastercard, SiBitcoin } from "react-icons/si";
import { products } from "@/data/products";
import { ProductCard } from "@/components/ui/ProductCard";
import { ShieldCheck, Zap, Clock, HeadphonesIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DeltaV2InstallButton } from "@/components/DeltaV2InstallButton";

const predictionColors = [
  { label: "RED", value: "#ef4444" },
  { label: "BLUE", value: "#3b82f6" },
  { label: "GREEN", value: "#22c55e" },
  { label: "PURPLE", value: "#a855f7" },
  { label: "YELLOW", value: "#eab308" },
  { label: "ORANGE", value: "#f97316" },
];

type ObservedColors = [string, string, string, string];

export default function Home() {
  const featuredProducts = products.slice(0, 6);
  const { toast } = useToast();
  const [showLauncher, setShowLauncher] = useState(true);
  const [shortcutRequested, setShortcutRequested] = useState(false);
  const [showColorPredictor, setShowColorPredictor] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(true);
  const [observedColors, setObservedColors] = useState<ObservedColors>([
    "",
    "",
    "",
    "",
  ]);
  const [predictedColors, setPredictedColors] = useState<string[]>([]);
  const [predictionMode, setPredictionMode] = useState<"one" | "four">("four");
  const { data: deltaInstallData } = useGetDeltaInstallCount({
    query: {
      queryKey: getGetDeltaInstallCountQueryKey(),
      refetchInterval: 2000,
    },
  });

  const handleDeltaInstall = () => {
    const recorded = navigator.sendBeacon("/api/delta-install");

    if (!recorded) {
      void fetch("/api/delta-install", {
        method: "POST",
        keepalive: true,
      });
    }
  };

  const handleComingSoon = (sign: "K") => {
    toast({
      title: `${sign} SIGN`,
      description: `${sign} Sign is coming soon.`,
    });
  };

  const playDecisionSound = (frequency: number) => {
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, context.currentTime);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        context.currentTime + 0.12,
      );
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.12);
      oscillator.addEventListener("ended", () => {
        void context.close();
      });
    } catch {
      // Browsers can block audio without affecting color selection.
    }
  };

  const getPredictedColors = (count: number) => {
    const patternScore = observedColors.reduce((score, color, index) => {
      const colorIndex = predictionColors.findIndex(
        (option) => option.value === color,
      );
      return score + Math.max(colorIndex, 0) * (index + 1);
    }, 0);

    return Array.from({ length: count }, (_, index) => {
      const nextIndex =
        (patternScore + index * 2 + observedColors.length) %
        predictionColors.length;
      return predictionColors[nextIndex].value;
    });
  };

  const handlePredictColors = () => {
    playDecisionSound(720);
    setPredictionMode("four");
    setPredictedColors(getPredictedColors(4));
  };

  const handleDiceOne = () => {
    playDecisionSound(620);
    setPredictionMode("one");
    setPredictedColors(getPredictedColors(1));
  };

  const updateObservedColor = (index: number, value: string) => {
    if (index < 0 || index > 3) return;

    setObservedColors((current) => {
      const next = [...current] as ObservedColors;
      next[index] = value;
      return next;
    });
    setPredictedColors([]);
    playDecisionSound(360 + index * 70);
  };

  if (showColorPredictor) {
    return (
      <div className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center overflow-y-auto bg-[#050d1a] px-5 py-10 text-center">
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage: `repeating-linear-gradient(rgba(255,122,0,0.08) 0 1px, transparent 1px 100%), repeating-linear-gradient(90deg, rgba(255,122,0,0.08) 0 1px, transparent 1px 100%)`,
            backgroundSize: "40px 40px",
          }}
        />
        <motion.div
          className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[130px]"
          animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.75, 0.4] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.button
          type="button"
          onClick={() => {
            setShowColorPredictor(false);
            setShowLauncher(true);
          }}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute left-4 top-4 z-20 border border-primary/40 bg-black/50 px-3 py-2 font-display text-[10px] font-bold uppercase tracking-[0.16em] text-primary transition-colors hover:bg-primary hover:text-black sm:left-8 sm:top-6"
        >
          [ BACK TO INSTALL ]
        </motion.button>

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 22 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="relative z-10 w-full max-w-2xl border border-primary/40 bg-black/70 p-6 shadow-[0_0_55px_rgba(255,122,0,0.16)] sm:p-10"
        >
          <div className="corner-tl" />
          <div className="corner-tr" />
          <div className="corner-bl" />
          <div className="corner-br" />
          <div className="font-display text-[10px] tracking-[0.32em] text-primary sm:text-xs">
            [ COLOR PATTERN SCANNER ]
          </div>
          <h1 className="mt-5 font-display text-2xl font-black uppercase tracking-tight text-white sm:text-4xl">
            Predict A Color
          </h1>
          <p className="mx-auto mt-3 max-w-lg font-sans text-sm text-muted-foreground sm:text-base">
            Enter the other person&apos;s four colors, then scan the pattern to
            predict the next four.
          </p>

          <div className="mt-8 flex items-center justify-between border-b border-primary/20 pb-3 text-left">
            <span className="font-display text-[10px] font-bold tracking-[0.2em] text-primary">
              OBSERVED SEQUENCE
            </span>
            <span className="font-display text-[10px] font-bold tracking-[0.16em] text-white/50">
              4 INPUTS REQUIRED
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => {
              const color = observedColors[index] ?? "";

              return (
                <motion.div
                  key={`input-${index + 1}`}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08, duration: 0.35 }}
                  className="group flex min-h-[210px] flex-col items-center justify-between gap-3 border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-4 text-left transition-all hover:-translate-y-1 hover:border-primary/60 hover:shadow-[0_0_22px_rgba(255,122,0,0.12)]"
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="font-display text-[10px] font-bold tracking-[0.18em] text-primary">
                      COLOR {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="font-display text-[9px] tracking-widest text-white/30">
                      0{index + 1}/04
                    </span>
                  </div>
                  <span
                    className="h-20 w-20 rounded-full border-2 border-white/20 transition-all duration-500 group-hover:scale-110"
                    style={{
                      backgroundColor: color || "#111827",
                      boxShadow: color
                        ? `0 0 28px ${color}99`
                        : "inset 0 0 18px rgba(255,255,255,0.06)",
                    }}
                  />
                  <div
                    aria-label={`Observed color ${index + 1}`}
                    className="grid w-full grid-cols-3 gap-1.5"
                  >
                    {predictionColors.map((option) => {
                      const selected = color === option.value;

                      return (
                        <motion.button
                          key={option.value}
                          type="button"
                          title={option.label}
                          aria-label={`Set color ${index + 1} to ${option.label}`}
                          onClick={() =>
                            updateObservedColor(index, option.value)
                          }
                          whileHover={{ scale: 1.08 }}
                          whileTap={{ scale: 0.92 }}
                          className={`h-7 rounded-sm border transition-all ${
                            selected
                              ? "border-white ring-1 ring-primary ring-offset-1 ring-offset-[#050d1a]"
                              : "border-white/10 hover:border-white/70"
                          }`}
                          style={{
                            backgroundColor: option.value,
                            boxShadow: selected
                              ? `0 0 12px ${option.value}aa`
                              : "none",
                          }}
                        />
                      );
                    })}
                  </div>
                  <span className="font-display text-[9px] font-bold tracking-[0.16em] text-white/50">
                    {predictionColors.find((option) => option.value === color)
                      ?.label ?? "CHOOSE COLOR"}
                  </span>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-[1fr_auto]">
            <motion.button
              type="button"
              onClick={handlePredictColors}
              disabled={observedColors.some((color) => !color)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full border border-primary bg-primary px-5 py-4 font-display text-sm font-bold uppercase tracking-[0.2em] text-black transition-colors hover:bg-white disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-white/30"
            >
              [ PREDICT NEXT 4 COLORS ]
            </motion.button>
            <motion.button
              type="button"
              onClick={handleDiceOne}
              disabled={observedColors.some((color) => !color)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full border border-primary/60 bg-primary/5 px-5 py-4 font-display text-xs font-bold uppercase tracking-[0.16em] text-primary transition-colors hover:bg-primary hover:text-black disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/30 sm:w-auto"
            >
              [ DICE ONLY ONE ]
            </motion.button>
          </div>

          {predictedColors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-8 overflow-hidden border-t border-primary/20 pt-6"
            >
              <div className="font-display text-[10px] font-bold tracking-[0.24em] text-primary">
                {predictionMode === "one"
                  ? "[ ONE COLOR DICE RESULT ]"
                  : "[ NEXT 4 COLOR PREDICTIONS ]"}
              </div>
              <div
                className={
                  predictionMode === "one"
                    ? "mt-5 flex justify-center"
                    : "mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"
                }
              >
                {predictedColors.map((color, index) => (
                  <motion.div
                    key={`${color}-${index}`}
                    initial={{ opacity: 0, scale: 0.5, rotate: -8 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    transition={{
                      delay: index * 0.16,
                      type: "spring",
                      stiffness: 180,
                      damping: 12,
                    }}
                    className={`flex flex-col items-center gap-3 border border-primary/30 bg-primary/5 p-3 ${
                      predictionMode === "one" ? "w-full max-w-[220px]" : ""
                    }`}
                  >
                    <span className="font-display text-[10px] font-bold tracking-[0.18em] text-white/70">
                      NEXT {index + 1}
                    </span>
                    <span
                      className="h-16 w-16 rounded-full border-2 border-white/30"
                      style={{
                        backgroundColor: color,
                        boxShadow: `0 0 30px ${color}aa`,
                      }}
                    />
                    <span className="font-display text-[10px] font-bold tracking-widest text-primary">
                      {predictionColors.find((option) => option.value === color)
                        ?.label ?? "UNKNOWN"}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  }

  if (showLauncher) {
    return (
      <div className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center overflow-hidden bg-[#050d1a] px-5 text-center">
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage: `repeating-linear-gradient(rgba(255,122,0,0.08) 0 1px, transparent 1px 100%), repeating-linear-gradient(90deg, rgba(255,122,0,0.08) 0 1px, transparent 1px 100%)`,
            backgroundSize: "40px 40px",
          }}
        />
        <motion.div
          className="absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]"
          animate={{ scale: [1, 1.12, 1], opacity: [0.45, 0.7, 0.45] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute right-4 top-4 z-10 text-right font-display text-[9px] font-bold uppercase leading-relaxed tracking-[0.16em] text-primary/80 sm:right-8 sm:top-6 sm:text-xs">
          <div>K SIGN IS COMING SOON</div>
          <div>COCOX SIGN IS AVAILABLE</div>
        </div>
        <motion.button
          type="button"
          onClick={() => {
            setShowLauncher(false);
            setShowColorPredictor(true);
          }}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="absolute left-4 top-4 z-20 border border-primary/40 bg-black/50 px-3 py-2 font-display text-[10px] font-bold uppercase tracking-[0.12em] text-primary transition-colors hover:bg-primary hover:text-black sm:left-8 sm:top-6"
        >
          [ SKIP ] GO TO PREDICT A COLOR
        </motion.button>

        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="relative z-10 w-full max-w-lg border border-primary/40 bg-black/65 p-6 shadow-[0_0_55px_rgba(255,122,0,0.16)] sm:p-10"
        >
          <div className="corner-tl" />
          <div className="corner-tr" />
          <div className="corner-bl" />
          <div className="corner-br" />
          <div className="font-display text-[10px] tracking-[0.32em] text-primary sm:text-xs">
            [ SELECT EXECUTOR ]
          </div>
          <h1 className="mt-5 font-display text-2xl font-black uppercase tracking-tight text-white sm:text-4xl">
            Choose To Install
          </h1>
          <p className="mt-3 font-sans text-sm text-muted-foreground sm:text-base">
            Select an available protocol to continue.
          </p>

          <div className="mt-8 grid gap-3">
            <a
              href={`${import.meta.env.BASE_URL}api/cocox-sign-profile`}
              onClick={() => setShortcutRequested(true)}
              data-testid="link-cocox-sign"
              className="block w-full border border-primary/50 bg-primary/5 px-5 py-4 font-display text-sm font-bold uppercase tracking-[0.18em] text-primary transition-all hover:scale-[1.02] hover:bg-primary/15 active:scale-[0.98]"
            >
              [ COCOX SIGN ]
            </a>
            {shortcutRequested && (
              <p role="status" className="text-xs leading-relaxed text-primary">
                On iPhone or iPad: tap Allow, then open Settings → Profile Downloaded → Install.
                iOS requires your approval to add the shortcut.
              </p>
            )}
            <DeltaV2InstallButton />
            <motion.button
              type="button"
              onClick={() => handleComingSoon("K")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full border border-primary/50 bg-primary/5 px-5 py-4 font-display text-sm font-bold uppercase tracking-[0.18em] text-primary transition-colors hover:bg-primary/15"
            >
              [ K SIGN SOON ]
            </motion.button>
            <motion.button
              type="button"
              onClick={() => setShowLauncher(false)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full border border-primary bg-primary px-5 py-4 font-display text-sm font-bold uppercase tracking-[0.18em] text-black transition-colors hover:bg-white"
            >
              [ DELTA EXECUTOR ]
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (showInstallPrompt) {
    return (
      <div className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center overflow-hidden bg-[#050d1a] px-6 text-center">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `repeating-linear-gradient(rgba(255,122,0,0.08) 0 1px, transparent 1px 100%), repeating-linear-gradient(90deg, rgba(255,122,0,0.08) 0 1px, transparent 1px 100%)`,
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[130px]" />
        <div className="absolute right-4 top-4 z-10 text-right font-display text-[9px] font-bold uppercase leading-relaxed tracking-[0.16em] text-primary/80 sm:right-8 sm:top-6 sm:text-xs">
          <div>K SIGN IS COMING SOON</div>
          <div>COCOX SIGN IS AVAILABLE</div>
        </div>

        <div className="relative z-10 w-full max-w-xl border border-primary/30 bg-black/50 p-8 shadow-[0_0_40px_rgba(255,122,0,0.12)] sm:p-12">
          <div className="mb-4 font-display text-xs tracking-[0.3em] text-primary">
            [ DELTA INSTALLATION PROTOCOL ]
          </div>
          <div className="mt-5 font-display text-sm font-bold uppercase tracking-[0.2em] text-primary">
            [ {deltaInstallData?.count ?? 0} PEOPLE PRESSED YES ]
          </div>
          <h1 className="mt-4 font-display text-3xl font-black uppercase tracking-tight text-white sm:text-5xl">
            Do You WAnt to Install Delta
          </h1>
          <p className="mt-5 font-sans text-base text-muted-foreground sm:text-lg">
            Choose an option to continue.
          </p>

          <div className="mt-9 flex flex-col justify-center gap-4 sm:flex-row">
            <a
              href="itms-services://?action=download-manifest&url=https%3A%2F%2Fcocox.wtf%2Fmanifest.plist"
              onClick={handleDeltaInstall}
              className="w-full border border-primary bg-primary/10 px-8 py-4 font-display font-bold uppercase tracking-[0.2em] text-primary transition-all hover:bg-primary hover:text-black hover:shadow-[0_0_30px_rgba(255,122,0,0.6)] sm:w-auto"
            >
              [ YES ]
            </a>
            <button
              type="button"
              onClick={() => setShowInstallPrompt(false)}
              className="w-full border border-white/20 bg-transparent px-8 py-4 font-display font-bold uppercase tracking-[0.2em] text-white transition-colors hover:border-primary hover:text-primary sm:w-auto"
            >
              [ NO ]
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent flex flex-col w-full relative">
      {/* Particle field */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-primary rounded-full shadow-[0_0_5px_rgba(255,122,0,0.8)]"
            initial={{
              x:
                Math.random() *
                (typeof window !== "undefined" ? window.innerWidth : 1000),
              y:
                Math.random() *
                (typeof window !== "undefined" ? window.innerHeight : 1000),
              opacity: Math.random() * 0.5 + 0.1,
            }}
            animate={{
              y: [null, Math.random() * -200],
              opacity: [null, 0],
            }}
            transition={{
              duration: Math.random() * 10 + 10,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}
      </div>

      {/* Hero Section */}
      <section className="relative pt-24 pb-32 px-4 overflow-hidden z-10">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[150px] pointer-events-none" />

        {/* Faint circuit board SVG pattern */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 10 L90 10 L90 90 L10 90 Z' stroke='%23ff7a00' stroke-width='0.5' fill='none' /%3E%3Cpath d='M30 30 L70 30 L70 70 L30 70 Z' stroke='%23ff7a00' stroke-width='0.5' fill='none' /%3E%3C/svg%3E")`,
            backgroundSize: "100px 100px",
          }}
        ></div>

        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1
              className="font-display font-black text-white leading-none tracking-tighter"
              style={{ fontSize: "clamp(3rem, 8vw, 7rem)" }}
            >
              UNLOCK THE
              <br />
              <span className="text-primary drop-shadow-[0_0_30px_rgba(255,122,0,0.6)] glitch inline-block relative">
                IMPOSSIBLE
                <span className="absolute top-0 left-0 -ml-[2px] text-primary opacity-50 clip-half-1">
                  IMPOSSIBLE
                </span>
                <span className="absolute top-0 left-0 ml-[2px] text-primary opacity-50 clip-half-2">
                  IMPOSSIBLE
                </span>
              </span>
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-sans"
          >
            {"> "} CocoX Scripts and Moza Scripts with fast delivery and
            responsive support.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/products"
              className="w-full sm:w-auto bg-primary/10 border border-primary text-primary hover:bg-primary hover:text-black font-display font-bold uppercase tracking-widest py-4 px-8 rounded-sm shadow-[0_0_20px_rgba(255,122,0,0.3)] hover:shadow-[0_0_30px_rgba(255,122,0,0.6)] transition-all flex justify-center items-center gap-2"
            >
              [ START MISSION ]
            </Link>
            <button
              onClick={() =>
                toast({
                  title: "CLIENT PORTAL",
                  description:
                    "Account access is not configured yet. You can continue as a guest from the catalog.",
                })
              }
              className="w-full sm:w-auto bg-transparent border border-white/20 hover:border-primary text-white font-display font-bold uppercase tracking-widest py-4 px-8 rounded-sm transition-colors flex justify-center items-center gap-2"
            >
              [ CLIENT PORTAL ↗ ]
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm font-display tracking-widest text-muted-foreground uppercase"
          >
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold">
                [● SYS: ONLINE]
              </span>
            </div>
            <div className="hidden sm:block text-primary/30">|</div>
            <div className="flex items-center gap-1.5">
              <span className="text-primary">[★ 100K+ USERS]</span>
            </div>
            <div className="hidden sm:block text-primary/30">|</div>
            <div className="flex items-center gap-1.5">
              <span className="text-primary">[⚡ INSTANT DELIVERY]</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-10 flex flex-col items-center justify-center gap-3 opacity-50 grayscale hover:grayscale-0 transition-all duration-300"
          >
            <div className="text-xs font-display tracking-widest text-primary mb-2">
              [ PAYMENT PROTOCOLS ]
            </div>
            <div className="flex items-center gap-3">
              <div className="border border-white/10 bg-black p-2 rounded-sm">
                <SiVisa className="h-6 w-auto text-white" />
              </div>
              <div className="border border-white/10 bg-black p-2 rounded-sm">
                <SiMastercard className="h-6 w-auto text-white" />
              </div>
              <div className="border border-white/10 bg-black p-2 rounded-sm">
                <SiBitcoin className="h-6 w-auto text-white" />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-24 px-4 bg-black/40 border-t border-primary/20 relative z-20">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-end mb-10 border-b border-primary/20 pb-4 relative">
            <div className="absolute bottom-0 left-0 w-32 h-[1px] bg-primary drop-shadow-[0_0_5px_rgba(255,122,0,0.8)]"></div>
            <div>
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-2 uppercase tracking-wider">
                <span className="text-primary mr-2">//</span>FEATURED SYSTEMS
              </h2>
              <p className="text-muted-foreground font-sans">
                {">"} The optimal tools for execution.
              </p>
            </div>
            <Link
              href="/products"
              className="hidden sm:flex text-primary font-display text-sm tracking-widest hover:text-white transition-colors items-center gap-1"
            >
              [ VIEW ALL ↗ ]
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <div className="mt-8 sm:hidden">
            <Link
              href="/products"
              className="block w-full border border-primary/30 text-center py-3 rounded-sm text-primary font-display tracking-widest hover:bg-primary/10 transition-colors uppercase"
            >
              [ VIEW ALL ]
            </Link>
          </div>
        </div>
      </section>

      {/* Trust & Stats */}
      <section className="py-24 px-4 relative z-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="relative bg-card border border-primary/20 p-8 rounded-none flex flex-col items-center text-center hover:border-primary/50 transition-colors group overflow-hidden">
              <div className="corner-tl"></div>
              <div className="corner-tr"></div>
              <div className="corner-bl"></div>
              <div className="corner-br"></div>
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="w-12 h-12 border border-primary/30 bg-black text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10 shadow-[0_0_15px_rgba(255,122,0,0.2)]">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="text-3xl font-display font-bold text-white mb-1 relative z-10">
                100K+
              </div>
              <div className="text-sm font-sans font-bold uppercase tracking-widest text-primary relative z-10">
                ACTIVE USERS
              </div>
            </div>

            <div className="relative bg-card border border-primary/20 p-8 rounded-none flex flex-col items-center text-center hover:border-primary/50 transition-colors group overflow-hidden">
              <div className="corner-tl"></div>
              <div className="corner-tr"></div>
              <div className="corner-bl"></div>
              <div className="corner-br"></div>
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="w-12 h-12 border border-primary/30 bg-black text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10 shadow-[0_0_15px_rgba(255,122,0,0.2)]">
                <Zap className="h-6 w-6" />
              </div>
              <div className="text-3xl font-display font-bold text-white mb-1 relative z-10">
                50+
              </div>
              <div className="text-sm font-sans font-bold uppercase tracking-widest text-primary relative z-10">
                SYSTEMS
              </div>
            </div>

            <div className="relative bg-card border border-primary/20 p-8 rounded-none flex flex-col items-center text-center hover:border-primary/50 transition-colors group overflow-hidden">
              <div className="corner-tl"></div>
              <div className="corner-tr"></div>
              <div className="corner-bl"></div>
              <div className="corner-br"></div>
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="w-12 h-12 border border-primary/30 bg-black text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10 shadow-[0_0_15px_rgba(255,122,0,0.2)]">
                <Clock className="h-6 w-6" />
              </div>
              <div className="text-3xl font-display font-bold text-white mb-1 relative z-10">
                INSTANT
              </div>
              <div className="text-sm font-sans font-bold uppercase tracking-widest text-primary relative z-10">
                DEPLOYMENT
              </div>
            </div>

            <div className="relative bg-card border border-primary/20 p-8 rounded-none flex flex-col items-center text-center hover:border-primary/50 transition-colors group overflow-hidden">
              <div className="corner-tl"></div>
              <div className="corner-tr"></div>
              <div className="corner-bl"></div>
              <div className="corner-br"></div>
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="w-12 h-12 border border-primary/30 bg-black text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10 shadow-[0_0_15px_rgba(255,122,0,0.2)]">
                <HeadphonesIcon className="h-6 w-6" />
              </div>
              <div className="text-3xl font-display font-bold text-white mb-1 relative z-10">
                24/7
              </div>
              <div className="text-sm font-sans font-bold uppercase tracking-widest text-primary relative z-10">
                SUPPORT COMM
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
