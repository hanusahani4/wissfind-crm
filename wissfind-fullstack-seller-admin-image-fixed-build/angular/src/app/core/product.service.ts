import { Injectable, signal } from '@angular/core';
import { BackendApiService } from './backend-api.service';
import { Product } from './product.model';

@Injectable({providedIn:'root'})
export class ProductService {
  readonly products: Product[] = [];
  readonly productsVersion = signal(0);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  private loadedInternal = false;
  private loadingInternal = false;
  private readonly cachePrefix = 'wissfind-product-cache:';
  private readonly cacheTtlMs = 10 * 60 * 1000;
  private refreshTimer?: number;
  private refreshStarted = false;

  constructor(private api: BackendApiService) {
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => this.refreshIfVisible());
      document.addEventListener('visibilitychange', () => this.refreshIfVisible());
    }
  }

  async load(signal?: AbortSignal): Promise<void> {
    if (this.loadedInternal || this.loadingInternal) return;
    this.loadingInternal = true;
    this.loading.set(true);
    this.loaded.set(false);
    try {
      // Customer Home needs the complete customer-visible catalogue. This avoids
      // relying on the paged search query for initial catalogue visibility and
      // lets the Home component handle its own client-side pagination/filtering.
      const data:any = await this.api.get('/products', signal);
      const items = Array.isArray(data) ? data : (Array.isArray(data?.content) ? data.content : []);
      const mapped = items.map((x:any) => this.map(x));
      this.products.splice(0, this.products.length, ...mapped);
      this.productsVersion.update(v => v + 1);
      mapped.forEach((p: Product) => this.saveCachedProduct(p));
      this.loadedInternal = true;
      this.loadingInternal = false;
      this.loading.set(false);
      this.loaded.set(true);
      this.startAutoRefresh();
    } catch {
      if (signal?.aborted) {
        this.loadingInternal = false;
        this.loading.set(false);
        return;
      }
      this.products.splice(0, this.products.length);
      this.productsVersion.update(v => v + 1);
      this.loadingInternal = false;
      this.loading.set(false);
      this.loadedInternal = true;
      this.loaded.set(true);
      this.startAutoRefresh();
    }
  }

  private startAutoRefresh(): void {
    if (this.refreshStarted || typeof window === 'undefined') return;
    this.refreshStarted = true;
    this.refreshTimer = window.setInterval(() => this.refreshIfVisible(), 30000);
  }

  private refreshIfVisible(): void {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (this.loadingInternal) return;
    void this.reload();
  }

  async loadPage(page:number,size=8,search='',signal?:AbortSignal):Promise<{items:Product[];total:number;totalPages:number}> {
    try{
      const safePage=Math.max(0,page),safeSize=Math.min(24,Math.max(1,size));
      const data:any=await this.api.get(`/products/paged?page=${safePage}&size=${safeSize}`,signal);
      let items=Array.isArray(data?.content)?data.content.map((x:any)=>this.map(x)):[];
      const term=search.trim().toLowerCase();
      if(term)items=items.filter((p:Product)=>`${p.name} ${p.category} ${p.subcategory} ${p.brand}`.toLowerCase().includes(term));
      items.forEach((p:Product)=>this.saveCachedProduct(p));
      return {items,total:Number(data?.totalElements||0),totalPages:Math.max(1,Number(data?.totalPages||1))};
    }catch{return {items:[],total:0,totalPages:1};}
  }

  async reload():Promise<void>{this.loadedInternal=false;this.loadingInternal=false;this.loaded.set(false);this.loading.set(false);await this.load();}

  async getByIdAsync(id:string|number,signal?:AbortSignal):Promise<Product|undefined>{
    const productId=String(id);
    try{const data:any=await this.api.get(`/products/${encodeURIComponent(productId)}`,signal);const mapped=this.map(data);this.saveCachedProduct(mapped);const existing=this.products.find(x=>String(x.id)===productId);if(existing){Object.assign(existing,mapped);this.productsVersion.update(v=>v+1);return existing;}this.products.push(mapped);this.productsVersion.update(v=>v+1);return mapped;}
    catch{if(!signal?.aborted){try{await this.load(signal);}catch{}}return this.products.find(p=>String(p.id)===productId);}
  }

  getById(id:string|number):Product|undefined{
    const productId=String(id);
    const existing=this.products.find(p=>String(p.id)===productId);if(existing)return existing;
    if(productId){const cached=this.readCachedProduct(productId);if(cached){this.products.push(cached);return cached;}const placeholder:Product={id:productId,name:'',category:'Home & Living',subcategory:'',type:'',brand:'',gender:'',material:'',warranty:'',returnDays:7,weight:undefined,dimensions:'',hsnCode:'',taxIncluded:true,featured:false,gstPercent:0,shippingFee:0,platformFee:0,stock:0,price:0,oldPrice:undefined,rating:0,reviews:0,image:'',images:[],description:'',tags:[],colors:[],sizes:[]};this.products.push(placeholder);return placeholder;}return undefined;
  }

  async getByCategory(category:string):Promise<Product[]> {
    const target=String(category||'').trim().toLowerCase();
    if(!this.loadedInternal && !this.loadingInternal) await this.load();
    return this.products.filter(p=>String(p.category||'').trim().toLowerCase()===target);
  }

  async getRelated(category:string,excludeId:string|number):Promise<Product[]> {
    const target=String(category||'').trim().toLowerCase();
    const excluded=String(excludeId);
    if(!this.loadedInternal && !this.loadingInternal) await this.load();
    return this.products.filter(p=>String(p.id)!==excluded && String(p.category||'').trim().toLowerCase()===target);
  }

  private saveCachedProduct(product:Product){if(typeof localStorage==='undefined'||!product?.id)return;try{localStorage.setItem(this.cachePrefix+String(product.id),JSON.stringify({savedAt:Date.now(),product}));}catch{}}
  private readCachedProduct(id:string):Product|undefined{if(typeof localStorage==='undefined')return undefined;try{const raw=localStorage.getItem(this.cachePrefix+id);if(!raw)return undefined;const parsed=JSON.parse(raw);if(!parsed?.product||Date.now()-Number(parsed.savedAt||0)>this.cacheTtlMs){localStorage.removeItem(this.cachePrefix+id);return undefined;}return this.map(parsed.product);}catch{return undefined;}}
  private map(x:any):Product{const images=Array.isArray(x.images)?x.images:[];const normalized=images.map((u:string)=>this.absoluteUrl(u));const image=this.absoluteUrl(x.image||normalized[0]||'');return{id:String(x.id),name:x.name,seller:x.seller?{id:Number(x.seller.id),name:x.seller.name||'',phone:x.seller.phone||''}:undefined,category:x.category,subcategory:x.subcategory,type:x.type,brand:x.brand||'',gender:x.gender||'',material:x.material||'',warranty:x.warranty||'',returnDays:x.returnDays==null?7:Number(x.returnDays),weight:x.weight==null?undefined:Number(x.weight),dimensions:x.dimensions||'',hsnCode:x.hsnCode||'',taxIncluded:x.taxIncluded!==false,featured:!!x.featured,gstPercent:Number(x.gstPercent||0),shippingFee:Number(x.shippingFee||0),platformFee:Number(x.platformFee||0),stock:Number(x.stock||0),price:Number(x.price||0),oldPrice:x.oldPrice==null?undefined:Number(x.oldPrice),rating:Number(x.rating||0),reviews:Number(x.reviews||0),image,images:normalized.length?normalized:(image?[image]:[]),description:x.description||'',tags:Array.isArray(x.tags)?x.tags:[],colors:Array.isArray(x.colors)?x.colors:[],sizes:Array.isArray(x.sizes)?x.sizes:[]};}
  private absoluteUrl(url:string){if(!url)return '';if(/^https?:\/\//i.test(url))return url;return `http://localhost:8080${url.startsWith('/')?'':'/'}${url}`;}
}
