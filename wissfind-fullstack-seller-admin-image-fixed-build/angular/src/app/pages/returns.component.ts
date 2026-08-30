import { Component, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RefundService, RefundTracking } from '../core/refund.service';
import { BackendApiService } from '../core/backend-api.service';
import { ChangeDetectorRef, OnDestroy, OnInit } from '@angular/core';

@Component({
  selector: 'app-returns',
  standalone: true,
  imports: [CommonModule, DecimalPipe, RouterLink],
  template: `
  <main class="page"><div class="container">
    <section class="hero">
      <div>
        <span class="eyebrow">AFTER-SALES</span>
        <h1>Returns & refunds center.</h1>
        <p>Track cancellation, return pickup and refund progress from one place.</p>
      </div>
      <a routerLink="/orders" class="hero-link">View my orders →</a>
    </section>

    <div class="filters">
      <button *ngFor="let x of filters" [class.active]="filter===x" (click)="filter=x">{{x}}</button>
    </div>

    <section *ngIf="filtered.length; else empty">
      <article class="return-card" *ngFor="let r of filtered">
        <div class="head">
          <div>
            <span class="eyebrow">{{r.type}}</span>
            <h2>{{r.id}}</h2>
            <p>{{r.product}} · Order {{r.orderId}}</p>
          </div>
          <div class="amount">
            <span>Refund amount</span>
            <strong>₹{{r.refundAmount | number}}</strong>
          </div>
        </div>

        <div class="meta">
          <span><b>Reason:</b> {{r.reason}}</span>
          <span><b>Payment:</b> {{r.paymentMethod}}</span>
        </div>

        <div class="timeline">
          <div *ngFor="let s of r.steps; let i=index" [class.done]="i<=r.current" [class.current]="i===r.current">
            <span>{{i<=r.current ? '✓' : i+1}}</span>
            <b>{{s}}</b>
          </div>
        </div>

        <div class="foot">
          <span>{{r.note}}</span>
          <strong [class.complete]="r.current === r.steps.length - 1">
            {{r.steps[r.current]}}
          </strong>
        </div>
      </article>
    </section>

    <div class="pagination" *ngIf="totalPages > 1"><button (click)="prevPage()" [disabled]="page<=1">← Prev</button><span>Page {{page}} of {{totalPages}}</span><button (click)="nextPage()" [disabled]="page>=totalPages">Next →</button></div>

    <ng-template #empty>
      <div class="empty card">
        <div class="empty-icon">↩</div>
        <h2>No refund requests yet</h2>
        <p>When you cancel an order or request a return, its refund status will appear here automatically.</p>
        <a routerLink="/orders" class="btn">Go to orders</a>
      </div>
    </ng-template>
  </div></main>`,
  styles: [`
    .pagination{display:flex;justify-content:center;align-items:center;gap:12px;padding:18px}.pagination button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:9px 14px;font-weight:700}.pagination button:disabled{opacity:.45}.hero{background:#111;color:#fff;border-radius:24px;padding:35px;margin-bottom:18px;display:flex;justify-content:space-between;gap:20px;align-items:end}
    .hero h1{font-size:42px;margin:9px 0}.hero p{color:#bbb}.hero .eyebrow{color:#aaa}
    .hero-link{color:#fff;border:1px solid #444;border-radius:999px;padding:10px 15px;font-size:12px;font-weight:800;white-space:nowrap}
    .filters{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}.filters button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:9px 14px;cursor:pointer}.filters button.active{background:#111;color:#fff}
    .return-card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:20px;margin-bottom:12px}
    .head{display:flex;justify-content:space-between;gap:15px}.head h2{margin:6px 0;font-size:18px}.head p{font-size:12px;color:#777}.amount{display:grid;text-align:right;gap:4px}.amount span{font-size:10px;color:#888;text-transform:uppercase}.amount strong{font-size:20px}
    .meta{display:flex;gap:22px;flex-wrap:wrap;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:12px 0;margin-top:15px;font-size:12px;color:#666}.meta b{color:#111}
    .timeline{display:flex;gap:0;margin:22px 0;overflow:auto;padding-bottom:3px}.timeline>div{position:relative;display:grid;gap:7px;min-width:145px;color:#aaa;font-size:11px}.timeline>div:not(:last-child):after{content:'';position:absolute;top:12px;left:25px;width:120px;height:2px;background:#ddd}.timeline>div.done{color:#111}.timeline>div.done:not(:last-child):after{background:#111}.timeline span{position:relative;z-index:1;width:25px;height:25px;border-radius:50%;background:#eee;display:grid;place-items:center;font-weight:800}.timeline .done span{background:#111;color:#fff}.timeline .current b{font-weight:900}
    .foot{border-top:1px solid var(--line);padding-top:13px;display:flex;justify-content:space-between;gap:15px;font-size:12px;color:#666}.foot strong{color:#9a6200}.foot strong.complete{color:var(--success)}
    .empty{text-align:center;padding:70px 20px}.empty-icon{font-size:32px;color:#999}.empty h2{margin:12px 0 7px}.empty p{max-width:520px;margin:0 auto 20px;color:#777}.btn{display:inline-flex;text-decoration:none;padding:11px 16px;background:#111;color:#fff;border-radius:999px;font-weight:800;font-size:12px}
    @media(max-width:650px){.hero,.head,.foot{flex-direction:column;align-items:flex-start}.hero h1{font-size:32px}.amount{text-align:left}.timeline>div{min-width:120px}.timeline>div:not(:last-child):after{width:95px}}
  `]
})
export class ReturnsComponent implements OnInit, OnDestroy {
  private readonly refundService = inject(RefundService);
  private readonly api = inject(BackendApiService);
  private readonly cdr = inject(ChangeDetectorRef);
  private abort = new AbortController();
  filters = ['All', 'Return', 'Cancellation'];
  filter = 'All';
  dbReturns: RefundTracking[] = [];
  page = 1; totalPages = 1; total = 0; readonly pageSize = 10;
  ngOnInit(){ void this.loadPage(); }
  ngOnDestroy(){ this.abort.abort(); }
  get filtered(): RefundTracking[] { return this.dbReturns; }
  async loadPage(){
    this.abort.abort(); this.abort=new AbortController();
    try{
      // ReturnRequest rows are DB-backed. Cancellation tracking remains in RefundService for legacy requests.
      const f = this.filter;
      const data:any = await this.api.get(`/returns/mine/paged?page=${this.page-1}&size=${this.pageSize}&filter=${encodeURIComponent(f)}`,this.abort.signal);
      if(this.abort.signal.aborted)return;
      this.dbReturns=(Array.isArray(data?.content)?data.content:[]).map((r:any)=>this.mapReturn(r));
      this.total=Number(data?.totalElements||0); this.totalPages=Math.max(1,Number(data?.totalPages||1));
      this.cdr.detectChanges();
    }catch(e:any){ if(e?.name!=='AbortError'&&!this.abort.signal.aborted){this.dbReturns=[];this.total=0;this.totalPages=1;this.cdr.detectChanges();} }
  }
  private mapReturn(r:any):RefundTracking{
    const status=String(r.status||'REQUESTED');
    const isCancellation=String(r.requestType||'RETURN')==='CANCELLATION'; const steps:any[]=isCancellation?['Requested','Approved','Refund initiated','Refund completed']:['Requested','Approved','Pickup scheduled','Picked up','Refund initiated','Refund completed'];
    const idxMap:any=isCancellation?{REQUESTED:0,APPROVED:1,REFUND_INITIATED:2,REFUND_COMPLETED:3,REJECTED:0}:{REQUESTED:0,APPROVED:1,PICKUP_SCHEDULED:2,PICKED_UP:3,REFUND_INITIATED:4,REFUND_COMPLETED:5,REJECTED:0};
    const current=Number(idxMap[status]??0);
    return {id:String(r.id),type:String(r.requestType||'RETURN')==='CANCELLATION'?'Cancellation':'Return',orderId:String(r.order?.orderNumber||r.order?.id||'—'),product:String(r.order?.items?.[0]?.name||'Order item'),amount:Number(r.order?.total||0),refundAmount:Number(r.refundAmount||0),paymentMethod:String(r.order?.paymentStatus||'—'),reason:String(r.reason||'—'),note:status==='REFUND_COMPLETED'?'Refund completed.':'Return request is being processed.',current,steps,createdAt:String(r.createdAt||'')};
  }
  prevPage(){if(this.page>1){this.page--;void this.loadPage();}}
  nextPage(){if(this.page<this.totalPages){this.page++;void this.loadPage();}}
}
