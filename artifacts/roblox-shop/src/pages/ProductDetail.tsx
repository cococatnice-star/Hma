import { useState } from "react";
import { useParams, Link } from "wouter";
import { products, ProductVariant } from "@/data/products";
import { ChevronLeft, ChevronRight, ShoppingCart, Shield, Zap } from "lucide-react";
import { CheckoutModal } from "@/components/ui/CheckoutModal";
import { useToast } from "@/hooks/use-toast";

export default function ProductDetail() {
  const params = useParams();
  const id = params.id;
  const product = products.find(p => p.id === id);
  
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<"SPECS" | "CAPABILITIES" | "FIELD REPORTS">("SPECS");
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<"website" | "robux">("website");
  const [imageIdx, setImageIdx] = useState(0);
  const { toast } = useToast();
  
  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-transparent">
        <h1 className="text-3xl font-display font-bold text-primary mb-4 uppercase tracking-widest">// SYSTEM NOT FOUND</h1>
        <Link href="/products" className="text-muted-foreground hover:text-primary transition-colors font-display tracking-widest uppercase text-sm">
          [ RETURN TO CATALOG ]
        </Link>
      </div>
    );
  }

  const selectedVariant = product.variants[selectedVariantIdx];
  const isScriptProduct = product.id === "cocox-scripts" || product.id === "moza-scripts";
  const isCocoxProduct = product.id === "cocox-scripts";

  const nextImage = () => setImageIdx((prev) => (prev === 0 ? 1 : 0));
  const prevImage = () => setImageIdx((prev) => (prev === 0 ? 1 : 0));

  return (
    <div className="min-h-screen bg-transparent w-full py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Breadcrumb */}
        <nav className="flex text-xs font-display tracking-widest text-muted-foreground mb-8 uppercase">
          <Link href="/products" className="hover:text-primary transition-colors">CATALOG</Link>
          <span className="mx-2 text-primary/50">{">"}</span>
          <span className="text-primary font-bold">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          {/* Left: Images */}
          <div className="space-y-4">
            <div className={`relative aspect-video rounded-none bg-black border border-primary/30 overflow-hidden group`}>
              <div className="corner-tl"></div><div className="corner-tr"></div><div className="corner-bl"></div><div className="corner-br"></div>
              
              <div className="absolute inset-0 bg-[repeating-linear-gradient(rgba(255,122,0,0.05)_0_1px,transparent_1px_4px)] pointer-events-none z-10 mix-blend-overlay"></div>

              {isCocoxProduct && imageIdx === 0 ? (
                <video
                  className="absolute inset-0 h-full w-full object-cover"
                  controls
                  muted
                  loop
                  playsInline
                  preload="metadata"
                >
                  <source
                    src={`${import.meta.env.BASE_URL}media/cocox-script-preview.mp4`}
                    type="video/mp4"
                  />
                  Your browser does not support embedded video.
                </video>
              ) : (
                <>
                  <div className="absolute inset-0 flex items-center justify-center opacity-20 transform -rotate-12 scale-150 pointer-events-none">
                    <span className="font-display font-black text-primary text-8xl uppercase tracking-tighter whitespace-nowrap blur-[2px]">
                      {product.name}
                    </span>
                  </div>

                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="relative z-10 font-display font-bold text-white text-4xl uppercase tracking-widest drop-shadow-[0_0_10px_rgba(255,122,0,0.8)]">
                      {product.name}
                    </span>
                  </div>
                </>
              )}
              
              {/* Fake carousel overlay indicators */}
              <div className="absolute inset-0 flex items-center justify-between p-4 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                <button onClick={prevImage} className="pointer-events-auto w-10 h-10 rounded-none bg-black/80 backdrop-blur border border-primary text-primary flex items-center justify-center hover:bg-primary/20 hover:shadow-[0_0_10px_rgba(255,122,0,0.5)] transition-all">
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button onClick={nextImage} className="pointer-events-auto w-10 h-10 rounded-none bg-black/80 backdrop-blur border border-primary text-primary flex items-center justify-center hover:bg-primary/20 hover:shadow-[0_0_10px_rgba(255,122,0,0.5)] transition-all">
                  <ChevronRight className="h-6 w-6" />
                </button>
              </div>
              
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-20">
                <div className={`w-3 h-1 ${imageIdx === 0 ? "bg-primary shadow-[0_0_5px_rgba(255,122,0,0.8)]" : "bg-primary/30"}`} />
                <div className={`w-3 h-1 ${imageIdx === 1 ? "bg-primary shadow-[0_0_5px_rgba(255,122,0,0.8)]" : "bg-primary/30"}`} />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div 
                onClick={() => setImageIdx(0)}
                className={`cursor-pointer aspect-video bg-black opacity-80 hover:opacity-100 transition-opacity border ${imageIdx === 0 ? "border-primary shadow-[0_0_10px_rgba(255,122,0,0.3)]" : "border-primary/20"} relative flex items-center justify-center`}
              >
                <div className="absolute inset-0 bg-[repeating-linear-gradient(rgba(255,122,0,0.05)_0_1px,transparent_1px_4px)] pointer-events-none"></div>
                 <span className="font-display font-bold text-white text-xl uppercase tracking-widest opacity-50">VIEW 1</span>
              </div>
              <div 
                onClick={() => setImageIdx(1)}
                className={`cursor-pointer aspect-video bg-black opacity-80 hover:opacity-100 transition-opacity border ${imageIdx === 1 ? "border-primary shadow-[0_0_10px_rgba(255,122,0,0.3)]" : "border-primary/20"} relative flex items-center justify-center`}
              >
                 <div className="absolute inset-0 bg-[repeating-linear-gradient(rgba(255,122,0,0.05)_0_1px,transparent_1px_4px)] pointer-events-none"></div>
                 <span className="font-display font-bold text-white text-xl uppercase tracking-widest opacity-50">VIEW 2</span>
              </div>
            </div>
          </div>

          {/* Right: Details */}
          <div className="flex flex-col">
            <div className="mb-4 flex items-center gap-2">
              <span className="bg-black border border-primary/50 text-primary text-[10px] font-display font-bold px-2 py-1 uppercase tracking-widest">
                [ {product.badge} ]
              </span>
              {product.bestDeal && (
                <span className="bg-primary/10 text-primary text-[10px] font-display font-bold px-2 py-1 border border-primary uppercase tracking-widest drop-shadow-[0_0_5px_rgba(255,122,0,0.8)]">
                  ⚡ HIGHEST CLEARANCE
                </span>
              )}
            </div>
            
            <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
              {product.name}
            </h1>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="flex text-primary drop-shadow-[0_0_3px_rgba(255,122,0,0.8)]">
                <span className="mx-0.5">◆</span>
                <span className="mx-0.5">◆</span>
                <span className="mx-0.5">◆</span>
                <span className="mx-0.5">◆</span>
                <span className="mx-0.5">◆</span>
              </div>
              <span className="text-xs font-display font-bold text-white tracking-widest">5.0</span>
              <span className="text-xs font-display text-muted-foreground tracking-widest">[ 25,560 REPORTS ]</span>
            </div>
            
            <div className="mb-8">
              <div className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-widest mb-1">UNIT COST:</div>
              <div className="text-4xl font-display font-bold text-primary drop-shadow-[0_0_15px_rgba(255,122,0,0.5)]">
                ${selectedVariant.price.toFixed(2)}
              </div>
            </div>
            
            <div className="space-y-4 mb-8">
              <h3 className="text-xs font-display font-bold text-primary uppercase tracking-widest border-b border-primary/20 pb-2">SELECT PARAMETERS</h3>
              <div className="grid gap-2">
                {product.variants.map((variant, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedVariantIdx(idx)}
                    className={`relative p-3 border text-left transition-all flex items-center gap-3 font-sans ${
                      selectedVariantIdx === idx 
                        ? "border-primary bg-primary/5 shadow-[0_0_15px_rgba(255,122,0,0.15)] text-primary"
                        : "border-primary/20 bg-black hover:border-primary/50 text-muted-foreground"
                    }`}
                  >
                    <div className="flex-shrink-0 text-primary">
                      {selectedVariantIdx === idx ? "◉" : "○"}
                    </div>
                    <span className="font-bold flex-1">
                      {variant.name}
                    </span>
                    <span className="font-bold opacity-30 px-2 tracking-widest flex-1 overflow-hidden">
                      .......................................
                    </span>
                    <span className={`font-display font-bold tracking-widest ${selectedVariantIdx === idx ? "text-primary" : "text-white"}`}>
                      ${variant.price.toFixed(2)}
                    </span>
                    {selectedVariantIdx === idx && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary shadow-[0_0_5px_rgba(255,122,0,0.8)]" />
                    )}
                  </button>
                ))}
              </div>
              
              {selectedVariant.inStock !== undefined ? (
                <div className="text-xs font-display font-bold tracking-widest text-emerald-400 flex items-center gap-1.5 uppercase mt-4">
                  <Zap className="h-4 w-4" /> [ {selectedVariant.inStock} NODES REMAINING ]
                </div>
              ) : (
                <div className="text-xs font-display font-bold tracking-widest text-emerald-400 flex items-center gap-1.5 uppercase mt-4">
                  <Shield className="h-4 w-4" /> [ SYSTEMS OPERATIONAL - INSTANT DELIVERY ]
                </div>
              )}
            </div>
            
            <div className="flex gap-4 mt-auto">
              <button 
                onClick={() => {
                  setCheckoutPaymentMethod("website");
                  setIsCheckoutOpen(true);
                }}
                className="flex-1 bg-primary/10 border border-primary hover:bg-primary hover:text-black text-primary font-display font-bold uppercase tracking-widest py-4 px-8 rounded-none shadow-[0_0_20px_rgba(255,122,0,0.2)] hover:shadow-[0_0_30px_rgba(255,122,0,0.6)] transition-all flex justify-center items-center gap-2 text-sm"
              >
                [ INITIATE PURCHASE ]
              </button>
               {isScriptProduct && (
                 <button
                   onClick={() => {
                     setCheckoutPaymentMethod("robux");
                     setIsCheckoutOpen(true);
                   }}
                   className="flex-1 bg-transparent border border-primary/60 hover:bg-primary/10 text-primary font-display font-bold uppercase tracking-widest py-4 px-5 rounded-none transition-all flex justify-center items-center gap-2 text-sm"
                 >
                   [ PAY WITH ROBUX ]
                 </button>
               )}
              <button
                onClick={() => toast({ title: "CART", description: `${selectedVariant.name} is ready for checkout.` })}
                aria-label="Add selected variant to cart"
                className="w-14 h-14 shrink-0 bg-black border border-primary/30 hover:border-primary hover:bg-primary/10 text-primary flex items-center justify-center transition-colors font-display text-xl"
              >
                [⊕]
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-primary/20 mb-8">
          <div className="flex gap-4 sm:gap-8 overflow-x-auto hide-scrollbar">
            {(["SPECS", "CAPABILITIES", "FIELD REPORTS"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`pb-3 text-xs font-display font-bold uppercase tracking-widest transition-colors relative whitespace-nowrap px-2 ${
                  activeTab === tab ? "text-primary" : "text-muted-foreground hover:text-white"
                }`}
              >
                [ {tab} ] {tab === "FIELD REPORTS" && "(25K+)"}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary shadow-[0_0_8px_rgba(255,122,0,0.8)]" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-[200px] text-muted-foreground font-sans">
          {activeTab === "SPECS" && (
            <div className="max-w-none">
              <p className="text-lg leading-relaxed text-white/80">{">"} {product.description}</p>
              <p className="mt-4">
                {">"} Purchasing grants instant authorization key access and entry to our encrypted comms channel.
                Our automated routing node ensures credentials arrive in milliseconds post-verification.
              </p>
              <h4 className="text-primary font-display font-bold mt-8 mb-4 uppercase tracking-widest border-b border-primary/20 inline-block pb-1">System Requirements</h4>
              <ul className="list-none space-y-2 text-white/70">
                <li><span className="text-primary mr-2">◈</span> Compatible with Windows OS builds</li>
                <li><span className="text-primary mr-2">◈</span> Instant automated delivery protocol</li>
                <li><span className="text-primary mr-2">◈</span> 24/7 dedicated support network</li>
                <li><span className="text-primary mr-2">◈</span> Over-the-air updates active</li>
              </ul>
            </div>
          )}
          {activeTab === "CAPABILITIES" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-black p-6 rounded-none border border-primary/20 relative">
                <div className="corner-tl"></div><div className="corner-br"></div>
                <h4 className="text-primary font-display font-bold mb-2 tracking-widest uppercase">Script Compatibility</h4>
                <p className="text-sm">Organized script access with a clean experience and reliable delivery.</p>
              </div>
              <div className="bg-black p-6 rounded-none border border-primary/20 relative">
                <div className="corner-tl"></div><div className="corner-br"></div>
                <h4 className="text-primary font-display font-bold mb-2 tracking-widest uppercase">Reliable Updates</h4>
                <p className="text-sm">Product updates and support are delivered through the store's support channels.</p>
              </div>
              <div className="bg-black p-6 rounded-none border border-primary/20 relative">
                <div className="corner-tl"></div><div className="corner-br"></div>
                <h4 className="text-primary font-display font-bold mb-2 tracking-widest uppercase">Clean User Interface</h4>
                <p className="text-sm">No bloated menus. A streamlined, terminal-grade interface that gets out of your way.</p>
              </div>
              <div className="bg-black p-6 rounded-none border border-primary/20 relative">
                <div className="corner-tl"></div><div className="corner-br"></div>
                <h4 className="text-primary font-display font-bold mb-2 tracking-widest uppercase">Script Hub Integration</h4>
                <p className="text-sm">Access thousands of pre-verified scripts directly from the built-in cloud matrix.</p>
              </div>
            </div>
          )}
          {activeTab === "FIELD REPORTS" && (
            <div className="space-y-6">
              {[
                { n: "DarkSlayer99", r: "5.0", d: "Instantly delivered and works perfectly. The support was also super fast when I had a question." },
                { n: "BloxGod_X", r: "5.0", d: "The scripts arrived quickly and the support was responsive." },
                { n: "AnonymousUser", r: "4.5", d: "Very good, though the UI could use a few more themes. Execution is flawless." },
              ].map((rev, i) => (
                <div key={i} className="bg-black p-5 rounded-none border border-primary/20 relative">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary/30"></div>
                  <div className="flex items-center justify-between mb-3 pl-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/10 border border-primary/50 text-primary flex items-center justify-center font-display font-bold text-xs" style={{clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)"}}>
                        {rev.n[0]}
                      </div>
                      <span className="font-display font-bold text-white tracking-widest">{rev.n}</span>
                    </div>
                    <div className="flex text-primary text-[10px] drop-shadow-[0_0_3px_rgba(255,122,0,0.8)]">
                      <span className="mx-0.5">◆</span>
                      <span className="mx-0.5">◆</span>
                      <span className="mx-0.5">◆</span>
                      <span className="mx-0.5">◆</span>
                      <span className="mx-0.5">◆</span>
                    </div>
                  </div>
                  <p className="text-sm pl-3 font-sans text-white/70">{">"} {rev.d}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <CheckoutModal 
        isOpen={isCheckoutOpen} 
        onClose={() => setIsCheckoutOpen(false)} 
        product={product}
        variant={selectedVariant}
        defaultPaymentMethod={checkoutPaymentMethod}
      />
    </div>
  );
}
