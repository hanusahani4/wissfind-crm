import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductService } from '../core/product.service';
import { Product } from '../core/product.model';
import { CartService } from '../core/cart.service';

@Component({
 selector:'app-compare', standalone:true, imports:[CommonModule,DecimalPipe,RouterLink],
 template:`<main class="page"><div class="container">
 <div class="hero"><span class="eyebrow">SMART COMPARISON</span><h1>Compare products with AI.</h1><p>See price, rating, value and practical differences side by side.</p></div>
 <div class="picker"><button *ngFor="let p of productsView" [class.selected]="selectedIds.includes(p.id)" (click)="toggle(p.id)">{{p.name}} <span>₹{{p.price|number}}</span></button></div>
 <section class="table-card" *ngIf="selected.length">
  <div class="table-wrap"><table><thead><tr><th>Feature</th><th *ngFor="let p of selected">{{p.name}}<a [routerLink]="['/product',p.id]">View</a></th></tr></thead>
  <tbody>
   <tr><td>Price</td><td *ngFor="let p of selected"><strong>₹{{p.price|number}}</strong></td></tr>
   <tr><td>Rating</td><td *ngFor="let p of selected">★ {{p.rating}} <small>({{p.reviews}})</small></td></tr>
   <tr><td>Category</td><td *ngFor="let p of selected">{{p.category}} · {{p.subcategory}}</td></tr>
   <tr><td>AI value score</td><td *ngFor="let p of selected"><strong>{{score(p)}}/100</strong></td></tr>
   <tr><td>Best for</td><td *ngFor="let p of selected">{{bestFor(p)}}</td></tr>
   <tr><td>Tags</td><td *ngFor="let p of selected">{{p.tags.join(' · ')}}</td></tr>
  </tbody></table></div>
  <div class="verdict"><span class="eyebrow">AI VERDICT</span><h2>{{verdict}}</h2><p>{{verdictText}}</p></div>
 </section>
 <div class="pagination" *ngIf="totalPages > 1"><button (click)="prevPage()" [disabled]="page<=1">← Prev</button><span>Page {{page}} of {{totalPages}}</span><button (click)="nextPage()" [disabled]="page>=totalPages">Next →</button></div>
 <div class="empty" *ngIf="!selected.length"><h2>Select 2–4 products</h2><p>Pick products above to start a comparison.</p></div>
 </div></main>`,
 styles:[`.pagination{display:flex;justify-content:center;align-items:center;gap:12px;padding:18px}.pagination button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:9px 14px;font-weight:700}.pagination button:disabled{opacity:.45}.hero{background:#111;color:#fff;border-radius:24px;padding:35px;margin-bottom:18px}.hero h1{font-size:42px;margin:9px 0}.hero p{color:#bbb}.eyebrow{font-size:10px;letter-spacing:.14em;font-weight:800;color:#777}.hero .eyebrow{color:#aaa}.picker{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}.picker button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:10px 14px;cursor:pointer}.picker button.selected{background:#111;color:#fff}.picker span{opacity:.7;margin-left:7px}.table-card{background:#fff;border:1px solid var(--line);border-radius:20px;overflow:hidden}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:720px}th,td{padding:16px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top;font-size:13px}th{background:#fafaf8;font-size:14px}th a{display:block;font-size:11px;margin-top:7px}.verdict{padding:22px;background:#f7f7f5}.verdict h2{margin:7px 0;font-size:25px}.verdict p{color:#666;line-height:1.6}.empty{text-align:center;padding:70px}.empty p{color:#777}`]
})


export class CompareComponent implements OnDestroy {
  private productService = inject(ProductService);
  products: Product[] = [];
  selectedIds: string[] = [];
  private selectedMap = new Map<string, Product>();
  page = 1; totalPages = 1; total = 0; readonly pageSize = 10;
  private pageAbort = new AbortController();

  constructor() { void this.loadPage(); }

  ngOnDestroy() { this.pageAbort.abort(); }

  get productsView(): Product[] { return this.products; }

  get selected(): Product[] {
    return this.selectedIds.map(id => this.selectedMap.get(id)).filter((p): p is Product => !!p);
  }
  async loadPage(){
    this.pageAbort.abort(); this.pageAbort=new AbortController();
    const r=await this.productService.loadPage(this.page-1,this.pageSize,'',this.pageAbort.signal);
    if(this.pageAbort.signal.aborted)return;
    this.products=r.items; this.total=r.total; this.totalPages=r.totalPages;
  }
  prevPage(){if(this.page>1){this.page--;void this.loadPage();}}
  nextPage(){if(this.page<this.totalPages){this.page++;void this.loadPage();}}

  toggle(id: string) {
    const product = this.products.find(p => p.id === id);
    if (this.selectedIds.includes(id)) {
      this.selectedIds = this.selectedIds.filter(x => x !== id);
      this.selectedMap.delete(id);
    } else if (this.selectedIds.length < 4) {
      this.selectedIds = [...this.selectedIds, id];
      if (product) this.selectedMap.set(id, product);
    }
  }

  score(p: Product): number {
    return Math.min(99, Math.round(p.rating * 18 + Math.min(p.reviews, 300) / 15));
  }

  bestFor(p: Product): string {
    if (p.category === 'Fashion') return p.subcategory === 'Footwear' ? 'Daily wear & travel' : 'Everyday style';
    return p.tags.some(t => t.toLowerCase().includes('gaming')) ? 'Gaming & performance' : 'Study, work & entertainment';
  }

  get verdict(): string {
    if (!this.selected.length) return '';
    return this.selected.reduce((best, p) => this.score(p) > this.score(best) ? p : best).name + ' is the strongest overall pick.';
  }

  get verdictText(): string {
    if (!this.selected.length) return '';
    const best = this.selected.reduce((a, b) => this.score(a) >= this.score(b) ? a : b);
    return `Based on rating, review volume and current value, ${best.name} leads this comparison.`;
  }
}
