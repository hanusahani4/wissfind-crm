import { Injectable, computed, effect, signal } from '@angular/core';
import { BackendApiService } from './backend-api.service';
import { Product } from './product.model';

export interface CartVariant { color?: string; size?: string; sku?: string; price?: number; oldPrice?: number; image?: string; stock?: number; }
export interface CartItem { product: Product; quantity: number; variant?: CartVariant; }
export interface ShippingConfig {
  freeShippingThreshold: number; prepaidShippingCharge: number; codShippingCharge: number; codMaxOrderAmount: number; codEnabled: boolean;
}
export interface CartCharges {
  subtotal: number; productDiscount: number; couponDiscount: number; shippingCost: number; gst: number;
  platformFee: number; handlingFee: number; convenienceFee: number; giftWrapFee: number; totalSavings: number; total: number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly items = signal<CartItem[]>(this.load());
  readonly cart = this.items.asReadonly();
  readonly shippingConfig = signal<ShippingConfig>({ freeShippingThreshold: 200, prepaidShippingCharge: 20, codShippingCharge: 70, codMaxOrderAmount: 2000, codEnabled: true });
  readonly shippingConfigLoaded = signal(false);

  constructor(private api: BackendApiService) {
    void this.loadShippingConfig();
    effect(() => { if (!this.codAllowed() && this.paymentMethod() === 'COD') this.paymentMethod.set('RAZORPAY'); });
  }

  readonly count = computed(() => this.items().reduce((sum, item) => sum + Math.max(0, item.quantity), 0));
  private itemPrice(item: CartItem) { return Math.max(0, Number(item.variant?.price ?? item.product.price) || 0); }
  private itemOldPrice(item: CartItem) { return Math.max(this.itemPrice(item), Number(item.variant?.oldPrice ?? item.product.oldPrice) || this.itemPrice(item)); }
  readonly subtotal = computed(() => this.items().reduce((sum, item) => sum + this.itemPrice(item) * Math.max(0, Number(item.quantity) || 0), 0));
  readonly couponCode = signal<string>(''); readonly giftWrap = signal<boolean>(false); readonly paymentMethod = signal<'COD' | 'RAZORPAY'>('COD');
  setPaymentMethod(method: 'COD' | 'RAZORPAY') { if (method === 'COD' && !this.codAllowed()) { this.paymentMethod.set('RAZORPAY'); return; } this.paymentMethod.set(method); }
  readonly productDiscount = computed(() => Math.round(this.items().reduce((sum, item) => sum + Math.max(0, this.itemOldPrice(item) - this.itemPrice(item)) * Math.max(0, item.quantity), 0)));
  readonly couponDiscount = computed(() => this.couponCode().trim().toUpperCase() === 'WISS10' ? Math.round(this.subtotal() * .10) : 0);
  readonly payableProducts = computed(() => Math.max(0, this.subtotal() - this.couponDiscount()));
  readonly codAllowed = computed(() => { const c=this.shippingConfig(); return c.codEnabled && this.payableProducts() <= Math.max(0, Number(c.codMaxOrderAmount)||0); });
  readonly codUnavailableReason = computed(() => { const c=this.shippingConfig(); if(!c.codEnabled)return 'Cash on Delivery is currently unavailable.'; const max=Math.max(0,Number(c.codMaxOrderAmount)||0); return this.payableProducts()>max?`COD is unavailable above ₹${max.toLocaleString('en-IN')}. Please choose prepaid payment.`:''; });
  readonly shippingCost = computed(() => this.shippingFor(this.paymentMethod())); readonly platformFee=computed(()=>0); readonly handlingFee=computed(()=>0); readonly convenienceFee=computed(()=>0);
  readonly giftWrapFee=computed(()=>this.giftWrap()&&this.subtotal()>0?49:0); readonly taxableAmount=computed(()=>Math.max(0,this.subtotal()-this.couponDiscount()+this.shippingCost()+this.giftWrapFee())); readonly gst=computed(()=>0);
  readonly totalSavings=computed(()=>this.productDiscount()+this.couponDiscount()); readonly total=computed(()=>this.totalFor(this.paymentMethod())); readonly codTotal=computed(()=>this.totalFor('COD')); readonly razorpayTotal=computed(()=>this.totalFor('RAZORPAY')); readonly razorpaySavings=computed(()=>Math.max(0,this.codTotal()-this.razorpayTotal()));
  shippingFor(method:'COD'|'RAZORPAY'){const p=this.payableProducts(),c=this.shippingConfig();if(p<=0||p>=Math.max(0,Number(c.freeShippingThreshold)||0))return 0;return method==='COD'?Math.max(0,Number(c.codShippingCharge)||0):Math.max(0,Number(c.prepaidShippingCharge)||0);}
  totalFor(method:'COD'|'RAZORPAY'){return Math.max(0,Math.round(this.payableProducts()+this.shippingFor(method)+this.giftWrapFee()));}
  readonly summary=computed<CartCharges>(()=>({subtotal:this.subtotal(),productDiscount:this.productDiscount(),couponDiscount:this.couponDiscount(),shippingCost:this.shippingCost(),gst:this.gst(),platformFee:this.platformFee(),handlingFee:this.handlingFee(),convenienceFee:this.convenienceFee(),giftWrapFee:this.giftWrapFee(),totalSavings:this.totalSavings(),total:this.total()}));

