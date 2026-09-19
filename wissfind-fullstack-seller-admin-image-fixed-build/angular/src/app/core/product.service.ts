import { Injectable, signal } from '@angular/core';
import { BackendApiService } from './backend-api.service';
import { Product } from './product.model';

@Injectable({providedIn:'root'})
export class ProductService {
  readonly products: Product[] = [];
  readonly productsVersion = signal(0);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly catalogueTotal = signal(0);
  private loadedInternal = false;
  private loadingInternal = false;
  private readonly cachePrefix='wissfind-product-cache:v2:';
  private readonly homeCacheKey='wissfind-home-catalogue-v2';
  private readonly cacheTtlMs=10*60*1000;
  private refreshTimer?: number;
  private refreshStarted=false;
  private readonly homePages=new Set<number>();

  constructor(private api: BackendApiService) {
    this.hydrateHomeCache();
    if(typeof window!=='undefined'){
      window.addEventListener('focus',()=>this.refreshIfVisible());
      document.addEventListener('visibilitychange',()=>this.refreshIfVisible());
    }
  }

  async load(signal?:AbortSignal):Promise<void>{
    if(this.loadedInternal||this.loadingInternal)return;
    this.loadingInternal=true;this.loading.set(true);this.loaded.set(false);
    try{
      await this.loadHomePage(0,20,signal);
      this.loadedInternal=true;this.loadingInternal=false;this.loading.set(false);this.loaded.set(true);this.startAutoRefresh();
    }catch{
      if(signal?.aborted){this.loadingInternal=false;this.loading.set(false);return;}
      this.products.splice(0,this.products.length);this.productsVersion.update(v=>v+1);this.catalogueTotal.set(0);this.homePages.clear();
      this.loadedInternal=true;this.loadingInternal=false;this.loading.set(false);this.loaded.set(true);this.startAutoRefresh();
    }
  }

  async loadHomePage(page:number,size=20,signal?:AbortSignal):Promise<{items:Product[];total:number;totalPages:number}>{
    const safePage=Math.max(0,page),safeSize=Math.min(24,Math.max(1,size));
    if(this.homePages.has(safePage)){
      const total=this.catalogueTotal();
      return {items:this.products.slice(safePage*safeSize,(safePage+1)*safeSize),total,totalPages:Math.max(1,Math.ceil(total/safeSize))};
    }
    const data:any=await this.api.get(`/products/paged?page=${safePage}&size=${safeSize}`,signal);
    const items:Product[]=Array.isArray(data?.content)?data.content.map((x:any)=>this.map(x)):[];
    const total=Number(data?.totalElements||0);
    const totalPages=Math.max(1,Number(data?.totalPages||Math.ceil(total/safeSize)||1));
    if(safePage===0){this.products.splice(0,this.products.length);}
    const existing=new Set(this.products.map(p=>String(p.id)));
    for(const p of items){if(!existing.has(String(p.id))){this.products.push(p);existing.add(String(p.id));}else{const i=this.products.findIndex(x=>String(x.id)===String(p.id));if(i>=0)this.products[i]=p;}}
    this.homePages.add(safePage);this.catalogueTotal.set(total);this.productsVersion.update(v=>v+1);if(safePage===0)this.saveHomeCache();items.forEach((p:Product)=>this.saveCachedProduct(p));
    return {items,total,totalPages};
  }

  private startAutoRefresh(){if(this.refreshStarted||typeof window==='undefined')return;this.refreshStarted=true;this.refreshTimer=window.setInterval(()=>this.refreshIfVisible(),30000);}
  private refreshIfVisible(){if(typeof document!=='undefined'&&document.visibilityState==='hidden')return;if(this.loadingInternal)return;void this.reload();}

  async loadPage(page:number,size=8,search='',signal?:AbortSignal):Promise<{items:Product[];total:number;totalPages:number}>{
    try{const safePage=Math.max(0,page),safeSize=Math.min(24,Math.max(1,size));const data:any=await this.api.get(`/products/paged?page=${safePage}&size=${safeSize}`,signal);let items=Array.isArray(data?.content)?data.content.map((x:any)=>this.map(x)):[];const term=search.trim().toLowerCase();if(term)items=items.filter((p:Product)=>`${p.name} ${p.category} ${p.subcategory} ${p.brand}`.toLowerCase().includes(term));items.forEach((p:Product)=>this.saveCachedProduct(p));return{items,total:Number(data?.totalElements||0),totalPages:Math.max(1,Number(data?.totalPages||1))};}catch{return{items:[],total:0,totalPages:1};}
  }

