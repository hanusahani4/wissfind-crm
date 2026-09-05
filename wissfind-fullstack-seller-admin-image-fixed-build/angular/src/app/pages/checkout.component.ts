import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DecimalPipe, NgFor, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CartService } from '../core/cart.service';
import { BackendApiService } from '../core/backend-api.service';
import { AuthService } from '../core/auth.service';

interface CustomerAddress {
  id: number;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  district: string;
  state: string;
  pincode: string;
  country: string;
  defaultAddress: boolean;
}

@Component({
  standalone: true,
  imports: [NgIf, NgFor, DecimalPipe, RouterLink, FormsModule],
  template: `
  <main class="page"><div class="container">
    <div class="eyebrow">Secure checkout</div><h1>Complete your order</h1>

    <div *ngIf="cart.cart().length && !placed; else state" class="checkout-grid">
      <section class="card form">
        <div class="section-title"><span>1</span><div><strong>Shipping address</strong><small>Select a saved address or add a new one</small></div></div>

        <div class="address-list" *ngIf="addresses.length && !showAddressForm">
          <div class="address-card" *ngFor="let a of addresses"
               [class.selected]="selectedAddressId === a.id"
               (click)="selectAddress(a)"
               (keydown.enter)="selectAddress(a)"
               (keydown.space)="selectAddress(a); $event.preventDefault()"
               tabindex="0" role="button"
               [attr.aria-pressed]="selectedAddressId === a.id">
            <span class="radio-dot">{{selectedAddressId === a.id ? '✓' : ''}}</span>
            <span class="address-main">
              <b>{{a.label}} <em *ngIf="a.defaultAddress">Default</em></b>
              <strong>{{a.fullName}} · {{a.phone}}</strong>
              <small>{{a.line1}}{{a.line2 ? ', ' + a.line2 : ''}}, {{a.city}}, {{a.district}}, {{a.state}} - {{a.pincode}}</small>
            </span>
            <span class="address-actions" (click)="$event.stopPropagation()">
              <button type="button" class="address-action" (click)="editAddress(a)">Edit</button>
              <button type="button" class="address-action danger" (click)="deleteAddress(a)">Delete</button>
            </span>
          </div>
        </div>

        <button type="button" class="add-address" (click)="startNewAddress()">+ Add a new address</button>

        <div class="new-address" *ngIf="showAddressForm">
          <div class="form-head"><strong>{{editingAddressId ? 'Edit address' : 'Add address'}}</strong><button type="button" class="text-btn" (click)="showAddressForm=false">Close</button></div>
          <div class="two">
            <div class="field"><label>Address label</label><input name="label" [(ngModel)]="form.label" maxlength="30" placeholder="Home / Office"></div>
            <div class="field"><label>Full name</label><input name="fullName" [(ngModel)]="form.fullName" maxlength="100" placeholder="Full name"></div>
          </div>
          <div class="two">
            <div class="field"><label>Mobile number</label><input name="phone" [(ngModel)]="form.phone" maxlength="13" inputmode="tel" placeholder="+91 9876543210"></div>
            <div class="field"><label>PIN code</label><input name="pincode" [(ngModel)]="form.pincode" maxlength="6" inputmode="numeric" (input)="onPincodeInput()" (blur)="validatePincode()" placeholder="110001"></div>
          </div>
          <div class="pin-status" *ngIf="pinLoading">Validating PIN code…</div>
          <div class="pin-ok" *ngIf="pinInfo && !pinLoading">✓ {{pinInfo.district}}, {{pinInfo.state}} · {{pinInfo.postOffices?.length || 0}} post office(s)</div>
          <div class="field"><label>Address line 1</label><input name="line1" [(ngModel)]="form.line1" maxlength="250" placeholder="House / flat / street / area"></div>
          <div class="field"><label>Address line 2 <small>(optional)</small></label><input name="line2" [(ngModel)]="form.line2" maxlength="250" placeholder="Landmark, apartment, etc."></div>
          <div class="two">
            <div class="field"><label>City / town</label><input name="city" [(ngModel)]="form.city" maxlength="100" placeholder="City / town"></div>
            <div class="field"><label>State</label><input name="state" [value]="pinInfo?.state || ''" readonly placeholder="Validated from PIN"></div>
          </div>
          <label class="default-check"><input type="checkbox" name="defaultAddress" [(ngModel)]="form.defaultAddress"> Save as default shipping address</label>
          <p class="error" *ngIf="addressError">{{addressError}}</p>
          <button type="button" class="btn small-btn" [disabled]="savingAddress || pinLoading" (click)="saveAddress()">{{savingAddress ? 'Saving…' : (editingAddressId ? 'Update address' : 'Save address')}}</button>
        </div>

        <p class="selected-note" *ngIf="selectedAddressId && !showAddressForm">✓ Shipping address selected</p>

        <div class="section-title"><span>2</span><div><strong>Payment method</strong><small>Choose how you'd like to pay</small></div></div>
        <div class="payment">
          <label [class.active-payment]="cart.paymentMethod() === 'COD'">
            <input type="radio" name="payment" value="COD" [checked]="cart.paymentMethod() === 'COD'" (change)="selectPayment('COD')">
            <span><b>Cash on delivery</b><small>Pay ₹{{cart.codTotal() | number}} on delivery · Delivery ₹{{cart.shippingFor('COD') | number}}</small></span>
          </label>
          <label [class.active-payment]="cart.paymentMethod() === 'RAZORPAY'">
            <input type="radio" name="payment" value="RAZORPAY" [checked]="cart.paymentMethod() === 'RAZORPAY'" (change)="selectPayment('RAZORPAY')">
            <span><b>Razorpay — Card / UPI / Netbanking</b><small>Pay ₹{{cart.razorpayTotal() | number}} securely{{cart.razorpaySavings() ? ' · Save ₹' + (cart.razorpaySavings() | number) : ''}}</small></span>
          </label>
        </div>

        <p class="error" *ngIf="error">{{error}}</p>
        <button class="btn" [disabled]="loading || !selectedAddressId" (click)="placeOrder()">{{loading ? (cart.paymentMethod() === 'RAZORPAY' ? 'Opening Razorpay…' : 'Placing order…') : (cart.paymentMethod() === 'RAZORPAY' ? 'Pay securely · ₹' + (cart.total() | number) : 'Place COD order · ₹' + (cart.total() | number))}}</button>
        <p class="muted note">A valid saved shipping address is required. PIN codes are verified against live postal data before saving.</p>
      </section>

      <aside class="card summary">
        <div class="eyebrow">Order summary</div><h2>{{cart.count()}} {{cart.count() === 1 ? 'item' : 'items'}}</h2>

        <div class="checkout-items">
          <div class="checkout-item" *ngFor="let item of cart.cart()">
            <a class="checkout-product" [routerLink]="['/product', item.product.id]" aria-label="View {{ item.product.name }}">
              <img [src]="item.product.image" [alt]="item.product.name">
              <span class="checkout-product-info">
                <strong>{{item.product.name}}</strong>
                <small>{{item.product.category}} · Qty {{item.quantity}}</small>
                <b>₹{{(item.product.price * item.quantity) | number}}</b>
              </span>
            </a>
          </div>
        </div>

        <div class="row"><span>Subtotal</span><span>₹{{cart.subtotal() | number}}</span></div>
        <div class="row discount" *ngIf="cart.productDiscount()"><span>Product discount</span><span>-₹{{cart.productDiscount() | number}}</span></div>
        <div class="row discount" *ngIf="cart.couponDiscount()"><span>Coupon</span><span>-₹{{cart.couponDiscount() | number}}</span></div>
        <div class="row"><span>Shipping <small>{{cart.paymentMethod() === 'COD' ? 'COD' : 'Online payment'}}</small></span><span [class.free]="cart.shippingCost() === 0">{{cart.shippingCost() === 0 ? 'FREE' : '₹' + (cart.shippingCost() | number)}}</span></div>
        <div class="row" *ngIf="cart.giftWrap()"><span>Gift wrapping</span><span>₹{{cart.giftWrapFee() | number}}</span></div>
        <div class="total"><span>Total payable</span><strong>₹{{cart.total() | number}}</strong></div>
        <div class="save" *ngIf="cart.totalSavings()">You save ₹{{cart.totalSavings() | number}}</div>
      </aside>
    </div>

    <ng-template #state>
      <div class="card success-box" *ngIf="placed; else empty"><div class="check">✓</div><h2>Order placed!</h2><p class="muted">Thanks for shopping with WissFind. Your {{cart.paymentMethod() === 'RAZORPAY' ? 'Razorpay payment' : 'COD order'}} has been recorded successfully.</p><a class="btn" routerLink="/orders">View my orders</a><a class="continue" routerLink="/">Continue shopping →</a></div>
    </ng-template>
    <ng-template #empty><div class="card success-box"><h2>Your cart is empty.</h2><p class="muted">Add products before checking out.</p><a class="btn" routerLink="/">Back to shop</a></div></ng-template>
  </div></main>`,
  styles: [`
    h1{margin:12px 0 34px}.checkout-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,390px);gap:28px;align-items:start}.form{padding:26px;display:grid;gap:18px}.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}.section-title{display:flex;gap:11px;align-items:center;border-bottom:1px solid var(--line);padding-bottom:14px;margin-top:3px}.section-title>span{width:27px;height:27px;border-radius:50%;display:grid;place-items:center;background:#111;color:#fff;font-size:12px;font-weight:800}.section-title div{display:grid;gap:2px}.section-title small{color:#888;font-size:12px}.address-list{display:grid;gap:10px}.address-card{width:100%;box-sizing:border-box;text-align:left;border:1px solid var(--line);background:#fff;border-radius:12px;padding:14px;display:flex;gap:12px;cursor:pointer;align-items:flex-start;transition:border-color .15s,box-shadow .15s}.address-card:hover{border-color:#999}.address-card:focus{outline:2px solid #111;outline-offset:1px}.address-card.selected{border-color:#111;box-shadow:0 0 0 1px #111 inset}.address-actions{margin-left:auto;display:flex;gap:8px;align-items:center;flex-shrink:0}.address-action{border:1px solid #ddd;background:#fff;border-radius:7px;padding:5px 9px;font-size:11px;cursor:pointer}.address-action:hover{border-color:#111}.address-action.danger{color:#b42318;border-color:#efc7c3}.address-action.danger:hover{background:#fff4f2;border-color:#b42318}.radio-dot{width:22px;height:22px;min-width:22px;border:1px solid #aaa;border-radius:50%;display:grid;place-items:center;font-size:12px;background:#fff}.selected .radio-dot{background:#111;color:#fff;border-color:#111}.address-main{display:grid;gap:4px}.address-main b{font-size:14px}.address-main strong{font-size:13px}.address-main small{color:#666;line-height:1.4}.address-main em{font-style:normal;font-size:10px;background:#eaf6ef;color:#19744a;padding:3px 6px;border-radius:8px;margin-left:5px}.add-address{border:1px dashed #999;background:#fff;border-radius:11px;padding:12px;font-weight:700;cursor:pointer}.new-address{border:1px solid var(--line);border-radius:12px;padding:16px;display:grid;gap:13px;background:#fafafa}.form-head{display:flex;justify-content:space-between;align-items:center}.text-btn{border:0;background:none;text-decoration:underline;cursor:pointer;color:#666}.field{display:grid;gap:6px}.field label{font-size:12px;font-weight:700}.field label small{color:#999;font-weight:400}.field input{width:100%;box-sizing:border-box;border:1px solid #ddd;border-radius:9px;padding:11px 12px;background:#fff}.field input:focus{outline:2px solid #ddd}.field input[readonly]{background:#f1f1f1;color:#555}.default-check{font-size:13px;display:flex;gap:8px;align-items:center}.default-check input{accent-color:#111}.pin-status,.pin-ok,.selected-note{font-size:12px}.pin-status{color:#777}.pin-ok,.selected-note{color:#19744a;font-weight:700}.error{color:#b42318;font-size:13px;margin:0}.small-btn{width:max-content;padding:11px 18px}.payment{display:grid;gap:10px}.payment label{border:1px solid var(--line);border-radius:11px;padding:12px;cursor:pointer;display:flex;gap:10px;align-items:flex-start}.payment label.active-payment{border-color:#111;box-shadow:0 0 0 1px #111 inset}.payment label span{display:grid;gap:4px}.payment label small{font-size:12px;color:#777}.payment input{accent-color:#111;margin-top:3px}.summary{padding:23px;position:sticky;top:95px}.summary h2{font-size:22px;margin:8px 0 20px}.checkout-items{display:grid;gap:9px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:12px 0;margin-bottom:14px}.checkout-item{min-width:0}.checkout-product{display:flex;gap:10px;align-items:center;padding:7px;border-radius:10px;color:inherit;text-decoration:none;transition:background .15s}.checkout-product:hover{background:#f7f7f5}.checkout-product img{width:58px;height:68px;object-fit:cover;border-radius:8px;background:#f1f1ee;flex-shrink:0}.checkout-product-info{display:grid;gap:3px;min-width:0}.checkout-product-info strong{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.checkout-product-info small{font-size:10px;color:#888}.checkout-product-info b{font-size:12px}.row{display:flex;justify-content:space-between;margin:14px 0;font-size:14px}.row small{color:#999;font-size:10px}.discount{color:var(--success)}.free{color:var(--success);font-weight:700}.total{display:flex;justify-content:space-between;border-top:1px solid var(--line);margin-top:18px;padding-top:18px;font-size:17px}.total strong{font-size:22px}.save{margin-top:14px;padding:10px;background:#edf8f1;color:var(--success);border-radius:9px;font-size:13px;font-weight:700}.note{text-align:center;font-size:12px;margin:0}.success-box{text-align:center;padding:80px 20px}.check{margin:auto auto 18px;width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:#e7f5ec;color:#19744a;font-size:26px;font-weight:800}.success-box p{max-width:500px;margin:12px auto 24px}.continue{display:inline-block;margin-left:10px;color:#666;font-size:13px}@media(max-width:800px){.checkout-grid{grid-template-columns:1fr}.summary{position:static}.two{grid-template-columns:1fr}}
  `]
})
export class CheckoutComponent implements OnInit, OnDestroy {
  readonly cart = inject(CartService);
  private readonly api = inject(BackendApiService);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  placed = false; loading = false; error = '';
  addresses: CustomerAddress[] = [];
  selectedAddressId: number | null = null;
  showAddressForm = false; savingAddress = false; addressError = '';
  pinLoading = false; pinInfo: any = null; private pinRequestId = 0;
  editingAddressId: number | null = null;
  form = this.emptyForm();
  private readonly pageAbort = new AbortController();

