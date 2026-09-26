import { Injectable, signal } from '@angular/core';
import { BackendApiService } from './backend-api.service';

export interface WishlistProduct {
  id: number;
  name: string;
  category: string;
  subcategory?: string;
  price: number;
  oldPrice: number;
  salePrice?: number | null;
  image?: string;
  stock: number;
  rating: number;
  reviews: number;
}

@Injectable({ providedIn: 'root' })
export class WishlistService {
  readonly items = signal<WishlistProduct[]>([]);
  readonly count = signal(0);
  private loaded = false;
  private loading?: Promise<void>;

  constructor(private api: BackendApiService) {}

  async load(): Promise<void> {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        const rows: any = await this.api.get('/wishlist');
        const items = Array.isArray(rows) ? rows as WishlistProduct[] : [];
        this.items.set(items);
        this.count.set(items.length);
        this.loaded = true;
      } finally {
        this.loading = undefined;
      }
    })();
    return this.loading;
  }

  async loadCount(): Promise<void> {
    if (this.loaded) return;
    try {
      const data: any = await this.api.get('/wishlist/count');
      this.count.set(Number(data?.count || 0));
    } catch {}
  }

  isWishlisted(productId: string | number): boolean {
    return this.items().some(item => String(item.id) === String(productId));
  }

  async add(productId: string | number): Promise<boolean> {
    try {
      await this.api.post('/wishlist/' + productId, {});
      if (!this.isWishlisted(productId)) {
        const rows: any = await this.api.get('/wishlist');
        const items = Array.isArray(rows) ? rows as WishlistProduct[] : this.items();
        this.items.set(items);
        this.count.set(items.length);
      }
      return true;
    } catch {
      return false;
    }
  }

  async remove(productId: string | number): Promise<boolean> {
    try {
      await this.api.delete('/wishlist/' + productId);
      const next = this.items().filter(item => String(item.id) !== String(productId));
      this.items.set(next);
      this.count.set(next.length);
      return true;
    } catch {
      return false;
    }
  }

  async toggle(productId: string | number): Promise<boolean> {
    return this.isWishlisted(productId) ? this.remove(productId) : this.add(productId);
  }
}
