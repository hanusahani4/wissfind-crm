import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ProductService } from '../core/product.service';
import { Product } from '../core/product.model';

@Component({
 selector:'app-price-alerts', standalone:true, imports:[CommonModule,DecimalPipe],
 template:`<main class="page"><div class="container">
 <section class="hero"><span class="eyebrow">PRICE INTELLIGENCE</span><h1>Price history & alerts.</h1><p>See whether today's price is good and set a target alert.</p></section>
 <div class="grid">
  <article class="card" *ngFor="let p of productsView">
   <img [src]="p.image" [alt]="p.name"><div class="body"><span class="eyebrow">{{p.category}}</span><h2>{{p.name}}</h2>
   <div class="price">₹{{p.price|number}} <del *ngIf="p.oldPrice">₹{{p.oldPrice|number}}</del></div>
   <div class="chart"><span *ngFor="let v of history(p);let i=index" [style.height.%]="v"></span></div>
   <div class="stats"><span>30-day avg <b>₹{{average(p)|number}}</b></span><span>Lowest <b>₹{{lowest(p)|number}}</b></span></div>
   <div class="good" [class.warn]="p.price>average(p)">{{p.price<=average(p)?'🟢 Good time to buy':'🟡 Price is above recent average'}}</div>
   <div class="alert"><input type="number" [value]="targets[p.id] || lowest(p)" #target><button (click)="setAlert(p,target.value)">Alert me</button></div>
   <small *ngIf="alerts[p.id]">Alert set below ₹{{alerts[p.id]|number}}</small>
   </div>
  </article>
 </div><div class="pagination" *ngIf="totalPages > 1"><button (click)="prevPage()" [disabled]="page<=1">← Prev</button><span>Page {{page}} of {{totalPages}}</span><button (click)="nextPage()" [disabled]="page>=totalPages">Next →</button></div></div></main>`,
 styles:[`.pagination{display:flex;justify-content:center;align-items:center;gap:12px;padding:20px}.pagination button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:9px 14px;font-weight:700}.pagination button:disabled{opacity:.45}.hero{background:#111;color:#fff;border-radius:24px;padding:35px;margin-bottom:18px}.hero h1{font-size:42px;margin:9px 0}.hero p{color:#bbb}.eyebrow{font-size:10px;letter-spacing:.14em;font-weight:800;color:#777}.hero .eyebrow{color:#aaa}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card{background:#fff;border:1px solid var(--line);border-radius:20px;overflow:hidden}.card img{width:100%;aspect-ratio:1.2;object-fit:cover}.body{padding:18px}.body h2{font-size:18px;margin:7px 0}.price{font-size:22px;font-weight:900}.price del{font-size:12px;color:#999;margin-left:6px}.chart{height:75px;display:flex;align-items:flex-end;gap:4px;margin:18px 0}.chart span{flex:1;background:#111;border-radius:4px 4px 0 0;min-height:8px}.stats{display:flex;justify-content:space-between;font-size:11px;color:#777}.stats b{display:block;color:#111;margin-top:4px}.good{margin:14px 0;padding:10px;border-radius:9px;background:#eef9ef;font-size:12px}.good.warn{background:#fff6df}.alert{display:flex;gap:7px}.alert input{width:100%;border:1px solid var(--line);border-radius:999px;padding:10px}.alert button{border:0;border-radius:999px;background:#111;color:#fff;padding:10px 13px;font-weight:800}.body>small{display:block;color:#555;margin-top:8px}@media(max-width:850px){.grid{grid-template-columns:1fr 1fr}}@media(max-width:550px){.grid{grid-template-columns:1fr}}`]
})


export class PriceAlertsComponent implements OnDestroy {
  private productService = inject(ProductService);
  products: Product[] = [];
  targets: Record<string, number> = {};
  alerts: Record<string, number> = {};
  page = 1; totalPages = 1; total = 0; readonly pageSize = 10;
  private pageAbort = new AbortController();

  constructor() { void this.loadPage(); }

  get productsView(): Product[] { return this.products; }
  ngOnDestroy() { this.pageAbort.abort(); }
  async loadPage() {
    this.pageAbort.abort(); this.pageAbort = new AbortController();
    const r = await this.productService.loadPage(this.page - 1, this.pageSize, '', this.pageAbort.signal);
    if (this.pageAbort.signal.aborted) return;
    this.products = r.items; this.total = r.total; this.totalPages = r.totalPages;
  }
  prevPage(){ if(this.page>1){this.page--;void this.loadPage();} }
  nextPage(){ if(this.page<this.totalPages){this.page++;void this.loadPage();} }

  history(p: Product): number[] {
    const base = p.oldPrice ?? Math.round(p.price * 1.12);
    const values = [1.08, 1.04, 1.12, 1.02, 1.06, .98, 1.01, .95, 1.03, .99];
    return values.map((x, i) => Math.max(18, Math.min(100, (base * x / base) * 72 + (i % 3) * 5)));
  }

  average(p: Product): number {
    const base = p.oldPrice ?? Math.round(p.price * 1.12);
    return Math.round((base + p.price) / 2);
  }

  lowest(p: Product): number {
    return Math.round(p.price * 0.92);
  }

  setAlert(p: Product, value: string) {
    const target = Number(value);
    if (Number.isFinite(target) && target > 0) {
      this.targets[p.id] = target;
      this.alerts[p.id] = target;
    }
  }
}