  async ngOnInit() {
    await this.auth.ready();
    await this.loadAddresses();
    this.cdr.markForCheck();
  }
  ngOnDestroy() { this.pageAbort.abort(); }

  private emptyForm() { return { label:'Home', fullName:'', phone:'', line1:'', line2:'', city:'', pincode:'', defaultAddress:false }; }

  async loadAddresses(preferredId: number | null = this.selectedAddressId) {
    try {
      const rows:any = await this.api.get('/addresses', this.pageAbort.signal);
      this.addresses = Array.isArray(rows) ? rows : [];
      const preferred = preferredId != null ? this.addresses.find(a => Number(a.id) === Number(preferredId)) : null;
      const defaultAddress = this.addresses.find(a => a.defaultAddress);
      this.selectedAddressId = preferred?.id ?? defaultAddress?.id ?? this.addresses[0]?.id ?? null;
      if (!this.addresses.length && !this.showAddressForm) this.startNewAddress();
      this.cdr.markForCheck();
    } catch (e:any) {
      if (!this.isAbort(e)) {
        this.addressError = e?.error?.error || e?.message || 'Unable to load saved addresses.';
        this.cdr.markForCheck();
      }
    }
  }

  selectAddress(a: CustomerAddress) {
    this.selectedAddressId = Number(a.id); this.showAddressForm = false; this.editingAddressId = null; this.addressError = ''; this.error = '';
  }
  selectPayment(method: 'COD' | 'RAZORPAY') { this.cart.setPaymentMethod(method); this.error = ''; }

