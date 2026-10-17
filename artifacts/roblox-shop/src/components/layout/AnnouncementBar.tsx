import { Link } from "wouter";

export function AnnouncementBar() {
  return (
    <div className="w-full bg-black text-primary font-display text-xs tracking-widest uppercase py-2 px-4 text-center border-b border-primary/30">
      // TRANSMISSION: ROBUX, FunPay & free keys —<span className="animate-pulse">_</span>{" "}
      <Link href="/products" className="hover:text-white transition-colors font-bold ml-2">
        [ ACCESS DISCORD ↗ ]
      </Link>
    </div>
  );
}
