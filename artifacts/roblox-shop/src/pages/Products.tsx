import { useState } from "react";
import { products } from "@/data/products";
import { ProductCard } from "@/components/ui/ProductCard";
import { Search } from "lucide-react";

type FilterTab = "All" | "Scripts";

export default function Products() {
  const [activeTab, setActiveTab] = useState<FilterTab>("All");
  const [searchQuery, setSearchQuery] = useState("");

  const tabs: FilterTab[] = ["All", "Scripts"];

  const filteredProducts = products.filter((product) => {
    // Basic category filtering logic based on name for this mock
    if (activeTab === "Scripts" && !product.name.toLowerCase().includes("script")) return false;
    
    // Search filtering
    if (searchQuery && !product.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    
    return true;
  });

  return (
    <div className="min-h-screen bg-transparent w-full py-12 px-4 relative">
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="mb-10 border-b border-primary/20 pb-6 relative">
          <div className="absolute bottom-0 left-0 w-48 h-[1px] bg-primary drop-shadow-[0_0_5px_rgba(255,122,0,0.8)]"></div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-4 uppercase tracking-widest">
            <span className="text-primary mr-3">//</span>PRODUCT CATALOG
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl font-sans">
             {"> "} Browse CocoX Scripts and Moza Scripts with fast delivery and responsive support.
            All purchases include instant delivery to your email.
          </p>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex overflow-x-auto pb-2 md:pb-0 w-full md:w-auto hide-scrollbar gap-3">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 text-xs font-display font-bold uppercase tracking-widest whitespace-nowrap transition-all border ${
                  activeTab === tab 
                    ? "bg-primary/10 border-primary text-primary shadow-[0_4px_15px_-3px_rgba(255,122,0,0.3)]" 
                    : "bg-black border-primary/30 text-muted-foreground hover:text-primary hover:border-primary/60"
                }`}
              >
                [ {tab} ]
              </button>
            ))}
          </div>
          
          <div className="relative w-full md:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none font-display text-primary font-bold">
              {">"}
            </div>
            <input
              type="text"
              placeholder="SEARCH SYSTEMS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-8 pr-10 py-2.5 bg-black border border-primary/30 rounded-none text-xs font-display tracking-widest text-primary placeholder-primary/40 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors uppercase"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-primary/50" />
            </div>
          </div>
        </div>

        {/* Product Grid */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center border border-primary border-dashed rounded-none bg-primary/5 relative">
            <div className="corner-tl"></div><div className="corner-tr"></div><div className="corner-bl"></div><div className="corner-br"></div>
            <h3 className="text-xl font-display font-bold text-primary mb-2 uppercase tracking-widest">// NO SYSTEMS FOUND</h3>
            <p className="text-muted-foreground font-sans">Try adjusting your search parameters.</p>
            <button 
              onClick={() => { setActiveTab("All"); setSearchQuery(""); }}
              className="mt-6 border border-primary/50 text-primary font-display text-xs tracking-widest px-4 py-2 hover:bg-primary/10 transition-colors uppercase"
            >
              [ RESET FILTERS ]
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
