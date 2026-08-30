import { Injectable, signal } from '@angular/core';
import { BackendApiService } from './backend-api.service';
import { Product } from './product.model';

@Injectable({providedIn:'root'})
export class ProductService {
  readonly products: Product[] = [];
  /** Changes whenever the shared catalog array changes, so OnPush/zoneless views update immediately. */
  readonly productsVersion = signal(0);
  private loaded = false;

  constructor(private api: BackendApiService) {}

  async load(signal?: AbortSignal): Promise<void> {
    if (this.loaded) return;
    try {
      const data:any[] = await this.api.get('/products', signal);
      this.products.splice(0, this.products.length, ...data.map(x => this.map(x)));
      this.productsVersion.update(v => v + 1);
      this.loaded = true;
    } catch {
      // Navigation can abort this request. Do not clear data loaded by the next page.
      if (signal?.aborted) return;
      // Do not fall back to dummy products. The UI should show an empty catalog
      // when the real backend is unavailable.
      this.products.splice(0, this.products.length);
      this.productsVersion.update(v => v + 1);
    }
  }

  async loadPage(page: number, size = 10, search = '', signal?: AbortSignal): Promise<{items: Product[]; total: number; totalPages: number}> {
    try {
      const params = `page=${Math.max(0, page)}&size=${Math.min(50, Math.max(1, size))}&search=${encodeURIComponent(search)}`;
      const data: any = await this.api.get(`/products/paged?${params}`, signal);
      const items = Array.isArray(data?.content) ? data.content.map((x: any) => this.map(x)) : [];
      return { items, total: Number(data?.totalElements || 0), totalPages: Math.max(1, Number(data?.totalPages || 1)) };
    } catch {
      return { items: [], total: 0, totalPages: 1 };
    }
  }

  async reload(): Promise<void> {
    this.loaded=false;
    await this.load();
  }

  async getByIdAsync(id:string, signal?: AbortSignal): Promise<Product|undefined> {
    try {
      const data:any = await this.api.get(`/products/${encodeURIComponent(id)}`, signal);
      const product=this.map(data);
      const index=this.products.findIndex(x=>String(x.id)===String(id));
      if(index>=0) this.products[index]=product; else this.products.push(product);
      this.productsVersion.update(v => v + 1);
      return product;
    } catch {
      return this.products.find(p=>String(p.id)===String(id));
    }
  }

  getById(id:string) {
    return this.products.find(p=>String(p.id)===String(id));
  }

  private map(x:any):Product {
    const images = Array.isArray(x.images) ? x.images : [];
    const normalized = images.map((u:string)=>this.absoluteUrl(u));
    const image = this.absoluteUrl(x.image || normalized[0] || '');
    return {
      id:String(x.id),
      name:x.name,
      seller: x.seller ? { id: Number(x.seller.id), name: x.seller.name || '', phone: x.seller.phone || '' } : undefined,
      category:x.category,
      subcategory:x.subcategory,
      type:x.type,
      brand:x.brand||'',
      gender:x.gender||'',
      material:x.material||'',
      warranty:x.warranty||'',
      returnDays:x.returnDays==null?7:Number(x.returnDays),
      weight:x.weight==null?undefined:Number(x.weight),
      dimensions:x.dimensions||'',
      hsnCode:x.hsnCode||'',
      taxIncluded:x.taxIncluded!==false,
      featured:!!x.featured,
      gstPercent:Number(x.gstPercent||0),
      shippingFee:Number(x.shippingFee||0),
      platformFee:Number(x.platformFee||0),
      stock:Number(x.stock||0),
      price:Number(x.price||0),
      oldPrice:x.oldPrice==null?undefined:Number(x.oldPrice),
      rating:Number(x.rating||0),
      reviews:Number(x.reviews||0),
      image,
      images:normalized.length ? normalized : (image?[image]:[]),
      description:x.description||'',
      tags:Array.isArray(x.tags)?x.tags:[],
      colors:Array.isArray(x.colors)?x.colors:[],
      sizes:Array.isArray(x.sizes)?x.sizes:[]
    };
  }

  private absoluteUrl(url:string) {
    if(!url) return '';
    if(/^https?:\/\//i.test(url)) return url;
    return `http://localhost:8080${url.startsWith('/')?'':'/'}${url}`;
  }
}
