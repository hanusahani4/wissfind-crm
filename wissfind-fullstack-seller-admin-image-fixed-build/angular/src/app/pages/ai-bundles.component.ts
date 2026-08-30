import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ProductService } from '../core/product.service';
import { CartService } from '../core/cart.service';
import { Product } from '../core/product.model';

@Component({
 selector:'app-ai-bundles', standalone:true, imports:[CommonModule,DecimalPipe,RouterLink],
 template:`<main class="page"><div class="container">
 <section class="hero"><span class="eyebrow">AI CURATED BUNDLES</span><h1>Complete your look or setup.</h1><p>WissFind AI combines products that make sense together — fashion looks or gaming setups.</p>
 <div class="switch"><button [class.active]="mode==='look'" (click)="mode='look'">👕 Complete my look</button><button [class.active]="mode==='setup'" (click)="mode='setup'">🎮 Complete my setup</button></div></section>
 <section class="bundle">
  <div class="bundle-copy"><span class="eyebrow">{{mode==='look'?'AI STYLE':'AI GAMING'}}</span><h2>{{mode==='look'?'Everyday city look':'College + Gaming setup'}}</h2><p>{{mode==='look'?'Balanced pieces for a clean everyday outfit.':'A practical setup for classes, coding and gaming.'}}</p>
   <div class="ai-score">AI MATCH <strong>{{mode==='look'?'94':'92'}}/100</strong></div>
  </div>
  <div class="products"><article *ngFor="let p of bundle"><img [src]="p.image" [alt]="p.name"><div><strong>{{p.name}}</strong><span>₹{{p.price|number}}</span></div><a [routerLink]="['/product',p.id]">View</a></article></div>
  <div class="bundle-footer"><strong>Bundle total ₹{{total|number}}</strong><span>You save {{savings|number}} with current prices</span><button (click)="addAll()">Add complete {{mode==='look'?'look':'setup'}} →</button></div>
 </section>
 </div></main>`,
 styles:[`.hero{background:#111;color:#fff;border-radius:24px;padding:35px;margin-bottom:18px}.hero h1{font-size:42px;margin:9px 0}.hero p{color:#bbb}.eyebrow{font-size:10px;letter-spacing:.14em;font-weight:800;color:#777}.hero .eyebrow{color:#aaa}.switch{display:flex;gap:8px;margin-top:24px}.switch button{border:1px solid #444;background:#222;color:#fff;border-radius:999px;padding:10px 14px}.switch button.active{background:#fff;color:#111}.bundle{background:#fff;border:1px solid var(--line);border-radius:22px;padding:25px}.bundle-copy{border-bottom:1px solid var(--line);padding-bottom:18px}.bundle-copy h2{font-size:30px;margin:8px 0}.bundle-copy p{color:#777}.ai-score{display:inline-flex;gap:8px;background:#f5f5f3;padding:8px 11px;border-radius:999px;font-size:10px}.products{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:20px 0}.products article{border:1px solid var(--line);border-radius:15px;overflow:hidden}.products img{width:100%;aspect-ratio:1;object-fit:cover}.products article>div{padding:10px;display:flex;justify-content:space-between;gap:7px;font-size:12px}.products article span{font-weight:800}.products a{display:block;padding:0 10px 11px;font-size:11px}.bundle-footer{border-top:1px solid var(--line);padding-top:18px;display:flex;align-items:center;gap:16px}.bundle-footer>strong{font-size:20px}.bundle-footer span{color:#777;font-size:12px}.bundle-footer button{margin-left:auto;background:#111;color:#fff;border:0;border-radius:999px;padding:12px 16px;font-weight:800}@media(max-width:750px){.products{grid-template-columns:1fr 1fr}.bundle-footer{flex-wrap:wrap}.bundle-footer button{margin-left:0}}@media(max-width:450px){.products{grid-template-columns:1fr}}`]
})
export class AiBundlesComponent implements OnDestroy {
 private ps=inject(ProductService); private cart=inject(CartService); private router=inject(Router);
 mode:'look'|'setup'='look';
 private readonly pageAbort = new AbortController();
 constructor(){ void this.ps.load(this.pageAbort.signal); }
 ngOnDestroy(){ this.pageAbort.abort(); }
 get bundle():Product[]{
  if(this.mode==='look'){
   const ids=['overshirt-01','sneaker-01','watch-01','bag-01'];
   return ids.map(id=>this.ps.products.find(p=>p.id===id)).filter(Boolean) as Product[];
  }
  const ids=['gaming-laptop-01','gaming-mouse-01','gaming-keyboard-01','gaming-headset-01'];
  return ids.map(id=>this.ps.products.find(p=>p.id===id)).filter(Boolean) as Product[];
 }
 get total(){return this.bundle.reduce((s,p)=>s+p.price,0)}
 get savings(){return this.bundle.reduce((s,p)=>s+(p.oldPrice?p.oldPrice-p.price:0),0)}
 async addAll(){this.bundle.forEach(p=>this.cart.add(p));await this.router.navigateByUrl('/cart');}
}
