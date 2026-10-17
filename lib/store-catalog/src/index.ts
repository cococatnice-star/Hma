export type ProductVariant = {
  name: string;
  price: number;
  inStock?: number;
};

export type Product = {
  id: string;
  name: string;
  badge: "ONE-TIME" | "SUBSCRIPTION";
  price: number;
  bestDeal: boolean;
  description: string;
  gradient: string;
  accentColor: string;
  variants: ProductVariant[];
};

export const products: Product[] = [
  {
    id: "cocox-scripts",
    name: "CocoX Scripts",
    badge: "ONE-TIME",
    price: 5.99,
    bestDeal: false,
    description:
      "CocoX script packs with fast delivery and responsive support.",
    gradient: "from-purple-900 via-violet-800 to-indigo-900",
    accentColor: "#8B5CF6",
    variants: [
      { name: "CocoX 7 Day Scripts", price: 5.99 },
      { name: "CocoX 30 Day Scripts 🔥 SAVE 4$", price: 19.99 },
      { name: "CocoX 90 Day Scripts 🔥 SAVE 22$", price: 49.99, inStock: 5 },
    ],
  },
  {
    id: "moza-scripts",
    name: "Moza Scripts",
    badge: "ONE-TIME",
    price: 3.99,
    bestDeal: false,
    description:
      "Moza script packs for users who want simple, reliable access and quick delivery.",
    gradient: "from-emerald-900 via-green-800 to-teal-900",
    accentColor: "#10B981",
    variants: [
      { name: "Moza 7 Day Scripts", price: 3.99 },
      { name: "Moza 30 Day Scripts", price: 14.99 },
    ],
  },
];