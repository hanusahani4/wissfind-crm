import { Injectable, signal } from '@angular/core';
import { BackendApiService } from './backend-api.service';
import { Product } from './product.model';

@Injectable({providedIn:'root'})
export class ProductService {
  readonly products: Product[] = [];
  readonly productsVersion = signal(0);
  private loaded = false;
  private loading = false;

  constructor(private api: BackendApiService) {}

  async load(signal?: AbortSignal): Promise<void> {
    if (this.loaded || this.loading) return;
    this.loading = true;
    try {
      const pageSize = 8;
      const first:any = await this.api.get(`/products/paged?page=0&size=${pageSize}&search=`, signal);
      const firstItems = Array.isArray(first?.content) ? first.content.map((x:any) => this.map(x)) : [];
      this.products.splice(0, this.products.length, ...firstItems);
      this.productsVersion.update(v => v + 1);
      const totalPages = Math.max(1, Number(first?.totalPages || 1));
      if (totalPages > 1 && !signal?.aborted) {
        setTimeout(() => { void this.prefetchRemaining(totalPages, pageSize, signal); }, 250);
      } else {
        this.loaded = true;
        this.loading = false;
      }
    } catch {
      if (signal?.aborted) {
        this.loading = false;
        return;
      }
      this.products.splice(0, this.products.length);
      this.productsVersion.update(v => v + 1);
      this.loading = false;
    }
  }

  private async prefetchRemaining(totalPages:number, pageSize:number, signal?:AbortSignal): Promise<void> {
    const concurrency = 2;
    try {
      for (let start = 1; start < totalPages; start += concurrency) {
        if (signal?.aborted) return;
        const pages = Array.from({ length: Math.min(concurrency, totalPages - start) }, (_, offset) => start + offset);
        const results = await Promise.all(pages.map(page => this.api.get(`/products/paged?page=${page}&size=${pageSize}&search=`, signal)));
        const nextProducts:Product[] = [];
        for (const result of results) {
          if (Array.isArray((result as any)?.content)) nextProducts.push(...(result as any).content.map((x:any) => this.map(x)));
        }
        if (nextProducts.length) {
          this.products.push(...nextProducts);
          this.productsVersion.update(v => v + 1);
        }
      }
    } catch {
      // Keep pages already loaded.
    } finally {
      this.loaded = !signal?.aborted;
      this.loading = false;
    }
  }

  async loadPage(page: number, size = 8, search = '', signal?: AbortSignal): Promise<{items: Product[]; total: number; totalPages: number}> {
    try {
      const safePage = Math.max(0, page);
      const safeSize = Math.min(24, Math.max(1, size));
      const params = `page=${safePage}&size=${safeSize}&search=${encodeURIComponent(search.trim())}`;
      const data:any = await this.api.get(`/products/paged?${params}`, signal);
      const items = Array.isArray(data?.content) ? data.content.map((x:any) => this.map(x)) : [];
      return { items, total: Number(data?.totalElements || 0), totalPages: Math.max(1, Number(data?.totalPages || 1)) };
    } catch {
      return { items: [], total: 0, totalPages: 1 };
    }
  }

  async reload(): Promise<void> {
    this.loaded=false;
    this.loading=false;
    await this.load();
  }

  async getByIdAsync(id:string, signal?:AbortSignal): Promise<Product|undefined> {
    try {
      const data:any = await this.api.get(`/products/${encodeURIComponent(id)}`, signal);
      const product=this.map(data);
      const index=this.products.findIndex(x=>String(x.id)===String(id));
      if(index>=0) this.products[index]=product; else this.products.push(product);
      this.productsVersion.update(v => v + 1);
      return product;
    } catch {
      if (!signal?.aborted) {
        try { await this.load(signal); } catch { /* local fallback below */ }
      }
      return this.products.find(p=>String(p.id)===String(id));
    }
  }

  getById(id:string) { return this.products.find(p=>String(p.id)===String(id)); }

  private map(x:any):Product {
    const images = Array.isArray(x.images) ? x.images : [];
    const normalized = images.map((u:string)=>this.absoluteUrl(u));
    const image = this.absoluteUrl(x.image || normalized[0] || '');
    return {
      id:String(x.id), name:x.name,
      seller: x.seller ? { id: Number(x.seller.id), name: x.seller.name || '', phone: x.seller.phone || '' } : undefined,
      category:x.category, subcategory:x.subcategory, type:x.type,
      brand:x.brand||'', gender:x.gender||'', material:x.material||'', warranty:x.warranty||'',
      returnDays:x.returnDays==null?7:Number(x.returnDays), weight:x.weight==null?undefined:Number(x.weight), dimensions:x.dimensions||'', hsnCode:x.hsnCode||'',
      taxIncluded:x.taxIncluded!==false, featured:!!x.featured, gstPercent:Number(x.gstPercent||0), shippingFee:Number(x.shippingFee||0), platformFee:Number(x.platformFee||0), stock:Number(x.stock||0),
      price:Number(x.price||0), oldPrice:x.oldPrice==null?undefined:Number(x.oldPrice), rating:Number(x.rating||0), reviews:Number(x.reviews||0), image,
      images:normalized.length ? normalized : (image?[image]:[]), description:x.description||'', tags:Array.isArray(x.tags)?x.tags:[], colors:Array.isArray(x.colors)?x.colors:[], sizes:Array.isArray(x.sizes)?x.sizes:[]
    };
  }

  private absoluteUrl(url:string) {
    if(!url) return '';
    if(/^https?:\/\//i.test(url)) return url;
    return `http://localhost:8080${url.startsWith('/')?'':'/'}${url}`;
  }
}
