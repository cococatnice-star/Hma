import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("cookieConsent");
    if (!dismissed) {
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("cookieConsent", "true");
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 right-6 z-50 w-80 bg-black border border-primary/30 shadow-[0_0_20px_rgba(255,122,0,0.1)] rounded-none p-5"
        >
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-primary"></div>
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-primary"></div>
          
          <h3 className="text-xs font-display font-bold text-primary mb-2 tracking-widest uppercase">[ DATA TRACKING NOTICE ]</h3>
          <p className="text-xs font-sans text-muted-foreground mb-4 leading-relaxed">
            {">"} By continuing to use this site, you agree to our use of tracking nodes for optimal telemetry routing.
          </p>
          <button
            onClick={handleDismiss}
            className="w-full bg-primary/10 border border-primary hover:bg-primary hover:text-black text-primary font-display text-[10px] font-bold py-2 rounded-none transition-all uppercase tracking-widest"
          >
            [ ACKNOWLEDGE ]
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
