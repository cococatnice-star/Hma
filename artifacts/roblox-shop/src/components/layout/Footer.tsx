import { Zap } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full border-t border-primary/20 bg-[#050d1a] py-12 px-4 relative mt-auto">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary drop-shadow-[0_0_8px_rgba(255,122,0,0.8)]" />
            <span className="text-xl font-bold font-display tracking-tight text-white drop-shadow-[0_0_5px_rgba(255,122,0,0.5)]">MEOWCHEATZ</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-display tracking-widest text-emerald-400 mt-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse inline-block shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
            SYSTEM STATUS: OPERATIONAL
          </div>
        </div>
        
        <div className="flex gap-6 text-xs font-display tracking-widest uppercase text-muted-foreground">
          <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-primary transition-colors">Refunds</a>
          <a href="#" className="hover:text-primary transition-colors">Contact</a>
        </div>
        
        <div className="flex gap-4">
          <a href="#" className="text-muted-foreground hover:text-primary transition-colors text-xs font-display tracking-widest uppercase">
            Discord
          </a>
          <a href="#" className="text-muted-foreground hover:text-primary transition-colors text-xs font-display tracking-widest uppercase">
            Twitter
          </a>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-8 text-center text-xs font-display tracking-widest text-muted-foreground/50">
        // © 2026 MEOWCHEATZ SYSTEMS. ALL RIGHTS RESERVED. NOT AFFILIATED WITH ROBLOX CORPORATION.
      </div>
    </footer>
  );
}
