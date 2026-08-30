export type Category =
  | 'Fashion'
  | 'Electronics'
  | 'Home & Living'
  | 'Beauty'
  | 'Sports & Fitness'
  | 'Books & Stationery'
  | 'Grocery'
  | 'Travel';

export interface Product {
  id: string;
  name: string;
  category: Category;
  subcategory: string;
  type?: string;
  brand?: string;
  gender?: string;
  material?: string;
  warranty?: string;
  returnDays?: number;
  weight?: number;
  dimensions?: string;
  hsnCode?: string;
  taxIncluded?: boolean;
  featured?: boolean;
  gstPercent?: number;
  shippingFee?: number;
  platformFee?: number;
  stock?: number;
  price: number;
  oldPrice?: number;
  rating: number;
  reviews: number;
  image: string;
  images: string[];
  seller?: { id: number; name?: string; phone?: string };
  description: string;
  tags: string[];
  colors?: string[];
  sizes?: string[];
}