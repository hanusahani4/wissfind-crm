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
        const rawItems = Array.isArray(rows) ? rows : Array.isArray(rows?.content) ? rows.content : [];
        const items = rawItems
          .map((row: any) => this.normalize(row))
          .filter((item: WishlistProduct | null): item is WishlistProduct => !!item && Number.isFinite(item.id) && item.id > 0);
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

  private normalize(row: any): WishlistProduct | null {
    const value = row?.product ?? row?.wishlistProduct ?? row;
    const id = Number(value?.id ?? value?.productId ?? row?.productId);
    if (!Number.isFinite(id) || id <= 0) return null;
    const images = Array.isArray(value?.images) ? value.images : [];
    const image = value?.image || value?.imageUrl || images[0] || row?.image || row?.imageUrl || '';
    return {
      id,
      name: String(value?.name ?? row?.name ?? ''),
      category: String(value?.category ?? row?.category ?? ''),
      subcategory: value?.subcategory ?? row?.subcategory ?? '',
      price: Number(value?.price ?? row?.price ?? 0),
      oldPrice: Number(value?.oldPrice ?? row?.oldPrice ?? 0),
      salePrice: value?.salePrice ?? row?.salePrice ?? null,
      image,
      stock: Math.max(0, Number(value?.stock ?? row?.stock ?? 0)),
      rating: Number(value?.rating ?? row?.rating ?? 0),
      reviews: Number(value?.reviews ?? row?.reviews ?? 0)
    };
  }

  isWishlisted(productId: string | number): boolean {
    return this.items().some(item => String(item.id) === String(productId));
  }

  async add(productId: string | number): Promise<boolean> {
    try {
      await this.api.post('/wishlist/' + productId, {});
      if (!this.isWishlisted(productId)) {
        const rows: any = await this.api.get('/wishlist');
        const rawItems = Array.isArray(rows) ? rows : Array.isArray(rows?.content) ? rows.content : [];
        const items = rawItems
          .map((row: any) => this.normalize(row))
          .filter((item: WishlistProduct | null): item is WishlistProduct => !!item && Number.isFinite(item.id) && item.id > 0);
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
