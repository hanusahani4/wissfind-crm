import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, ChangeDetectorRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BackendApiService } from '../core/backend-api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe, RouterLink],
  template: `
    <main class="page">
      <div class="container">
        <div class="top"><div><div class="eyebrow">ADMIN</div><h1>Homepage Management</h1><p class="muted">Control how products are selected for the customer homepage.</p></div><a routerLink="/admin" class="back">← Admin Panel</a></div>

        <section class="panel">
          <h2>Selection mode</h2>
          <div class="modes">
            <label *ngFor="let m of modes" class="mode" [class.active]="config.mode===m.value"><input type="radio" name="mode" [value]="m.value" [(ngModel)]="config.mode"> <span><b>{{m.label}}</b><small>{{m.help}}</small></span></label>
          </div>
        </section>

        <section class="panel" *ngIf="config.mode!=='MANUAL'">
          <div class="section-title"><div><h2>Automatic signals</h2><p class="muted">Backend ranks live products using Orders, Ratings and Views.</p></div><span class="total">{{weightTotal()}}%</span></div>
          <div class="weights">
            <label>Orders <input type="number" min="0" max="100" [(ngModel)]="config.ordersWeight"><b>{{percent(config.ordersWeight)}}%</b></label>
            <label>Ratings <input type="number" min="0" max="100" [(ngModel)]="config.ratingsWeight"><b>{{percent(config.ratingsWeight)}}%</b></label>
            <label>Views <input type="number" min="0" max="100" [(ngModel)]="config.viewsWeight"><b>{{percent(config.viewsWeight)}}%</b></label>
          </div>
          <p class="hint">Weights are normalized by the backend when you save.</p>
        </section>

        <section class="panel">
          <div class="section-title"><div><h2>{{config.mode==='AUTOMATIC'?'Live ranking preview':'Manual homepage products'}}</h2><p class="muted">{{config.mode==='AUTOMATIC'?'These are the products currently available to the ranking engine.':'Select products and arrange their priority. Hybrid mode uses this order as an additional boost.'}}</p></div><button class="secondary" type="button" (click)="load()">Refresh</button></div>
          <div class="list" *ngIf="products.length">
            <div class="product" *ngFor="let p of products; let i=index" [class.selected]="selected(p.id)">
              <label class="pick" *ngIf="config.mode!=='AUTOMATIC'"><input type="checkbox" [checked]="selected(p.id)" (change)="toggle(p.id)"></label>
              <img *ngIf="p.image" [src]="imageUrl(p.image)" [alt]="p.name">
              <div class="info"><b>{{p.name}}</b><small>{{p.category}} · ₹{{p.price|number}}</small><small>Orders {{p.sales}} · Rating {{p.rating||0}} ({{p.reviews||0}}) · Views {{p.views||0}}</small></div>
              <div class="move" *ngIf="config.mode!=='AUTOMATIC' && selected(p.id)"><button type="button" (click)="move(i,-1)" [disabled]="i===0">↑</button><button type="button" (click)="move(i,1)" [disabled]="i===products.length-1">↓</button></div>
            </div>
          </div>
          <div class="empty" *ngIf="!products.length">No live in-stock products found.</div>
        </section>

        <div class="actions"><span class="status" *ngIf="message">{{message}}</span><button class="primary" type="button" (click)="save()" [disabled]="saving">{{saving?'Saving...':'Save Homepage Settings'}}</button></div>
      </div>
    </main>
  `,
  styles: [`
    :host{display:block;background:#f7f7f4;min-height:100vh;color:#171717}.page{padding:30px 0 70px}.container{width:calc(100% - 32px);max-width:1200px;margin:auto}.top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:22px}.eyebrow{font-size:11px;letter-spacing:.12em;color:#777;font-weight:800}h1{font:700 38px "Space Grotesk",sans-serif;margin:6px 0}.muted{color:#777}.back,.secondary{border:1px solid #ddd;background:#fff;border-radius:999px;padding:10px 14px;font-weight:700;white-space:nowrap}.panel{background:#fff;border:1px solid #e7e7e4;border-radius:16px;padding:20px;margin-bottom:16px}h2{font:700 20px "Space Grotesk",sans-serif;margin:0 0 6px}.modes{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px}.mode{display:flex;gap:10px;border:1px solid #e3e3df;border-radius:13px;padding:15px;cursor:pointer}.mode.active{border-color:#111;box-shadow:0 0 0 1px #111}.mode span{display:grid;gap:4px}.mode small{color:#777;line-height:1.35}.section-title{display:flex;justify-content:space-between;gap:15px;align-items:flex-start}.total{font-weight:800;font-size:18px}.weights{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px}.weights label{display:grid;gap:7px;font-size:12px;font-weight:800}.weights input{border:1px solid #ddd;border-radius:9px;padding:10px}.weights b{font-size:11px;color:#777}.hint{font-size:11px;color:#888}.list{display:grid;gap:8px;margin-top:16px}.product{display:grid;grid-template-columns:34px 58px minmax(0,1fr) auto;gap:12px;align-items:center;border:1px solid #ecece8;border-radius:11px;padding:9px}.product.selected{border-color:#bbb}.product img{width:58px;height:64px;object-fit:cover;border-radius:8px;background:#eee}.pick{display:grid;place-items:center}.info{min-width:0;display:grid;gap:3px}.info b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.info small{font-size:11px;color:#777}.move{display:flex;gap:5px}.move button{width:32px;height:32px;border:1px solid #ddd;background:#fff;border-radius:8px}.move button:disabled{opacity:.35}.actions{display:flex;justify-content:flex-end;align-items:center;gap:12px}.primary{border:0;background:#111;color:#fff;border-radius:10px;padding:12px 16px;font-weight:800}.primary:disabled{opacity:.5}.status{color:#19744a;font-size:13px}.empty{text-align:center;color:#888;padding:30px}.@media(max-width:800px){.modes,.weights{grid-template-columns:1fr}.top{flex-direction:column}h1{font-size:32px}.product{grid-template-columns:30px 50px minmax(0,1fr);}.product img{width:50px;height:56px}.move{grid-column:3}.container{width:calc(100% - 20px)}}
  `]
})
export class HomepageManagementComponent {
  private readonly api=inject(BackendApiService);
  private readonly cdr=inject(ChangeDetectorRef);
  readonly modes=[
    {value:'AUTOMATIC',label:'Automatic',help:'Use live orders, ratings and views.'},
    {value:'MANUAL',label:'Manual',help:'Admin chooses and orders products.'},
    {value:'HYBRID',label:'Hybrid',help:'Automatic ranking plus admin priority.'}
  ];
  config:any={mode:'AUTOMATIC',manualProductIds:'',ordersWeight:50,ratingsWeight:30,viewsWeight:20};
  products:any[]=[]; saving=false; message='';

