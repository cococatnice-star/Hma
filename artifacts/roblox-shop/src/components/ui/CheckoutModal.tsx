import { X, Mail } from "lucide-react";
import { SiRoblox as RobloxIcon } from "react-icons/si";
import { motion, AnimatePresence } from "framer-motion";
import { Product, ProductVariant } from "@/data/products";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  variant: ProductVariant;
  defaultPaymentMethod?: "website" | "robux";
}

export function CheckoutModal({
  isOpen,
  onClose,
  product,
  variant,
  defaultPaymentMethod = "website",
}: CheckoutModalProps) {
  const [email, setEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"website" | "robux">(
    defaultPaymentMethod,
  );
  const { toast } = useToast();
  const isScriptProduct =
    product.id === "cocox-scripts" || product.id === "moza-scripts";
  const discordInviteUrl = import.meta.env.VITE_DISCORD_INVITE_URL as
    | string
    | undefined;

  useEffect(() => {
    if (isOpen) {
      setPaymentMethod(defaultPaymentMethod);
    }
  }, [defaultPaymentMethod, isOpen]);

  const handlePayment = () => {
    if (!email || !email.includes("@")) {
      toast({ title: "EMAIL REQUIRED", description: "Enter a valid operator email before continuing." });
      return;
    }
    toast({ title: "PAYMENT NOT CONNECTED", description: "The checkout preview is ready, but no payment provider is connected yet." });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#050d1a]/90 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-md bg-card border border-primary/30 shadow-[0_0_30px_rgba(255,122,0,0.15)] rounded-none overflow-hidden"
          >
            <div className="corner-tl"></div><div className="corner-tr"></div><div className="corner-bl"></div><div className="corner-br"></div>
            
            <div className="absolute top-0 left-0 right-0 h-1 bg-[repeating-linear-gradient(90deg,transparent,transparent_2px,rgba(255,122,0,0.5)_2px,rgba(255,122,0,0.5)_4px)]"></div>

            <div className="flex justify-between items-center p-4 border-b border-primary/20 bg-black/50 pt-6">
              <h2 className="text-sm font-display font-bold text-primary tracking-widest uppercase">// CHECKOUT SEQUENCE</h2>
              <button
                onClick={onClose}
                className="text-primary hover:text-white transition-colors border border-transparent hover:border-primary/50 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6">
              {/* Product Summary */}
              <div className="flex items-center gap-4 mb-6 p-3 bg-black border-l-2 border-primary relative group">
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className={`w-12 h-12 bg-black border border-primary/20 flex items-center justify-center overflow-hidden`}>
                  <span className="font-display font-black text-primary/30 -rotate-12 text-[10px] uppercase blur-[0.5px]">{product.name.split(' ')[0]}</span>
                </div>
                <div className="flex-1 relative z-10">
                  <h3 className="text-sm font-display font-bold text-white tracking-wider">{product.name}</h3>
                  <p className="text-xs text-primary font-sans">{variant.name}</p>
                </div>
                <div className="text-primary font-display font-bold relative z-10 drop-shadow-[0_0_5px_rgba(255,122,0,0.5)]">
                  ${variant.price.toFixed(2)}
                </div>
              </div>

               {isScriptProduct ? (
                 <div className="grid grid-cols-2 gap-2 mb-6">
                   <button
                     type="button"
                     onClick={() => setPaymentMethod("website")}
                     className={`border py-3 px-2 text-[10px] font-display font-bold tracking-widest uppercase transition-colors ${
                       paymentMethod === "website"
                         ? "border-primary bg-primary/10 text-primary"
                         : "border-primary/20 text-muted-foreground hover:border-primary/60"
                     }`}
                   >
                     [ WEBSITE PAYMENT ]
                   </button>
                   <button
                     type="button"
                     onClick={() => setPaymentMethod("robux")}
                     className={`border py-3 px-2 text-[10px] font-display font-bold tracking-widest uppercase transition-colors ${
                       paymentMethod === "robux"
                         ? "border-primary bg-primary/10 text-primary"
                         : "border-primary/20 text-muted-foreground hover:border-primary/60"
                     }`}
                   >
                     [ PAY WITH ROBUX ]
                   </button>
                 </div>
               ) : null}

               {paymentMethod === "website" || !isScriptProduct ? (
                 <div className="space-y-4 mb-6">
                   <div>
                     <label className="block text-xs font-display font-bold tracking-widest text-primary mb-2">
                       {">"} OPERATOR EMAIL:
                     </label>
                     <div className="relative">
                       <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                         <Mail className="h-4 w-4 text-primary/50" />
                       </div>
                       <input
                         type="email"
                         placeholder="ENTER_ADDRESS"
                         value={email}
                         onChange={(event) => setEmail(event.target.value)}
                         className="block w-full pl-10 pr-3 py-2.5 bg-black border border-primary/30 rounded-none text-sm font-sans text-white placeholder-primary/30 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors uppercase tracking-wider"
                       />
                     </div>
                     <p className="text-[10px] font-sans text-muted-foreground mt-2 uppercase tracking-widest">
                       Receipt and product access sent here
                     </p>
                   </div>

                   <button
                     onClick={handlePayment}
                      className="w-full bg-primary/10 border border-primary hover:bg-primary hover:text-black text-primary font-display font-bold py-3 px-4 rounded-none shadow-[0_0_15px_rgba(255,122,0,0.2)] transition-all flex justify-center items-center gap-2 text-sm tracking-widest uppercase mt-4"
                   >
                     [ PROCEED TO PAYMENT → ]
                   </button>
                 </div>
               ) : (
                 <div className="rounded-none border border-primary/20 bg-black p-4 relative mb-6">
                   <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-primary/50"></div>
                   <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-primary/50"></div>

                   <div className="flex items-center gap-2 mb-3">
                     <RobloxIcon className="text-white h-5 w-5" />
                     <span className="text-xs font-display font-bold tracking-widest text-primary uppercase">
                       [ ROBUX PAYMENT ]
                     </span>
                   </div>
                   <p className="text-sm font-sans text-white/80 mb-4">
                     To buy {product.name} with Robux, join our Discord server and
                     follow the purchase instructions there.
                   </p>
                   <ol className="text-xs font-sans text-white/70 space-y-2 mb-4 list-decimal list-inside marker:text-primary">
                     <li>Join the Discord server</li>
                     <li>Open the CocoX or Moza purchase channel</li>
                     <li>Follow the Robux payment instructions</li>
                   </ol>
                   {discordInviteUrl ? (
                     <a
                       href={discordInviteUrl}
                       target="_blank"
                       rel="noreferrer"
                       className="block w-full text-center bg-primary/10 border border-primary hover:bg-primary hover:text-black text-primary font-display text-xs tracking-widest py-3 px-4 rounded-none transition-colors uppercase"
                     >
                       [ JOIN DISCORD SERVER → ]
                     </a>
                   ) : (
                     <button
                       onClick={() =>
                         toast({
                           title: "DISCORD LINK NOT CONFIGURED",
                           description:
                             "Add VITE_DISCORD_INVITE_URL to enable the server invite.",
                         })
                       }
                       className="w-full bg-transparent border border-primary/30 hover:border-primary text-primary font-display text-xs tracking-widest py-3 px-4 rounded-none transition-colors uppercase"
                     >
                       [ JOIN DISCORD SERVER → ]
                     </button>
                   )}
                 </div>
               )}
            </div>

            <div className="bg-primary/5 p-3 text-center border-t border-primary/20">
              <span className="text-[10px] font-display font-bold tracking-widest text-primary uppercase">
                // BONUS: FREE SPIN PER $25 SPENT
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
