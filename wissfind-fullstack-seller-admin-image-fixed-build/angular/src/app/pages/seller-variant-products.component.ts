import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { BackendApiService } from '../core/backend-api.service';
import { ProductVariantsComponent } from './product-variants.component';

@Component({
  standalone: true,
  selector: 'app-seller-variant-products',
  imports: [CommonModule, ProductVariantsComponent],
  template: `
    <main class="page">
      <div class="head"><div><h1>Product variants</h1><p>Manage Flipkart-style color, size, SKU, stock and color-specific images.</p></div></div>
      <div class="layout">
        <aside class="products">
          <button *ngFor="let product of products" [class.active]="selected?.id===product.id" (click)="select(product)">
            <img *ngIf="product.image" [src]="imageUrl(product.image)"><span><b>{{product.name}}</b><small>{{product.sku}}</small></span>
          </button>
          <div class="empty" *ngIf="!products.length">No products found.</div>
        </aside>
        <section class="editor" *ngIf="selected"><h2>{{selected.name}}</h2><app-product-variants [productId]="selected.id"></app-product-variants></section>
        <section class="empty editor" *ngIf="!selected">Select a product to manage variants.</section>
      </div>
    </main>
  `,
  styles: [`
    .page{min-height:100vh;background:#f7f7f4;padding:28px;box-sizing:border-box;color:#171717}.head{max-width:1400px;margin:0 auto 20px}.head h1{margin:0 0 6px}.head p{margin:0;color:#777}.layout{max-width:1400px;margin:auto;display:grid;grid-template-columns:310px minmax(0,1fr);gap:18px;align-items:start}.products,.editor{background:#fff;border:1px solid #e6e8eb;border-radius:14px;padding:14px}.products{display:grid;gap:7px;position:sticky;top:20px}.products button{display:flex;align-items:center;gap:10px;border:1px solid transparent;background:#fff;border-radius:10px;padding:9px;text-align:left;cursor:pointer}.products button:hover,.products button.active{border-color:#111;background:#fafafa}.products img{width:48px;height:48px;object-fit:cover;border-radius:7px}.products span{min-width:0}.products b,.products small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.products small{color:#777;margin-top:3px}.editor h2{margin:0 0 8px}.empty{color:#888;text-align:center;padding:30px}@media(max-width:850px){.page{padding:15px}.layout{grid-template-columns:1fr}.products{position:static}}
  `]
})
export class SellerVariantProductsComponent {
  private api = inject(BackendApiService);
  products: any[] = [];
  selected: any = null;
  async ngOnInit() { try { this.products = await this.api.get<any[]>('/products/seller') || []; } catch { this.products = []; } }
  select(product: any) { this.selected = product; }
  imageUrl(v: string) { return !v ? '' : /^https?:\/\//.test(v) ? v : `http://localhost:8080${v.startsWith('/')?'':'/'}${v}`; }
}