  constructor(){void this.load();}

  async load(){
    try{const [c,p]:any[]=await Promise.all([this.api.get('/homepage/config'),this.api.get('/homepage/candidates')]);this.config={...this.config,...c,ordersWeight:Number(c.ordersWeight)*100,ratingsWeight:Number(c.ratingsWeight)*100,viewsWeight:Number(c.viewsWeight)*100};this.products=p||[];this.cdr.markForCheck();}catch{this.message='Unable to load homepage settings';this.cdr.markForCheck();}
  }

  selected(id:number){return this.manualIds().includes(Number(id));}
  manualIds():number[]{return String(this.config.manualProductIds||'').split(',').map(x=>Number(x.trim())).filter(x=>Number.isFinite(x)&&x>0)}
  toggle(id:number){const ids=this.manualIds();const n=Number(id);const at=ids.indexOf(n);if(at>=0)ids.splice(at,1);else ids.push(n);this.config.manualProductIds=ids.join(',');}
  move(productIndex:number,direction:number){const ids=this.manualIds();const id=Number(this.products[productIndex]?.id);const at=ids.indexOf(id);if(at<0)return;const next=at+direction;if(next<0||next>=ids.length)return;[ids[at],ids[next]]=[ids[next],ids[at]];this.config.manualProductIds=ids.join(',');}
  percent(v:any){return Math.round(Number(v)||0)}
  weightTotal(){return this.percent(this.config.ordersWeight)+this.percent(this.config.ratingsWeight)+this.percent(this.config.viewsWeight)}
  imageUrl(v:string){return !v?'':/^https?:\/\//i.test(v)?v:`http://localhost:8080${v.startsWith('/')?'':'/'}${v}`}
  async save(){this.saving=true;this.message='';try{const body={...this.config,ordersWeight:(Number(this.config.ordersWeight)||0)/100,ratingsWeight:(Number(this.config.ratingsWeight)||0)/100,viewsWeight:(Number(this.config.viewsWeight)||0)/100};const saved:any=await this.api.put('/homepage/config',body);this.config={...this.config,...saved,ordersWeight:Number(saved.ordersWeight)*100,ratingsWeight:Number(saved.ratingsWeight)*100,viewsWeight:Number(saved.viewsWeight)*100};this.message='Homepage settings saved';}catch(e:any){this.message=e?.error?.error||'Unable to save homepage settings';}finally{this.saving=false;this.cdr.markForCheck();}}
}
