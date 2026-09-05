import { Component, inject } from '@angular/core';
import { DecimalPipe, NgFor, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CartService } from '../core/cart.service';

@Component({
  standalone: true,
  imports: [NgFor, NgIf, DecimalPipe, RouterLink],
  template: `
  <main class="page">
    <div class="container">
      <div class="cart-head">
        <div>
          <div class="eyebrow">Your selection</div>
          <h1 class="title">Shopping bag</h1>
        </div>
        <div class="item-count" *ngIf="cart.count()">{{ cart.count() }} {{ cart.count() === 1 ? 'item' : 'items' }}</div>
      </div>

      <div *ngIf="cart.cart().length; else empty" class="layout">
        <section class="items">
          <article class="item card" *ngFor="let item of visibleItems">
            <a class="product-link product-image-link" [routerLink]="['/product', item.product.id]" aria-label="View {{ item.product.name }}">
              <img [src]="item.product.image" [alt]="item.product.name">
            </a>

            <div class="info">
              <div class="eyebrow">{{ item.product.category }}</div>
              <h3>
                <a class="product-link" [routerLink]="['/product', item.product.id]">
                  {{ item.product.name }}
                </a>
              </h3>

              <div class="price-line">
                <strong>₹{{ item.product.price | number }}</strong>
                <span *ngIf="item.product.oldPrice" class="old-price">
                  ₹{{ item.product.oldPrice | number }}
                </span>
              </div>

              <div class="variant" *ngIf="item.product.category === 'Fashion'">
                Standard variant
              </div>

              <div class="controls">
                <div class="qty">
                  <button type="button" aria-label="Decrease quantity"
                    (click)="cart.update(item.product.id,item.quantity-1)">−</button>
                  <span>{{ item.quantity }}</span>
                  <button type="button" aria-label="Increase quantity"
                    (click)="cart.update(item.product.id,item.quantity+1)">+</button>
                </div>
                <button type="button" class="remove" (click)="cart.remove(item.product.id)">Remove</button>
              </div>
            </div>

            <strong class="line-total">
              ₹{{ (item.product.price * item.quantity) | number }}
            </strong>
          </article>

          <div class="pagination" *ngIf="totalPages > 1"><button type="button" (click)="prevPage()" [disabled]="page<=1">← Prev</button><span>Page {{page}} of {{totalPages}}</span><button type="button" (click)="nextPage()" [disabled]="page>=totalPages">Next →</button></div>

          <div class="benefit card">
            <div class="benefit-icon">✓</div>
            <div>
              <strong *ngIf="cart.shippingCost() === 0">Free shipping unlocked</strong>
              <strong *ngIf="cart.shippingCost() > 0">Free shipping on orders ₹5,000+</strong>
              <p class="muted" *ngIf="cart.shippingCost() > 0">
                Add ₹{{ (5000 - (cart.subtotal() - cart.couponDiscount())) | number }} more to unlock free shipping.
              </p>
              <p class="muted" *ngIf="cart.shippingCost() === 0">Your order qualifies for free delivery.</p>
            </div>
          </div>
        </section>

        <aside class="summary card">
          <div class="eyebrow">Order summary</div>
          <h2>Price details</h2>

          <div class="rows">
            <div class="row">
              <span>Subtotal</span>
              <strong>₹{{ cart.subtotal() | number }}</strong>
            </div>

            <div class="row discount" *ngIf="cart.productDiscount()">
              <span>Product discount</span>
              <strong>-₹{{ cart.productDiscount() | number }}</strong>
            </div>

            <div class="coupon-row" *ngIf="!cart.couponDiscount(); else appliedCoupon">
              <input #coupon placeholder="Coupon code" maxlength="20">
              <button type="button" class="apply" (click)="applyCoupon(coupon.value); coupon.value=''">Apply</button>
            </div>

            <ng-template #appliedCoupon>
              <div class="row discount">
                <span>Coupon (WISS10)</span>
                <span class="coupon-action">
                  <strong>-₹{{ cart.couponDiscount() | number }}</strong>
                  <button type="button" (click)="cart.removeCoupon()">Remove</button>
                </span>
              </div>
            </ng-template>

            <div class="row">
              <span>Shipping</span>
              <strong [class.free]="cart.shippingCost() === 0">
                {{ cart.shippingCost() === 0 ? 'FREE' : '₹' + (cart.shippingCost() | number) }}
              </strong>
            </div>

            <div class="gift-row">
              <label>
                <input type="checkbox"
                  [checked]="cart.giftWrap()"
                  (change)="cart.setGiftWrap($any($event.target).checked)">
                <span>
                  <strong>Add gift wrapping</strong>
                  <small>Premium packaging · ₹49</small>
                </span>
              </label>
              <strong>₹49</strong>
            </div>
          </div>

          <div class="savings" *ngIf="cart.totalSavings()">
            You save ₹{{ cart.totalSavings() | number }} on this order
          </div>

          <div class="total-row">
            <span>Total payable</span>
            <strong>₹{{ cart.total() | number }}</strong>
          </div>

          <div class="secure">
            <span>🔒</span>
            <div>
              <strong>Secure checkout</strong>
              <small>Taxes and fees are shown before payment.</small>
            </div>
          </div>

          <a routerLink="/checkout" class="btn checkout">Continue to checkout</a>
          <a routerLink="/" class="continue">← Continue shopping</a>
        </aside>
      </div>

      <ng-template #empty>
        <div class="empty card">
          <div class="empty-icon">🛍</div>
          <h2>Your bag is empty.</h2>
          <p class="muted">Add something you love and it will appear here.</p>
          <a class="btn" routerLink="/">Continue shopping</a>
        </div>
      </ng-template>
    </div>
  </main>
  `,
  styles: [`
    .cart-head{display:flex;align-items:end;justify-content:space-between;margin-bottom:34px}
    .title{margin:12px 0 0}
    .item-count{border:1px solid var(--line);background:#fff;border-radius:999px;padding:8px 14px;color:var(--muted);font-size:13px;font-weight:700}
    .layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(330px,400px);gap:28px;align-items:start}
    .items{display:grid;gap:14px}
    .item{display:grid;grid-template-columns:150px minmax(0,1fr) auto;gap:20px;padding:14px;position:relative}
    .item img{width:150px;height:180px;object-fit:cover;border-radius:13px;background:#f1f1ee}
    .product-link{color:inherit;text-decoration:none}
    .product-link:hover{text-decoration:underline}
    .product-image-link{display:block}
    .product-image-link:hover{text-decoration:none;opacity:.94}
    .info{padding:8px 4px}
    .info h3{font-size:20px;margin:8px 0 10px}
    .price-line{display:flex;align-items:center;gap:10px;font-size:16px}
    .old-price{text-decoration:line-through;color:#aaa;font-size:13px}
    .variant{color:var(--muted);font-size:13px;margin-top:8px}
    .controls{display:flex;align-items:center;gap:18px;margin-top:26px}
    .qty{display:flex;align-items:center;border:1px solid var(--line);border-radius:11px;overflow:hidden;background:#fff}
    .qty button{border:0;background:#fff;width:34px;height:34px;font-size:18px}
    .qty span{min-width:30px;text-align:center;font-size:14px;font-weight:700}
    .remove{border:0;background:none;color:#999;padding:5px 0}
    .remove:hover{color:var(--danger)}
    .line-total{padding:10px 5px;font-size:16px;white-space:nowrap}
    .summary{padding:24px;position:sticky;top:95px}
    .summary h2{font-size:23px;margin:8px 0 18px}
    .rows{border-top:1px solid var(--line);padding-top:4px}
    .row{display:flex;justify-content:space-between;align-items:center;gap:14px;margin:15px 0;font-size:14px}
    .row span:first-child{color:#555}
    .row small{font-size:10px;color:#999}
    .discount{color:var(--success)}
    .discount span:first-child{color:var(--success)}
    .free{color:var(--success)}
    .coupon-row{display:grid;grid-template-columns:1fr auto;gap:7px;margin:17px 0}
    .coupon-row input{width:100%;border:1px solid var(--line);border-radius:10px;padding:10px 11px;outline:none}
    .apply{border:1px solid var(--ink);background:#111;color:#fff;border-radius:10px;padding:0 14px;font-weight:700}
    .coupon-action{display:flex;align-items:center;gap:8px}
    .coupon-action button{border:0;background:none;color:#999;font-size:11px;text-decoration:underline}
    .gift-row{display:flex;align-items:center;justify-content:space-between;border-top:1px dashed var(--line);padding:15px 0;margin-top:6px;font-size:13px}
    .gift-row label{display:flex;gap:10px;align-items:flex-start;cursor:pointer}
    .gift-row input{margin-top:3px;accent-color:#111}
    .gift-row span{display:grid;gap:3px}
    .gift-row small{color:#999}
    .savings{background:#edf8f1;color:var(--success);border-radius:10px;padding:11px 12px;font-size:13px;font-weight:700;margin:16px 0}
    .total-row{display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--line);padding-top:18px;margin-top:8px;font-size:17px}
    .total-row strong{font-size:23px}
    .secure{display:flex;gap:10px;margin-top:17px;padding:12px;background:#f7f7f5;border-radius:11px}
    .secure div{display:grid;gap:2px}
    .secure small{color:#888;font-size:11px}
    .checkout{display:block;text-align:center;margin-top:18px;padding:14px}
    .continue{display:block;text-align:center;color:#777;font-size:13px;margin-top:13px}
    .benefit{display:flex;gap:12px;align-items:center;padding:14px 16px}
    .benefit-icon{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#edf8f1;color:var(--success);font-weight:800}
    .benefit p{margin:3px 0 0;font-size:12px}
    .empty{padding:75px 20px;text-align:center}
    .empty-icon{font-size:40px;margin-bottom:14px}
    .empty p{margin:10px 0 24px}
    @media(max-width:950px){
      .layout{grid-template-columns:1fr}
      .summary{position:static}
    }
    @media(max-width:600px){
      .cart-head{align-items:flex-start}
      .item{grid-template-columns:92px minmax(0,1fr);gap:13px}
      .item img{width:92px;height:120px}
      .line-total{grid-column:2;padding:0}
      .info h3{font-size:16px}
      .controls{margin-top:17px}
      .summary{padding:18px}
    }
  `]
})
export class CartComponent {
  readonly pageSize = 10;
  page = 1;
  get totalPages(): number { return Math.max(1, Math.ceil(this.cart.cart().length / this.pageSize)); }
  get visibleItems() { const max=Math.max(1,this.totalPages); if(this.page>max)this.page=max; const start=(this.page-1)*this.pageSize; return this.cart.cart().slice(start,start+this.pageSize); }
  prevPage(){ if(this.page>1)this.page--; }
  nextPage(){ if(this.page<this.totalPages)this.page++; }
  readonly cart = inject(CartService);

  applyCoupon(code: string) {
    this.cart.applyCoupon(code);
  }
}
