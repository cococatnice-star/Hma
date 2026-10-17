import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const fakePurchases = [
  { name: "A***2", product: "Volt Executor", price: "$5.99", time: "just now" },
  { name: "D***4", product: "Wave Executor", price: "$2.49", time: "2m ago" },
  { name: "K***9", product: "Synapse Z", price: "$14.99", time: "5m ago" },
  { name: "X***1", product: "REAL Executor", price: "$24.99", time: "7m ago" },
  { name: "M***8", product: "Fluxus Monthly", price: "$4.99", time: "12m ago" },
  { name: "J***5", product: "Volt 90 Day", price: "$49.99", time: "15m ago" },
];

export function LivePurchaseNotification() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const cycle = () => {
      setIsVisible(true);
      setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => {
          setCurrentIdx((prev) => (prev + 1) % fakePurchases.length);
        }, 1000); // Wait for exit animation
      }, 5000); // Show for 5 seconds
    };

    // Initial delay before first show
    const timer = setTimeout(cycle, 3000);
    const intervalId = setInterval(cycle, 12000); // Cycle every 12 seconds

    return () => {
      clearTimeout(timer);
      clearInterval(intervalId);
    };
  }, []);

  const current = fakePurchases[currentIdx];

  return (
    <div className="fixed bottom-6 left-6 z-50 pointer-events-none">
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, x: -50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.9 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-72 bg-card border border-primary/30 shadow-[0_0_15px_rgba(255,122,0,0.15)] rounded-none p-3 flex gap-3 pointer-events-auto relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-primary shadow-[0_0_8px_rgba(255,122,0,0.8)]"></div>
            
            <div className="h-10 w-10 shrink-0 bg-primary/10 flex items-center justify-center text-primary font-display font-bold text-lg border border-primary/50 shadow-inner ml-2" style={{clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)"}}>
              {current.name[0]}
            </div>
            
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="text-[10px] font-display text-primary tracking-widest uppercase flex justify-between items-center mb-1">
                <span>[ TRANSACTION DETECTED ]</span>
                <span className="text-white/50">{current.time}</span>
              </div>
              <div className="text-sm font-display font-bold text-white truncate tracking-wider">{current.name} : {current.product}</div>
              <div className="text-xs text-primary font-display font-bold drop-shadow-[0_0_3px_rgba(255,122,0,0.5)] mt-0.5">{current.price}</div>
            </div>
            <button 
              onClick={() => setIsVisible(false)}
              className="absolute top-1 right-1 text-primary/50 hover:text-primary"
            >
              <X className="h-3 w-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
