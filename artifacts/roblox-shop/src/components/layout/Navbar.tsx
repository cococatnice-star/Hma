import { Link } from "wouter";
import { Zap, Search, ShoppingCart, Calendar, Bell, User } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export function Navbar() {
  const [onlineCount, setOnlineCount] = useState(40);
  const [accountOpen, setAccountOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const interval = setInterval(() => {
      setOnlineCount((prev) => {
        const change = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
        const next = prev + change;
        return Math.max(35, Math.min(50, next));
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav className="sticky top-0 z-50 w-full backdrop-blur-md bg-[#050d1a]/80 border-b border-primary/30 shadow-[0_1px_15px_rgba(255,122,0,0.1)]">
      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-50 animate-pulse"></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Zap className="h-6 w-6 text-primary drop-shadow-[0_0_8px_rgba(255,122,0,0.8)]" />
              <span className="text-xl font-bold font-display tracking-tight text-white drop-shadow-[0_0_5px_rgba(255,122,0,0.5)]">MEOWCHEATZ</span>
            </Link>

            <div className="hidden md:flex items-center gap-6 text-xs font-display tracking-widest uppercase text-muted-foreground">
              <Link href="/" className="hover:text-primary transition-colors">Home</Link>
              <Link href="/products" className="hover:text-primary transition-colors">Products</Link>
              <Link href="/products" className="hidden 2xl:inline-flex hover:text-primary transition-colors">Referral</Link>
              <Link href="/products" className="hidden 2xl:flex items-center gap-1.5 hover:text-primary transition-colors">
                Partners
                <span className="text-primary animate-pulse font-bold">[NEW]</span>
              </Link>
              <Link href="/products" className="hidden 2xl:flex items-center gap-1.5 hover:text-primary transition-colors">
                Status
                <span className="text-emerald-400 font-bold">[ ONLINE ]</span>
              </Link>
              <Link href="/products" className="hidden 2xl:inline-flex hover:text-primary transition-colors">FunPay</Link>
              <Link href="/products" className="hidden 2xl:inline-flex hover:text-primary transition-colors">Scripts</Link>
            </div>
          </div>

          <div className="flex items-center gap-4 text-muted-foreground">
            <div className="hidden lg:flex flex-col items-end gap-0.5 border-r border-primary/20 pr-4 text-[9px] font-display font-bold uppercase leading-tight tracking-[0.16em] text-primary/80">
              <span>K SIGN IS COMING SOON</span>
              <a href={`${import.meta.env.BASE_URL}api/cocox-sign-profile`} className="hover:text-white transition-colors" title="Install the CocoX Sign Home Screen shortcut in Safari">COCOX SIGN IS AVAILABLE</a>
            </div>

            <div className="hidden lg:flex items-center gap-2 text-xs font-display tracking-widest uppercase px-3 py-1.5 border border-primary/20 bg-primary/5 text-primary">
              <span>◈ {onlineCount} NODES</span>
            </div>

            <button
              onClick={() => toast({ title: "SEARCH SYSTEMS", description: "Use the catalog search to find a product." })}
              className="hover:text-primary hover:drop-shadow-[0_0_5px_rgba(255,122,0,0.8)] transition-all"
              data-testid="button-search"
              aria-label="Open search"
            >
              <Search className="h-5 w-5" />
            </button>
            <button
              onClick={() => toast({ title: "CART EMPTY", description: "Add a system from the catalog to begin." })}
              className="relative hover:text-primary hover:drop-shadow-[0_0_5px_rgba(255,122,0,0.8)] transition-all"
              data-testid="button-cart"
              aria-label="Open cart"
            >
              <ShoppingCart className="h-5 w-5" />
              <span className="absolute -top-2 -right-2 bg-primary text-black font-display text-[10px] font-bold h-4 w-4 flex items-center justify-center border border-primary">
                0
              </span>
            </button>
            <button
              onClick={() => toast({ title: "SCHEDULE", description: "No upcoming events are scheduled." })}
              className="hover:text-primary hover:drop-shadow-[0_0_5px_rgba(255,122,0,0.8)] transition-all hidden sm:block"
              data-testid="button-calendar"
              aria-label="Open schedule"
            >
              <Calendar className="h-5 w-5" />
            </button>
            <button
              onClick={() => toast({ title: "NOTIFICATIONS", description: "You have no new notifications." })}
              className="hover:text-primary hover:drop-shadow-[0_0_5px_rgba(255,122,0,0.8)] transition-all hidden sm:block"
              data-testid="button-bell"
              aria-label="Open notifications"
            >
              <Bell className="h-5 w-5" />
            </button>
            
            <button
              onClick={() => setAccountOpen(true)}
              className="flex items-center justify-center gap-2 border border-primary text-primary hover:bg-primary/20 hover:shadow-[0_0_15px_rgba(255,122,0,0.3)] transition-all font-display text-xs tracking-widest uppercase px-3 py-2 ml-2 rounded-none"
              data-testid="button-account"
              aria-label="Open account portal"
            >
              <span className="hidden sm:inline">[ ACCOUNT ]</span>
              <User className="h-4 w-4 sm:hidden" />
            </button>
          </div>
        </div>
      </div>
      {accountOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            className="absolute inset-0 bg-[#050d1a]/90 backdrop-blur-sm"
            onClick={() => setAccountOpen(false)}
            aria-label="Close account portal"
          />
          <div className="relative w-full max-w-md border border-primary/40 bg-card p-6 shadow-[0_0_35px_rgba(255,122,0,0.2)]">
            <div className="corner-tl"></div><div className="corner-tr"></div><div className="corner-bl"></div><div className="corner-br"></div>
            <div className="flex items-center justify-between border-b border-primary/20 pb-4">
              <h2 className="font-display text-sm font-bold tracking-widest text-primary uppercase">// ACCOUNT PORTAL</h2>
              <button
                onClick={() => setAccountOpen(false)}
                className="text-primary hover:text-white"
                aria-label="Close account portal"
              >
                [ X ]
              </button>
            </div>
            <p className="py-6 text-sm leading-relaxed text-muted-foreground">
              Account access is not configured yet. Your catalog and checkout preview are available without signing in.
            </p>
            <button
              onClick={() => {
                setAccountOpen(false);
                toast({ title: "ACCOUNT ACCESS", description: "Sign-in will be available when account services are connected." });
              }}
              className="w-full border border-primary bg-primary/10 px-4 py-3 font-display text-xs font-bold tracking-widest text-primary uppercase transition-colors hover:bg-primary hover:text-black"
            >
              [ CONTINUE AS GUEST ]
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