  async reload(){this.loadedInternal=false;this.loadingInternal=false;this.loaded.set(false);this.loading.set(false);this.homePages.clear();this.catalogueTotal.set(0);await this.load();}
  async getByIdAsync(id:string|number,signal?:AbortSignal):Promise<Product|undefined>{
  const productId=String(id);
  let cached=this.products.find(x=>String(x.id)===productId);
  if(!cached) cached=this.readCachedProduct(productId);
  if(cached){
    const existing=this.products.find(x=>String(x.id)===productId);
    if(existing) Object.assign(existing,cached); else this.products.push(cached);
    this.productsVersion.update(v=>v+1);
    void this.refreshProduct(productId,signal).catch(()=>{});
    return cached;
  }
  try{return await this.refreshProduct(productId,signal);}
  catch{if(!signal?.aborted){try{await this.load(signal);}catch{}}return this.products.find(p=>String(p.id)===productId);}
}
  private async refreshProduct(productId:string,signal?:AbortSignal):Promise<Product>{
    const data:any=await this.api.get(`/products/${encodeURIComponent(productId)}`,signal);
    const mapped=this.map(data);this.saveCachedProduct(mapped);
    const existing=this.products.find(x=>String(x.id)===productId);
    if(existing) Object.assign(existing,mapped); else this.products.push(mapped);
    this.productsVersion.update(v=>v+1);return existing||mapped;
  }
  getById(id:string|number):Product|undefined{const productId=String(id);const existing=this.products.find(p=>String(p.id)===productId);if(existing)return existing;if(productId){const cached=this.readCachedProduct(productId);if(cached){this.products.push(cached);return cached;}const placeholder:Product={id:productId,name:'',category:'Home & Living',subcategory:'',type:'',brand:'',gender:'',material:'',warranty:'',returnDays:7,weight:undefined,dimensions:'',hsnCode:'',taxIncluded:true,featured:false,gstPercent:0,shippingFee:0,platformFee:0,stock:0,price:0,oldPrice:undefined,rating:0,reviews:0,image:'',images:[],description:'',tags:[],colors:[],sizes:[]};this.products.push(placeholder);return placeholder;}return undefined;}
  async getByCategory(category:string){const target=String(category||'').trim().toLowerCase();if(!this.loadedInternal&&!this.loadingInternal)await this.load();return this.products.filter(p=>String(p.category||'').trim().toLowerCase()===target);}
  async getRelated(category:string,excludeId:string|number){const target=String(category||'').trim().toLowerCase();const excluded=String(excludeId);if(!this.loadedInternal&&!this.loadingInternal)await this.load();return this.products.filter(p=>String(p.id)!==excluded&&String(p.category||'').trim().toLowerCase()===target);}
  private hydrateHomeCache(){
    if(typeof localStorage==='undefined')return;
    try{
      const raw=localStorage.getItem(this.homeCacheKey);if(!raw)return;
      const parsed=JSON.parse(raw);if(!parsed?.products?.length)return;
      if(Date.now()-Number(parsed.savedAt||0)>this.cacheTtlMs)return;
      for(const rawProduct of parsed.products){const p=this.map(rawProduct);if(!this.products.some(x=>String(x.id)===String(p.id)))this.products.push(p);}
      this.catalogueTotal.set(Number(parsed.total||this.products.length));this.productsVersion.update(v=>v+1);
    }catch{}
  }
  private saveHomeCache(){
    if(typeof localStorage==='undefined'||!this.products.length)return;
    try{localStorage.setItem(this.homeCacheKey,JSON.stringify({savedAt:Date.now(),total:this.catalogueTotal(),products:this.products.slice(0,20)}));}catch{}
  }
  private saveCachedProduct(product:Product){if(typeof localStorage==='undefined'||!product?.id)return;try{localStorage.setItem(this.cachePrefix+String(product.id),JSON.stringify({savedAt:Date.now(),product}));}catch{}}
  private readCachedProduct(id:string):Product|undefined{if(typeof localStorage==='undefined')return undefined;try{const raw=localStorage.getItem(this.cachePrefix+id);if(!raw)return undefined;const parsed=JSON.parse(raw);if(!parsed?.product||Date.now()-Number(parsed.savedAt||0)>this.cacheTtlMs){localStorage.removeItem(this.cachePrefix+id);return undefined;}return this.map(parsed.product);}catch{return undefined;}}
  private map(x:any):Product{const images=Array.isArray(x.images)?x.images:[];const normalized=images.map((u:string)=>this.absoluteUrl(u));const vp=x.variantPreview?.hasVariants?x.variantPreview:undefined;const image=this.absoluteUrl(vp?.image||x.image||normalized[0]||'');const price=Number(vp?.price??x.price??0);const oldPriceRaw=vp?.oldPrice??x.oldPrice;const stock=Number(vp?.stock??x.stock??0);const variantPreview=vp?{...vp,image:this.absoluteUrl(vp.image||'')} : undefined;return{id:String(x.id),name:x.name,seller:x.seller?{id:Number(x.seller.id),name:x.seller.name||'',phone:x.seller.phone||''}:undefined,category:x.category,subcategory:x.subcategory,type:x.type,brand:x.brand||'',gender:x.gender||'',material:x.material||'',warranty:x.warranty||'',returnDays:x.returnDays==null?7:Number(x.returnDays),weight:x.weight==null?undefined:Number(x.weight),dimensions:x.dimensions||'',hsnCode:x.hsnCode||'',taxIncluded:x.taxIncluded!==false,featured:!!x.featured,gstPercent:Number(x.gstPercent||0),shippingFee:Number(x.shippingFee||0),platformFee:Number(x.platformFee||0),stock,price,oldPrice:oldPriceRaw==null?undefined:Number(oldPriceRaw),rating:Number(x.rating||0),reviews:Number(x.reviews||0),image,images:normalized.length?normalized:(image?[image]:[]),description:x.description||'',tags:Array.isArray(x.tags)?x.tags:[],colors:Array.isArray(x.colors)?x.colors:[],sizes:Array.isArray(x.sizes)?x.sizes:[],variantPreview};}
  private absoluteUrl(url:string){if(!url)return '';if(/^https?:\/\//i.test(url))return url;return `http://localhost:8080${url.startsWith('/')?'':'/'}${url}`;}
}
