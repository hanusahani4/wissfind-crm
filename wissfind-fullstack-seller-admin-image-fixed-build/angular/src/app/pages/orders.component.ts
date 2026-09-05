import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { DecimalPipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CartService } from '../core/cart.service';
import { RefundService } from '../core/refund.service';
import { BackendApiService } from '../core/backend-api.service';

type OrderStatus = 'Delivered' | 'Shipped' | 'Processing' | 'Cancelled';
type OrderCountKey = 'All' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';

type RequestType = 'cancel' | 'return';

interface OrderItem {
  id: number;
  name: string;
  category: string;
  image: string;
  quantity: number;
  price: number;
  variant?: string;
}

interface Order {
  id: string;
  date: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  gst: number;
  platformFee: number;
  handlingFee: number;
  convenienceFee: number;
  total: number;
  payment: string;
  deliveryDate?: string;
  address: string;
  cancelRequested?: boolean;
  returnRequested?: boolean;
  returnReason?: string;
  _backendId?: number;
}

@Component({
  standalone: true,
  imports: [NgIf, NgFor, DecimalPipe, RouterLink, FormsModule],
  template: `
    <main class="page orders-page">
      <div class="container">
        <section class="orders-hero">
          <div>
            <div class="eyebrow">Your account</div>
            <h1>My Orders</h1>
            <p class="hero-copy">Track your purchases, review deliveries and quickly shop your favourites again.</p>
          </div>
          <a routerLink="/" class="btn secondary">Continue shopping →</a>
        </section>

        <div class="order-tabs">
          <button *ngFor="let tab of tabs"
                  type="button"
                  [class.active]="activeTab === tab"
                  (click)="selectTab(tab)">
            {{ tab }} <span>{{ countFor(tab) }}</span>
          </button>
        </div>

        <section class="orders-layout">
          <div class="orders-list">
            <div class="results-head">
              <div>
                <strong>{{ totalForActiveTab }} orders</strong>
                <span> · Most recent first</span>
              </div>
              <select [ngModel]="sortOrder" (ngModelChange)="sortChanged($event)" aria-label="Sort orders">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="amount">Highest amount</option>
              </select>
            </div>

            <article class="order-card card" *ngFor="let order of filteredOrders()">
              <header class="order-header">
                <div>
                  <div class="order-number">Order #{{ order.id }}</div>
                  <div class="order-date">Placed {{ order.date }}</div>
                </div>
                <div class="status" [class]="statusClass(order.status)">
                  <span class="dot"></span>{{ order.status }}
                </div>
              </header>

              <div class="order-body">
                <div class="items-preview">
                  <a class="product-row"
                     *ngFor="let item of order.items"
                     [routerLink]="['/product', item.id]"
                     [attr.aria-label]="'View ' + item.name">
                    <img [src]="item.image" [alt]="item.name">
                    <div class="product-info">
                      <div class="eyebrow">{{ item.category }}</div>
                      <h3>{{ item.name }}</h3>
                      <p>{{ item.variant || 'Standard variant' }} · Qty {{ item.quantity }}</p>
                    </div>
                    <strong>₹{{ item.price | number }}</strong>
                  </a>
                </div>

                <aside class="order-side">
                  <div class="side-label">Total paid</div>
                  <strong class="order-total">₹{{ order.total | number }}</strong>
                  <div class="payment">{{ order.payment }}</div>
                  <div class="delivery" *ngIf="order.deliveryDate && order.status !== 'Cancelled'">
                    <span>Delivery</span>
                    <strong>{{ order.deliveryDate }}</strong>
                  </div>
                </aside>
              </div>

              <div class="tracking" *ngIf="order.status !== 'Cancelled'">
                <div class="tracking-head">
                  <strong>{{ trackingTitle(order.status) }}</strong>
                  <span *ngIf="order.status !== 'Delivered'">{{ order.deliveryDate ? 'Expected ' + order.deliveryDate : 'On the way' }}</span>
                  <span *ngIf="order.status === 'Delivered'">Delivered successfully</span>
                </div>
                <div class="timeline">
                  <div class="track-step done"><span>✓</span><small>Ordered</small></div>
                  <div class="track-line" [class.done]="order.status !== 'Processing'"></div>
                  <div class="track-step" [class.done]="order.status !== 'Processing'"><span>✓</span><small>Packed</small></div>
                  <div class="track-line" [class.done]="order.status === 'Shipped' || order.status === 'Delivered'"></div>
                  <div class="track-step" [class.done]="order.status === 'Shipped' || order.status === 'Delivered'"><span>✓</span><small>Shipped</small></div>
                  <div class="track-line" [class.done]="order.status === 'Delivered'"></div>
                  <div class="track-step" [class.done]="order.status === 'Delivered'"><span>✓</span><small>Delivered</small></div>
                </div>
              </div>

              <div class="cancelled" *ngIf="order.status === 'Cancelled'">
                <span>×</span> This order was cancelled. Any eligible refund will be returned to the original payment method.
              </div>

              <footer class="order-actions">
                <button type="button" class="btn secondary" (click)="toggleDetails(order.id)">
                  {{ expandedOrder === order.id ? 'Hide details' : 'View details' }}
                </button>
                <button type="button" class="btn secondary" *ngIf="order.status === 'Delivered'">Write a review</button>
                <button type="button" class="btn secondary" *ngIf="order.status === 'Delivered'" (click)="reorder(order)">Buy again</button>
                <button type="button" class="btn" *ngIf="order.status === 'Shipped'">Track package</button>

                <button type="button" class="btn danger-btn"
                        *ngIf="canCancel(order)"
                        (click)="openRequest(order, 'cancel')">
                  {{ order.cancelRequested ? 'Cancellation requested' : 'Cancel order' }}
                </button>

                <button type="button" class="btn return-btn"
                        *ngIf="canReturn(order)"
                        (click)="openRequest(order, 'return')">
                  {{ order.returnRequested ? 'Return requested' : 'Return product' }}
                </button>

                <span class="request-badge cancel-badge" *ngIf="order.cancelRequested">
                  Cancellation requested
                </span>
                <span class="request-badge return-badge" *ngIf="order.returnRequested">
                  Return requested
                </span>

                <button type="button" class="link-btn" (click)="downloadInvoice(order)">Invoice ↓</button>
              </footer>

              <div class="details" *ngIf="expandedOrder === order.id">
                <div class="details-grid">
                  <div>
                    <div class="eyebrow">Delivery address</div>
                    <p>{{ order.address }}</p>
                  </div>
                  <div>
                    <div class="eyebrow">Payment</div>
                    <p>{{ order.payment }}</p>
                  </div>
                  <div>
                    <div class="eyebrow">Price breakup</div>
                    <div class="price-breakup">
                      <span>Subtotal <b>₹{{ order.subtotal | number }}</b></span>
                      <span class="discount">Discount <b>-₹{{ order.discount | number }}</b></span>
                      <span>Shipping <b>{{ order.shipping ? '₹' + (order.shipping | number) : 'FREE' }}</b></span>
                      <span>GST <b>₹{{ order.gst | number }}</b></span>
                      <span>Platform fee <b>₹{{ order.platformFee | number }}</b></span>
                      <span>Handling fee <b>₹{{ order.handlingFee | number }}</b></span>
                      <span>Convenience fee <b>₹{{ order.convenienceFee | number }}</b></span>
                      <strong>Total <b>₹{{ order.total | number }}</b></strong>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <div class="pagination" *ngIf="!loading && !error && totalPages > 1">
              <button type="button" (click)="prevPage()" [disabled]="page <= 1">← Prev</button>
              <span>Page {{ page }} of {{ totalPages }}</span>
              <button type="button" (click)="nextPage()" [disabled]="page >= totalPages">Next →</button>
            </div>

            <div class="card" *ngIf="loading">Loading your orders…</div>
            <div class="card" *ngIf="!loading && error">{{ error }}</div>

            <div class="empty card" *ngIf="!loading && !error && !filteredOrders().length">
              <div class="empty-icon">▢</div>
              <h2>No {{ activeTab === 'All' ? '' : activeTab.toLowerCase() }} orders</h2>
              <p class="muted">Your orders will appear here once you place one.</p>
              <a routerLink="/" class="btn">Start shopping</a>
            </div>
          </div>

          <aside class="account-card card">
            <div class="account-avatar">WF</div>
            <div class="eyebrow">WissFind member</div>
            <h2>Your shopping account</h2>
            <p class="muted">Manage your purchases and keep track of every delivery in one place.</p>
            <div class="account-stats">
              <div><strong>{{ allOrders.length }}</strong><span>Total orders</span></div>
              <div><strong>{{ deliveredCount }}</strong><span>Delivered</span></div>
              <div><strong>₹{{ totalSpent | number }}</strong><span>Total spent</span></div>
            </div>
            <div class="help-box">
              <strong>Need help?</strong>
              <span>We're here for order, delivery and return questions.</span>
              <button type="button" class="link-btn">Contact support →</button>
            </div>
          </aside>
        </section>

        <div class="request-backdrop" *ngIf="requestOrder" (click)="closeRequest()">
          <section class="request-modal" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
            <button type="button" class="modal-close" (click)="closeRequest()">×</button>
            <div class="eyebrow">{{ requestType === 'cancel' ? 'Cancel order' : 'Return product' }}</div>
            <h2>{{ requestType === 'cancel' ? 'Why do you want to cancel?' : 'Tell us why you are returning this product' }}</h2>
            <p class="modal-copy">
              Order #{{ requestOrder.id }} · {{ requestOrder.items[0]?.name }}
            </p>

            <div class="reason-list">
              <button type="button"
                      *ngFor="let reason of requestReasons"
                      [class.selected]="selectedReason === reason"
                      (click)="selectedReason = reason">
                <span>{{ selectedReason === reason ? '✓' : '' }}</span>{{ reason }}
              </button>
            </div>

            <textarea [(ngModel)]="requestNote"
                      rows="3"
                      placeholder="Additional note (optional)"></textarea>

            <div class="modal-note" *ngIf="requestType === 'return'">
              Return eligibility depends on the product's return policy. Pickup/refund status will be shown here after the request is submitted.
            </div>

            <div class="modal-actions">
              <button type="button" class="btn secondary" (click)="closeRequest()">Keep order</button>
              <button type="button"
                      class="btn primary"
                      [disabled]="!selectedReason"
                      (click)="submitRequest()">
                Submit {{ requestType === 'cancel' ? 'cancellation' : 'return' }}
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  `,
  styles: [`
    .orders-page{padding-top:34px}
    .orders-hero{display:flex;align-items:end;justify-content:space-between;gap:30px;margin-bottom:34px}
    .orders-hero h1{margin:10px 0 12px}
    .hero-copy{max-width:590px;color:var(--muted);font-size:15px;line-height:1.65;margin:0}
    .btn{display:inline-flex;align-items:center;justify-content:center;text-decoration:none}
    .order-tabs{display:flex;gap:8px;border-bottom:1px solid var(--line);margin-bottom:22px;overflow:auto}
    .order-tabs button{border:0;background:transparent;padding:12px 14px 14px;color:#777;font-weight:700;white-space:nowrap;border-bottom:2px solid transparent}
    .order-tabs button.active{color:#111;border-bottom-color:#111}
    .order-tabs span{font-size:11px;background:#f1f1ef;border-radius:999px;padding:3px 7px;margin-left:5px}
    .order-tabs button.active span{background:#111;color:#fff}
    .orders-layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:24px;align-items:start}
    .orders-list{display:grid;gap:15px}
    .results-head{display:flex;justify-content:space-between;align-items:center;color:#777;font-size:13px;padding:0 3px 4px}
    .results-head strong{color:#111}.results-head select{border:1px solid var(--line);border-radius:999px;padding:8px 12px;background:#fff;outline:0}
    .order-card{overflow:hidden}
    .order-header{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid var(--line);background:#fff}
    .order-number{font-weight:800;font-size:14px}.order-date{color:#888;font-size:12px;margin-top:4px}
    .status{display:flex;align-items:center;gap:7px;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:800}
    .status-delivered{background:#eaf7ef;color:#19744a}.status-shipped{background:#edf4ff;color:#235aa6}.status-processing{background:#fff7e8;color:#9a6200}.status-cancelled{background:#fff0f0;color:#b42318}
    .dot{width:7px;height:7px;border-radius:50%;background:currentColor}
    .order-body{display:grid;grid-template-columns:minmax(0,1fr) 170px;gap:20px;padding:18px 20px}
    .items-preview{display:grid;gap:13px}.product-row{display:grid;grid-template-columns:70px minmax(0,1fr) auto;gap:13px;align-items:center;color:inherit;text-decoration:none;cursor:pointer}.product-row:hover{background:#fafaf8;border-radius:12px}.product-row img{width:70px;height:78px;border-radius:10px;object-fit:cover;background:#f2f2ef}.product-info h3{font-size:15px;margin:4px 0}.product-info p{font-size:12px;color:#888;margin:0}.product-row>strong{font-size:13px;align-self:start;margin-top:5px}
    .order-side{border-left:1px solid var(--line);padding-left:20px}.side-label{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.08em}.order-total{font-size:22px;display:block;margin:5px 0}.payment{font-size:11px;color:#888}.delivery{display:grid;gap:3px;border-top:1px solid var(--line);margin-top:14px;padding-top:13px;font-size:11px;color:#888}.delivery strong{color:#111;font-size:12px}
    .tracking{border-top:1px solid var(--line);padding:16px 20px;background:#fbfbfa}.tracking-head{display:flex;justify-content:space-between;font-size:12px}.tracking-head span{color:#888}.timeline{display:flex;align-items:center;margin-top:15px}.track-step{display:grid;justify-items:center;gap:5px;color:#aaa;min-width:60px}.track-step span{width:25px;height:25px;border-radius:50%;border:1px solid #ddd;background:#fff;display:grid;place-items:center;font-size:11px}.track-step.done{color:#111}.track-step.done span{background:#111;color:#fff;border-color:#111}.track-step small{font-size:10px}.track-line{height:2px;background:#ddd;flex:1}.track-line.done{background:#111}
    .cancelled{margin:0 20px 16px;padding:11px 12px;border-radius:9px;background:#fff5f5;color:#a72a25;font-size:12px}.cancelled span{font-weight:900;margin-right:5px}
    .order-actions{display:flex;align-items:center;gap:8px;padding:14px 20px;border-top:1px solid var(--line);flex-wrap:wrap}.order-actions .btn{padding:9px 13px;font-size:12px}.link-btn{border:0;background:transparent;color:#666;font-size:12px;font-weight:700;padding:8px}.link-btn:hover{text-decoration:underline;color:#111}
    .details{border-top:1px solid var(--line);padding:18px 20px;background:#fafaf8}.details-grid{display:grid;grid-template-columns:1fr 1fr 1.3fr;gap:20px}.details p{font-size:13px;line-height:1.6;color:#555}.price-breakup{display:grid;gap:7px;font-size:12px}.price-breakup span,.price-breakup>strong{display:flex;justify-content:space-between;gap:10px}.price-breakup .discount{color:var(--success)}.price-breakup>strong{border-top:1px solid var(--line);padding-top:8px;margin-top:3px;color:#111}
    .account-card{padding:22px;position:sticky;top:95px}.account-avatar{width:46px;height:46px;border-radius:14px;background:#111;color:#fff;display:grid;place-items:center;font-weight:800;margin-bottom:17px}.account-card h2{font-size:21px;margin:8px 0}.account-card>p{font-size:13px;line-height:1.6}.account-stats{display:grid;grid-template-columns:1fr 1fr 1fr;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:17px 0;margin:18px 0}.account-stats div{display:grid;gap:3px}.account-stats div+div{border-left:1px solid var(--line);padding-left:12px}.account-stats strong{font-size:15px}.account-stats span{font-size:10px;color:#888}.help-box{display:grid;gap:7px;background:#f7f7f5;border-radius:12px;padding:14px;font-size:12px}.help-box span{color:#888;line-height:1.5}.help-box .link-btn{padding:3px 0;text-align:left}
    .pagination{display:flex;align-items:center;justify-content:center;gap:12px;padding:8px 0}.pagination button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:9px 14px;font-weight:700}.pagination button:disabled{opacity:.45;cursor:not-allowed}.empty{text-align:center;padding:70px 20px}.empty-icon{font-size:32px;color:#999}.empty h2{margin:12px 0 7px}.empty p{margin:0 auto 20px}
    .danger-btn{border-color:#f0c5c2!important;color:#b42318!important;background:#fff7f6!important}.return-btn{border-color:#d6d6d1!important;color:#111!important;background:#fff!important}
    .request-badge{font-size:11px;font-weight:800;border-radius:999px;padding:7px 10px}.cancel-badge{background:#fff0ef;color:#b42318}.return-badge{background:#f1f5ff;color:#315b9a}
    .request-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.42);display:grid;place-items:center;padding:20px;z-index:1000}
    .request-modal{position:relative;width:min(520px,100%);background:#fff;border-radius:22px;padding:26px;box-shadow:0 24px 80px rgba(0,0,0,.2)}
    .modal-close{position:absolute;right:14px;top:12px;border:0;background:#f4f4f2;width:34px;height:34px;border-radius:50%;font-size:22px;cursor:pointer}
    .request-modal h2{font-size:24px;margin:9px 40px 7px 0}.modal-copy{font-size:12px;color:#777;margin:0 0 18px}
    .reason-list{display:grid;gap:8px}.reason-list button{border:1px solid var(--line);background:#fff;border-radius:12px;text-align:left;padding:11px 12px;cursor:pointer;font-size:13px}.reason-list button.selected{border-color:#111;background:#f7f7f5;font-weight:800}.reason-list span{display:inline-grid;place-items:center;width:18px;margin-right:5px}
    .request-modal textarea{width:100%;box-sizing:border-box;margin-top:12px;border:1px solid var(--line);border-radius:12px;padding:12px;font:inherit;resize:vertical;outline:0}.request-modal textarea:focus{border-color:#111}
    .modal-note{margin-top:12px;padding:11px 12px;background:#f7f7f5;border-radius:10px;font-size:11px;line-height:1.5;color:#666}.modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.modal-actions .primary:disabled{opacity:.45;cursor:not-allowed}
    @media(max-width:1000px){.orders-layout{grid-template-columns:1fr}.account-card{position:static}.details-grid{grid-template-columns:1fr 1fr}.details-grid>div:last-child{grid-column:1/-1}}
    @media(max-width:700px){.orders-hero{align-items:flex-start;flex-direction:column}.orders-hero .btn{width:100%}.order-body{grid-template-columns:1fr}.order-side{border-left:0;border-top:1px solid var(--line);padding:15px 0 0}.product-row{grid-template-columns:58px minmax(0,1fr)}.product-row>strong{grid-column:2}.product-row img{width:58px;height:66px}.timeline{min-width:440px}.tracking{overflow:auto}.details-grid{grid-template-columns:1fr}.details-grid>div:last-child{grid-column:auto}.order-header,.order-body,.tracking,.order-actions,.details{padding-left:14px;padding-right:14px}}
  `]
})
export class OrdersComponent implements OnInit, OnDestroy {
  private readonly cart = inject(CartService);
  private readonly refundService = inject(RefundService);
  tabs = ['All', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
  activeTab = 'All';
  sortOrder = 'newest';
  expandedOrder = '';

  allOrders: Order[] = [];
  loading = true;
  error = '';

  private readonly api = inject(BackendApiService);
  private readonly cdr = inject(ChangeDetectorRef);
  private pageAbort = new AbortController();
  private destroyed = false;
  readonly pageSize = 10;
  page = 1;
  totalPages = 1;
  totalForActiveTab = 0;
  orderCounts: Record<OrderCountKey, number> = { All: 0, Processing: 0, Shipped: 0, Delivered: 0, Cancelled: 0 };
  totalSpentFromServer = 0;

  ngOnInit() {
    void this.loadOrders();
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.pageAbort.abort();
  }

  async sortChanged(value: string) { this.sortOrder = value; this.page = 1; await this.loadOrders(); }

  async selectTab(tab: string) {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.page = 1;
    await this.loadOrders();
  }

  private resetRequest() {
    this.pageAbort.abort();
    this.pageAbort = new AbortController();
    return this.pageAbort.signal;
  }

  async loadOrders() {
    const signal = this.resetRequest();
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();
    try {
      const status = encodeURIComponent(this.activeTab);
      const sort = encodeURIComponent(this.sortOrder);
      const [data, summary]: any[] = await Promise.all([
        this.api.get(`/orders/mine/paged?page=${this.page - 1}&size=${this.pageSize}&status=${status}&sort=${sort}`, signal),
        this.api.get('/orders/mine/summary', signal)
      ]);
      if (this.destroyed || signal.aborted) return;
      this.allOrders = Array.isArray(data?.content) ? data.content.map((row: any) => this.mapBackendOrder(row)) : [];
      this.totalForActiveTab = Number(data?.totalElements || 0);
      this.totalPages = Math.max(1, Number(data?.totalPages || 1));
      if (this.page > this.totalPages) this.page = this.totalPages;
      this.orderCounts = {
        All: Number(summary?.all || 0), Processing: Number(summary?.processing || 0),
        Shipped: Number(summary?.shipped || 0), Delivered: Number(summary?.delivered || 0),
        Cancelled: Number(summary?.cancelled || 0)
      };
      this.totalSpentFromServer = Number(summary?.totalSpent || 0);
      this.cdr.detectChanges();
    } catch (e: any) {
      if (!this.destroyed && !signal.aborted && e?.name !== 'AbortError') {
        this.allOrders = []; this.totalForActiveTab = 0; this.totalPages = 1;
        this.error = e?.error?.error || e?.error?.message || 'Unable to load your orders.';
        this.cdr.detectChanges();
      }
    } finally {
      if (!this.destroyed && !signal.aborted) { this.loading = false; this.cdr.detectChanges(); }
    }
  }

  prevPage() { if (this.page <= 1) return; this.page--; void this.loadOrders(); }
  nextPage() { if (this.page >= this.totalPages) return; this.page++; void this.loadOrders(); }

  private mapBackendOrder(row: any): Order {
    const total = Number(row.total || 0), subtotal = Number(row.subtotal || 0), discount = Number(row.discount || 0), shipping = Number(row.shipping || 0), gst = Number(row.gst || 0);
    const paymentStatus = String(row.paymentStatus || 'PENDING'), deliveryStatus = String(row.deliveryStatus || 'Processing');
    let status: OrderStatus = 'Processing';
    if (deliveryStatus === 'Delivered') status = 'Delivered';
    else if (deliveryStatus === 'Shipped' || deliveryStatus === 'Out for Delivery') status = 'Shipped';
    else if (deliveryStatus === 'Cancelled') status = 'Cancelled';
    return { id: String(row.orderNumber || row.id), _backendId: Number(row.id), date: row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—', status, items: this.mapOrderItems(row.items), subtotal, discount, shipping, gst, platformFee:0, handlingFee:0, convenienceFee:0, total, payment:paymentStatus === 'PAID' ? 'Paid' : paymentStatus, address:row.address || '—' };
  }

  private mapOrderItems(rows: any): OrderItem[] {
    if (!Array.isArray(rows)) return [];
    return rows.map((item:any)=>({ id:Number(item.productId||item.id||0), name:String(item.name||'Product'), category:String(item.category||'Product'), image:this.resolveImage(item.image,item.productId), quantity:Math.max(1,Number(item.quantity||1)), price:Number(item.price||0), variant:item.variant||undefined }));
  }

  private resolveImage(image:any, productId:any):string {
    const value=String(image||'').trim();
    if(value.startsWith('http://')||value.startsWith('https://')) return value;
    if(value.startsWith('/api/')) return 'http://localhost:8080'+value;
    if(value.startsWith('/')) return 'http://localhost:8080'+value;
    const id=Number(productId);
    return Number.isFinite(id)&&id>0 ? `${this.api.baseUrl}/products/${id}/image` : '';
  }

  filteredOrders(): Order[] { return this.allOrders; }
  countFor(tab: string): number {
    return Number(this.orderCounts[tab as OrderCountKey] || 0);
  }
  get deliveredCount(): number {
    return this.orderCounts['Delivered'] || 0;
  }
  get totalSpent(): number { return this.totalSpentFromServer; }

  statusClass(status: OrderStatus): string { return 'status-' + status.toLowerCase(); }

  trackingTitle(status: OrderStatus): string {
    if (status === 'Delivered') return 'Delivered';
    if (status === 'Shipped') return 'Your order is on the way';
    return 'We are preparing your order';
  }

  toggleDetails(id: string) { this.expandedOrder = this.expandedOrder === id ? '' : id; }

  requestOrder: Order | null = null;
  requestType: RequestType = 'cancel';
  selectedReason = '';
  requestNote = '';

  requestReasons: string[] = [
    'Changed my mind',
    'Ordered by mistake',
    'Found a better price',
    'Product is no longer needed',
    'Wrong product/variant ordered',
    'Other'
  ];

  canCancel(order: Order): boolean {
    return order.status === 'Processing' && !order.cancelRequested;
  }

  canReturn(order: Order): boolean {
    // Demo rule: delivered orders are returnable; replace with backend policy dates in production.
    return order.status === 'Delivered' && !order.returnRequested;
  }

  openRequest(order: Order, type: RequestType) {
    this.requestOrder = order;
    this.requestType = type;
    this.selectedReason = '';
    this.requestNote = '';
    if (type === 'return') {
      this.requestReasons = [
        'Product is damaged',
        'Wrong product received',
        'Product does not match description',
        'Size/fit issue',
        'Missing parts or accessories',
        'Changed my mind',
        'Other'
      ];
    } else {
      this.requestReasons = [
        'Changed my mind',
        'Ordered by mistake',
        'Found a better price',
        'Product is no longer needed',
        'Wrong product/variant ordered',
        'Other'
      ];
    }
  }

  closeRequest() {
    this.requestOrder = null;
    this.selectedReason = '';
    this.requestNote = '';
  }

  async submitRequest() {
    if (!this.requestOrder || !this.selectedReason) return;

    const currentOrder = this.requestOrder;

    if (this.requestType === 'cancel') {
      try {
        await this.api.patch(`/orders/${this.backendOrderId(currentOrder)}/cancel`, {
          reason: this.selectedReason,
          note: this.requestNote || ''
        });

        const firstItem = currentOrder.items[0];
        this.refundService.addRequest({
          orderId: currentOrder.id,
          product: firstItem?.name || 'Order item',
          type: 'Cancellation',
          amount: currentOrder.total,
          refundAmount: currentOrder.payment === 'Paid' ? currentOrder.total : 0,
          paymentMethod: currentOrder.payment,
          reason: this.selectedReason
        });

        this.closeRequest();
        await this.loadOrders();
      } catch (e: any) {
        this.error = e?.error?.error || e?.error?.message || 'Unable to cancel this order.';
      }
      return;
    }

    try {
      await this.api.post('/returns', {
        order: { id: currentOrder._backendId },
        reason: this.selectedReason,
        refundAmount: currentOrder.items[0]?.price || currentOrder.total
      });
      currentOrder.returnRequested = true;
      currentOrder.returnReason = this.selectedReason;
      this.closeRequest();
    } catch (e:any) {
      this.error = e?.error?.error || e?.error?.message || 'Unable to create return request.';
    }
  }

  /** Backend uses the numeric order id; the UI displays the human order number. */
  private backendOrderId(order: Order): string {
    const row = this.allOrders.find(x => x === order);
    return String((row as any)?._backendId || order.id);
  }

  reorder(order: Order) {
    for (const item of order.items) {
      const product = {
        id: item.id,
        name: item.name,
        category: item.category,
        price: item.price,
        oldPrice: undefined,
        image: item.image,
        rating: 4.7,
        reviews: 120,
        badge: undefined,
        description: '',
        images: [item.image]
      } as any;
      this.cart.add(product);
    }
  }

  downloadInvoice(order: Order) {
    const text = [
      `WISSFIND INVOICE`, `Order #${order.id}`, `Date: ${order.date}`, '',
      ...order.items.map(i => `${i.name} x ${i.quantity} - ₹${i.price}`), '',
      `Subtotal: ₹${order.subtotal}`, `Discount: -₹${order.discount}`, `Shipping: ₹${order.shipping}`,
      `GST: ₹${order.gst}`, `Platform fee: ₹${order.platformFee}`, `Handling fee: ₹${order.handlingFee}`,
      `Convenience fee: ₹${order.convenienceFee}`, `Total: ₹${order.total}`
    ].join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `WissFind-${order.id}.txt`; a.click(); URL.revokeObjectURL(url);
  }
}
