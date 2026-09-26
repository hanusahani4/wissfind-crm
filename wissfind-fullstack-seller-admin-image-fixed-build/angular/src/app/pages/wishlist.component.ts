import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../core/cart.service';
import { WishlistProduct, WishlistService } from '../core/wishlist.service';

@Component({
  standalone: true,
  imports: [CommonModule, DecimalPipe, RouterLink],
  template: `
    <main class="page">
      <div class="container">
        <div class="top"><div><div class="eyebrow">YOUR SAVED PRODUCTS</div><h1>My Wishlist</h1><p>Products you want to keep an eye on.</p></div><a class="continue" routerLink="/">Continue shopping →</a></div>
        <section class="wishlist-grid" *ngIf="wishlist.items().length; else empty">
          <article class="wish-card" *ngFor="let item of wishlist.items()">
            <a class="image" [routerLink]="['/product', item.id]"><img [src]="imageUrl(item.image)" [alt]="item.name"></a>
            <div class="info">
              <div class="meta"><span>{{item.category}}</span><span>★ {{item.rating || 0}}</span></div>
              <a [routerLink]="['/product', item.id]"><h2>{{item.name}}</h2></a>
              <div class="price"><strong>₹{{(item.salePrice || item.price) | number}}</strong><del *ngIf="item.oldPrice">₹{{item.oldPrice | number}}</del></div>
              <div class="actions">
                <button type="button" class="cart" [disabled]="!item.stock" (click)="addToCart(item)">{{item.stock ? 'Add to cart' : 'Out of stock'}}</button>
                <button type="button" class="remove" (click)="remove(item)">Remove</button>
              </div>
            </div>
          </article>
        </section>
        <ng-template #empty>
          <section class="empty"><div class="heart">♡</div><h2>Your wishlist is empty</h2><p>Save products here to find them quickly later.</p><a routerLink="/">Start shopping →</a></section>
        </ng-template>
      </div>
    </main>
  `,
  styles: [`
    .page{min-height:70vh;background:#f7f7f5}.top{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:28px}.eyebrow{font-size:10px;letter-spacing:.14em;font-weight:900;color:#777}.top h1{margin:6px 0 8px;font-size:44px;letter-spacing:-.04em}.top p{margin:0;color:#777}.continue{border:1px solid #ddd;background:#fff;border-radius:999px;padding:12px 16px;font-weight:800;text-decoration:none;color:#111;white-space:nowrap}.wishlist-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}.wish-card{background:#fff;border:1px solid #e8e8e3;border-radius:18px;overflow:hidden;min-width:0}.image{display:block;aspect-ratio:1/1;background:#f1f1ee;overflow:hidden}.image img{width:100%;height:100%;object-fit:cover;display:block}.info{padding:13px}.meta{display:flex;justify-content:space-between;color:#777;font-size:10px;text-transform:uppercase;letter-spacing:.07em}.info h2{font-size:17px;margin:8px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.price{display:flex;align-items:center;gap:8px}.price strong{font-size:17px}.price del{color:#999;font-size:12px}.actions{display:flex;gap:8px;margin-top:14px}.cart,.remove{flex:1;border-radius:999px;padding:9px 10px;font-size:11px;font-weight:800;cursor:pointer}.cart{border:1px solid #111;background:#111;color:#fff}.cart:disabled{opacity:.45;cursor:not-allowed}.remove{border:1px solid #ddd;background:#fff;color:#222}.empty{text-align:center;background:#fff;border:1px solid #e8e8e3;border-radius:20px;padding:70px 20px}.heart{font-size:64px;line-height:1;margin-bottom:12px}.empty h2{margin:0 0 8px;font-size:28px}.empty p{color:#777;margin:0 0 20px}.empty a{display:inline-flex;border-radius:999px;background:#111;color:#fff;padding:11px 18px;font-weight:800;text-decoration:none}@media(max-width:1000px){.wishlist-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:700px){.top{align-items:flex-start;flex-direction:column}.top h1{font-size:34px}.wishlist-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.actions{flex-direction:column}}@media(max-width:430px){.wishlist-grid{grid-template-columns:1fr}}
  `]
})
export class WishlistComponent {
  readonly wishlist = inject(WishlistService);
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);

  constructor() {
    void this.wishlist.load();
  }

  async remove(item: WishlistProduct) {
    const removed = await this.wishlist.remove(item.id);
    if (!removed) {
      await this.wishlist.load();
    }
  }

  async addToCart(item: WishlistProduct) {
    this.cart.add({
      id: item.id,
      name: item.name,
      category: item.category,
      subcategory: item.subcategory || '',
      price: Number(item.price || 0),
      oldPrice: Number(item.oldPrice || 0),
      salePrice: item.salePrice ?? undefined,
      image: item.image || '',
      stock: Number(item.stock || 0),
      rating: Number(item.rating || 0),
      reviews: Number(item.reviews || 0),
      tags: [],
      colors: [],
      sizes: []
    } as any);
    await this.router.navigateByUrl('/cart');
  }

  imageUrl(url?: string) {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    return url.startsWith('/api/') ? url : '/api' + (url.startsWith('/') ? url : '/' + url);
  }
}