  private key(productId: string|number, variant?: CartVariant) { return `${productId}::${variant?.sku || `${variant?.color||''}|${variant?.size||''}`}`; }
  add(product: Product, variant?: CartVariant) {
    if (!product?.id) return;
    const k=this.key(product.id,variant);
    this.items.update(items => { const i=items.findIndex(x=>this.key(x.product.id,x.variant)===k); if(i<0)return [...items,{product,quantity:1,variant}]; const copy=[...items]; copy[i]={...copy[i],quantity:Math.max(1,copy[i].quantity+1)}; return copy; });
    this.persist(); void this.api.post('/homepage/events/cart-add',{productId:product.id,variantSku:variant?.sku,variantColor:variant?.color,variantSize:variant?.size}).catch(()=>undefined);
  }
  update(productId:string|number,quantity:number,variant?:CartVariant){const q=Math.max(0,Math.floor(Number(quantity)||0));const k=this.key(productId,variant);this.items.update(items=>q<=0?items.filter(x=>this.key(x.product.id,x.variant)!==k):items.map(x=>this.key(x.product.id,x.variant)===k?{...x,quantity:q}:x));this.persist();}
  remove(productId:string|number,variant?:CartVariant){const k=this.key(productId,variant);this.items.update(items=>items.filter(x=>this.key(x.product.id,x.variant)!==k));this.persist();}
  applyCoupon(code:string):boolean{const n=code.trim().toUpperCase();if(n==='WISS10'){this.couponCode.set(n);return true;}this.couponCode.set('');return false;} removeCoupon(){this.couponCode.set('');} setGiftWrap(e:boolean){this.giftWrap.set(!!e);} clear(){this.items.set([]);this.couponCode.set('');this.giftWrap.set(false);this.persist();}
  private async loadShippingConfig(){try{const v:any=await this.api.get('/shipping-config');if(v)this.shippingConfig.set({freeShippingThreshold:Math.max(0,Number(v.freeShippingThreshold)||0),prepaidShippingCharge:Math.max(0,Number(v.prepaidShippingCharge)||0),codShippingCharge:Math.max(0,Number(v.codShippingCharge)||0),codMaxOrderAmount:Math.max(0,Number(v.codMaxOrderAmount)||0),codEnabled:v.codEnabled!==false});}catch{}finally{this.shippingConfigLoaded.set(true);if(!this.codAllowed())this.paymentMethod.set('RAZORPAY');}}
  private persist(){try{localStorage.setItem('wissfind-cart',JSON.stringify(this.items()));}catch{}}
  private load():CartItem[]{try{const raw=localStorage.getItem('wissfind-cart');if(!raw)return[];const p=JSON.parse(raw);if(!Array.isArray(p))return[];return p.filter(x=>x&&x.product&&x.product.id&&Number(x.quantity)>0).map(x=>({product:x.product as Product,quantity:Math.max(1,Math.floor(Number(x.quantity))),variant:x.variant?x.variant as CartVariant:undefined}));}catch{return[];}}
}