  startNewAddress() {
    const u:any = this.auth.user();
    this.editingAddressId = null; this.selectedAddressId = null; this.form = this.emptyForm();
    this.form.fullName = u?.name || ''; this.form.phone = u?.phone || ''; this.pinInfo = null; this.addressError = ''; this.error = ''; this.showAddressForm = true;
    this.cdr.markForCheck();
  }

  editAddress(a: CustomerAddress) {
    this.editingAddressId = Number(a.id); this.selectedAddressId = null;
    this.form = { label:a.label, fullName:a.fullName, phone:a.phone, line1:a.line1, line2:a.line2||'', city:a.city, pincode:a.pincode, defaultAddress:a.defaultAddress };
    this.pinInfo = {district:a.district,state:a.state,postOffices:[],valid:true}; this.addressError=''; this.error=''; this.showAddressForm=true; this.cdr.markForCheck();
  }

  async deleteAddress(a: CustomerAddress) {
    if (this.savingAddress || this.loading) return;
    const ok = window.confirm(`Delete "${a.label}" address?`); if (!ok) return;
    this.addressError = ''; this.cdr.markForCheck();
    try {
      await this.api.delete(`/addresses/${a.id}`, this.pageAbort.signal);
      const deletedId = Number(a.id); this.addresses = this.addresses.filter(x => Number(x.id) !== deletedId);
      if (this.selectedAddressId === deletedId) { const fallback = this.addresses.find(x => x.defaultAddress) ?? this.addresses[0]; this.selectedAddressId = fallback?.id ?? null; }
      if (this.editingAddressId === deletedId) { this.editingAddressId = null; this.showAddressForm = false; this.form = this.emptyForm(); this.pinInfo = null; }
      await this.loadAddresses(this.selectedAddressId);
    } catch (e:any) {
      if (!this.isAbort(e)) { this.addressError = e?.error?.error || e?.message || 'Unable to delete address.'; this.cdr.markForCheck(); }
    }
  }

