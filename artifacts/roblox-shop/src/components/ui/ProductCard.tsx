import { Link } from "wouter";
import { products } from "@/data/products";

export function ProductCard({ product }: { product: typeof products[0] }) {
  return (
    <div className="group relative flex flex-col bg-card rounded-none border border-primary/20 overflow-hidden transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_20px_rgba(255,122,0,0.15)]">
      {/* Corner Brackets */}
      <div className="corner-tl"></div><div className="corner-tr"></div><div className="corner-bl"></div><div className="corner-br"></div>
      
      {/* Inner glow */}
      <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(255,122,0,0.04)] pointer-events-none group-hover:shadow-[inset_0_0_30px_rgba(255,122,0,0.1)] transition-shadow"></div>

      {/* Header Scanline Deco */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-[repeating-linear-gradient(90deg,transparent,transparent_2px,rgba(255,122,0,0.3)_2px,rgba(255,122,0,0.3)_4px)] z-10"></div>

      {/* Thumbnail area */}
      <div className={`relative h-48 w-full bg-gradient-to-br from-black to-secondary border-b border-primary/20 overflow-hidden flex items-center justify-center`}>
        {/* Scanline overlay */}
        <div className="absolute inset-0 bg-[repeating-linear-gradient(rgba(255,122,0,0.05)_0_1px,transparent_1px_4px)] pointer-events-none z-10 mix-blend-overlay"></div>
        
        {/* Abstract watermark / text */}
        <div className="absolute inset-0 flex items-center justify-center opacity-30 transform -rotate-12 scale-150 pointer-events-none">
          <span className="font-display font-black text-primary text-6xl uppercase tracking-tighter whitespace-nowrap blur-[2px]">
            {product.name}
          </span>
        </div>
        
        <span className="relative z-10 font-display font-bold text-white text-2xl uppercase tracking-widest drop-shadow-[0_0_10px_rgba(255,122,0,0.8)]">
          {product.name}
        </span>
        
        {/* Badges */}
        <div className="absolute top-4 left-4 z-20">
          <span className="bg-black/80 backdrop-blur-md text-primary text-[10px] font-display font-bold px-2 py-1 border border-primary/50 uppercase tracking-widest">
            [ {product.badge} ]
          </span>
        </div>
        
        {product.bestDeal && (
          <div className="absolute top-4 right-4 z-20">
            <span className="text-primary text-[10px] font-display font-bold px-2 py-1 drop-shadow-[0_0_5px_rgba(255,122,0,0.8)] uppercase tracking-widest">
              ⚡ BEST DEAL
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1 relative z-10 bg-black/40">
        <h3 className="text-xl font-display font-bold text-white mb-1 group-hover:text-primary transition-colors tracking-wide">
          {product.name}
        </h3>
        <p className="text-sm text-muted-foreground font-sans line-clamp-2 mb-4 flex-1">
          {product.description}
        </p>
        
        <div className="flex items-center justify-between mt-auto">
          <div className="flex flex-col">
            <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-widest">UNIT COST:</span>
            <span className="text-lg font-display font-bold text-primary drop-shadow-[0_0_5px_rgba(255,122,0,0.5)]">
              {">"} ${product.price.toFixed(2)}
            </span>
          </div>
          <Link href={`/products/${product.id}`} className="border border-primary text-primary hover:bg-primary/20 hover:shadow-[0_0_10px_rgba(255,122,0,0.3)] font-display text-xs font-bold py-2 px-4 rounded-none transition-all tracking-widest uppercase" data-testid={`link-view-${product.id}`}>
            [ INSPECT ↗ ]
          </Link>
        </div>
      </div>
    </div>
  );
}