  private normalizePhone(v:string) { return (v||'').replace(/[\s-]/g,''); }

  async validatePincode() {
    const pin=(this.form.pincode||'').replace(/\D/g,''); this.form.pincode=pin;
    if (!/^\d{6}$/.test(pin)) { this.pinInfo=null; this.cdr.markForCheck(); return false; }
    const requestId=++this.pinRequestId; this.pinLoading=true; this.addressError=''; this.cdr.markForCheck();
    try {
      const info:any=await this.api.get('/addresses/pincode/'+pin, this.pageAbort.signal);
      if(requestId!==this.pinRequestId) return false;
      this.pinInfo=info; if(info?.district && !this.form.city) this.form.city=info.district; this.cdr.markForCheck(); return !!info?.valid;
    } catch(e:any) { if(requestId===this.pinRequestId){this.pinInfo=null;this.addressError=e?.error?.error||e?.message||'Invalid PIN code.';this.cdr.markForCheck();} return false; }
    finally { if(requestId===this.pinRequestId){this.pinLoading=false;this.cdr.markForCheck();} }
  }

  onPincodeInput() { this.form.pincode=this.form.pincode.replace(/\D/g,'').slice(0,6); this.pinInfo=null; this.addressError=''; this.cdr.markForCheck(); }

  private validateForm() {
    const f=this.form, phone=this.normalizePhone(f.phone);
    if(!f.label.trim()) return 'Please enter an address label.';
    if(!/^[A-Za-z .\'-]{2,100}$/.test(f.fullName.trim())) return 'Please enter a valid full name.';
    if(!/^(?:\+91[6-9]\d{9}|[6-9]\d{9})$/.test(phone)) return 'Please enter a valid Indian mobile number.';
    if(f.line1.trim().length<5) return 'Please enter a complete address.';
    if(!/^\d{6}$/.test(f.pincode)) return 'Please enter a valid 6-digit PIN code.';
    if(!f.city.trim()) return 'Please enter your city/town.';
    if(!this.pinInfo?.valid) return 'Please enter a real 6-digit Indian PIN code. We will try multiple postal services automatically.';
    return '';
  }

  async saveAddress() {
    this.addressError = this.validateForm(); this.cdr.markForCheck();
    if (this.addressError) return;
    if (!this.pinInfo?.valid) {
      const valid = await this.validatePincode();
      if (!valid) { this.addressError = this.validateForm() || 'Please enter a real 6-digit Indian PIN code.'; this.cdr.markForCheck(); return; }
    }
    this.savingAddress = true; this.addressError = ''; this.cdr.markForCheck();
    const editingId = this.editingAddressId;
    try {
      const payload = {...this.form, phone: this.normalizePhone(this.form.phone)};
      const saved:any = editingId ? await this.api.put('/addresses/' + editingId, payload, this.pageAbort.signal) : await this.api.post('/addresses', payload, this.pageAbort.signal);
      const savedId = Number(saved?.id);
      this.showAddressForm = false; this.editingAddressId = null; this.addressError = '';
      if (saved?.id != null) this.selectedAddressId = savedId;
      if (saved?.id != null) {
        const idx = this.addresses.findIndex(a => Number(a.id) === savedId);
        if (idx >= 0) this.addresses[idx] = saved; else this.addresses = [saved, ...this.addresses];
      }
      this.cdr.markForCheck();
      await this.loadAddresses(saved?.id != null ? savedId : this.selectedAddressId);
    } catch(e:any) {
      if (!this.isAbort(e)) { this.addressError = e?.error?.error || e?.message || 'Unable to save address. Please try again.'; this.cdr.markForCheck(); }
    } finally { this.savingAddress = false; this.cdr.markForCheck(); }
  }

  async placeOrder() {
    if(this.loading) return; this.loading=true; this.error=''; this.cdr.markForCheck();
    try {
      const items=this.cart.cart(); if(!items.length) throw new Error('Your cart is empty.');
      if(!this.selectedAddressId) throw new Error('Please select a shipping address.');
      const orderItems=items.map(item=>({productId:Number(item.product.id),quantity:Math.max(1,Math.floor(Number(item.quantity)||0)),variant:(item.product as any)?.variant||undefined}));
      const productIds=orderItems.map(i=>i.productId).filter(id=>Number.isFinite(id)&&id>0);
      if(!productIds.length||productIds.length!==items.length||orderItems.some(i=>!Number.isFinite(i.productId)||i.quantity<1)) throw new Error('One or more cart products are invalid. Please remove them and add them again.');
      const knownSellerIds=[...new Set(items.map(i=>Number((i.product as any)?.seller?.id)).filter(id=>Number.isFinite(id)&&id>0))];
      const payload:any={productIds,items:orderItems,shippingAddressId:this.selectedAddressId,paymentMethod:this.cart.paymentMethod(),couponCode:this.cart.couponCode(),giftWrap:this.cart.giftWrap(),paymentStatus:'PENDING',deliveryStatus:'Processing'};
      if(knownSellerIds.length===1) payload.sellerId=knownSellerIds[0];
      const order:any=await this.api.post('/orders',payload,this.pageAbort.signal);
      if(this.cart.paymentMethod()==='COD') { await this.api.post('/payments/dummy',{order:{id:order.id},amount:order.total},this.pageAbort.signal); this.placed=true; this.cart.clear(); return; }
      const rz:any=await this.api.post('/payments/razorpay/order',{orderId:order.id},this.pageAbort.signal); await this.openRazorpay(rz, order);
    } catch(e:any) { if(!this.isAbort(e)) this.error=e?.error?.error||e?.message||'Unable to place order. Please try again.'; }
    finally { this.loading=false; this.cdr.markForCheck(); }
  }

  private openRazorpay(data:any, order:any): Promise<void> {
    return new Promise((resolve, reject) => {
      const RazorpayCtor=(window as any).Razorpay;
      if(!RazorpayCtor) { reject(new Error('Razorpay checkout could not be loaded. Please refresh and try again.')); return; }
      const u:any=this.auth.user();
      const options:any={key:data.keyId, amount:data.amount, currency:data.currency || 'INR', name:'WissFind', description:'Order '+order.orderNumber, order_id:data.razorpayOrderId, prefill:{name:u?.name || '', email:u?.email || '', contact:u?.phone || ''}, theme:{color:'#111111'}, timeout:600,
        handler: async (response:any) => { try { await this.api.post('/payments/razorpay/verify', response, this.pageAbort.signal); this.placed=true; this.cart.clear(); this.cdr.markForCheck(); resolve(); } catch(e:any) { reject(new Error(e?.error?.error||e?.message||'Razorpay payment verification failed.')); } },
        modal:{ondismiss:()=>reject(new Error('Payment cancelled. Your order is still pending and no successful payment was recorded.'))}
      };
      try { new RazorpayCtor(options).open(); } catch(e) { reject(e); }
    });
  }
  private isAbort(e:any){return e?.name==='AbortError';}
}
