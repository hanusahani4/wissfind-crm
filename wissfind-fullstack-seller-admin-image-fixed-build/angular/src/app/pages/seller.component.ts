import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BackendApiService } from '../core/backend-api.service';
import { CategoryService } from '../core/category.service';
import { AuthService } from '../core/auth.service';

@Component({
 selector:'app-seller', standalone:true, imports:[CommonModule,FormsModule,DecimalPipe,DatePipe],
 template:`
 <div class="shell">
  <aside class="side" [class.open]="mobile">
   <div class="brand">WISS<span>FIND</span><small>SELLER CENTER</small></div><button class="close" (click)="mobile=false">×</button>
   <div class="profile"><b>{{userName}}</b><small>{{userPhone}}</small><em>SELLER</em></div>
   <nav><button *ngFor="let n of nav" [class.active]="section===n" (click)="go(n)">{{n}}</button></nav>
   <button class="logout" (click)="logout()">Logout</button>
  </aside>
  <main class="main">
   <header><button class="menu" (click)="mobile=true">☰</button><b>Seller Center / {{section}}</b><span class="spacer"></span><input *ngIf="isListSection()" class="global-search" [ngModel]="search()" (ngModelChange)="searchChanged($event)" placeholder="Search {{section}}...">{{userName}}</header>

   <section class="content" *ngIf="section==='Overview'"><h1>Seller dashboard</h1><p class="muted">Everything below is loaded from the real backend.</p><div class="cards"><div><small>Products</small><strong>{{report.products||0}}</strong></div><div><small>Live</small><strong>{{report.liveProducts||0}}</strong></div><div><small>Pending</small><strong>{{report.pendingProducts||0}}</strong></div><div><small>Orders</small><strong>{{report.orders||0}}</strong></div><div><small>Returns</small><strong>{{report.returns||0}}</strong></div><div><small>Coupons</small><strong>{{report.coupons||0}}</strong></div><div><small>Payouts</small><strong>{{report.payouts||0}}</strong></div><div><small>Sales</small><strong>₹{{report.sales|number}}</strong></div></div></section>

   <section class="content" *ngIf="section==='Onboarding'"><div class="title"><div><h1>Onboarding & KYC</h1><p class="muted">Your application and verification status.</p></div></div><div class="panel" *ngIf="application"><div class="row"><b>Store</b><span>{{application.storeName}}</span></div><div class="row"><b>Owner</b><span>{{application.ownerName}}</span></div><div class="row"><b>Category</b><span>{{application.category}}</span></div><div class="row"><b>Business</b><span>{{application.businessType}}</span></div><div class="row"><b>PAN / GSTIN</b><span>{{application.pan}} / {{application.gstin||'—'}}</span></div><div class="row"><b>Status</b><span class="status">{{application.status}}</span></div><div class="row"><b>Pickup</b><span>{{application.pickupAddress}}, {{application.city}}, {{application.state}} - {{application.pincode}}</span></div><div class="row"><b>Bank</b><span>{{maskedBank(application.bankAccount)}} / {{application.ifsc}}</span></div></div><div class="empty" *ngIf="!application">No seller application found.</div></section>

   <section class="content" *ngIf="section==='Products'">
    <div class="title"><div><h1>Products</h1><p class="muted">All customer-facing product attributes are available here.</p></div><button class="primary" (click)="openNew()">+ Add product</button></div>
    <div class="panel table"><table><thead><tr><th>Image</th><th>Product / SKU</th><th>Category</th><th>Price</th><th>GST</th><th>Stock</th><th>Rating</th><th>Status</th><th>Actions</th></tr></thead><tbody><tr *ngFor="let p of pageOf('products', products)"><td><img class="thumb" *ngIf="p.image" [src]="imageUrl(p.image)"><span *ngIf="!p.image">—</span></td><td><b>{{p.name}}</b><small>{{p.sku}}</small><small>{{(p.images||[]).length}} images</small></td><td>{{p.category}} / {{p.subcategory||'—'}}</td><td>₹{{p.price|number}}</td><td>{{p.gstPercent}}%</td><td>{{p.stock}}</td><td>★ {{p.rating||0}} ({{p.reviews||0}})</td><td><span class="status">{{p.status}}</span></td><td><button class="link" (click)="edit(p)">Edit</button><button class="danger-link" (click)="remove(p)">Delete</button></td></tr></tbody></table><div class="pagination" *ngIf="pageCount('products', products.length) > 1"><button (click)="prevPage('products')" [disabled]="page('products') === 1">← Prev</button><span>Page {{page('products')}} of {{pageCount('products', products.length)}}</span><button (click)="nextPage('products', products.length)" [disabled]="page('products') === pageCount('products', products.length)">Next →</button></div><div class="empty" *ngIf="!products.length">No products yet.</div></div>
    <div class="panel form" *ngIf="formOpen"><div class="title"><h2>{{editingId?'Edit product':'Add product'}}</h2><button class="link" (click)="formOpen=false">Close</button></div>
     <form (ngSubmit)="save()"><div class="grid">
      <label>Name*<input name="name" [(ngModel)]="draft.name" required></label><label>SKU*<input name="sku" [(ngModel)]="draft.sku" required></label>
      <label>Brand<input name="brand" [(ngModel)]="draft.brand"></label><label>Gender<select name="gender" [(ngModel)]="draft.gender"><option value="">Select</option><option>Men</option><option>Women</option><option>Kids</option><option>Unisex</option></select></label>
      <label>Category*<select name="category" [(ngModel)]="draft.category" (ngModelChange)="draft.subcategory=''" required><option value="">Select</option><option *ngFor="let c of categories" [value]="c.name">{{c.name}}</option></select></label>
      <label>Subcategory<select name="subcategory" [(ngModel)]="draft.subcategory"><option value="">Select</option><option *ngFor="let c of subcategories" [value]="c.name">{{c.name}}</option></select></label>
      <label>Type<select name="type" [(ngModel)]="draft.type"><option value="">Select</option><option>Physical</option><option>Digital</option></select></label>
      <label>Price*<input name="price" type="number" min="1" [(ngModel)]="draft.price" required></label><label>MRP / Old price<input name="oldPrice" type="number" min="0" [(ngModel)]="draft.oldPrice"></label>
      <label>GST %<input name="gst" type="number" min="0" max="100" [(ngModel)]="draft.gstPercent"></label><label>Stock*<input name="stock" type="number" min="0" [(ngModel)]="draft.stock" required></label>
      <label>Shipping fee<input name="shippingFee" type="number" min="0" [(ngModel)]="draft.shippingFee"></label><label>Platform fee<input name="platformFee" type="number" min="0" [(ngModel)]="draft.platformFee"></label>
      <label>Return days<input name="returnDays" type="number" min="0" max="90" [(ngModel)]="draft.returnDays"></label><label>Warranty<input name="warranty" [(ngModel)]="draft.warranty"></label>
      <label>Material<input name="material" [(ngModel)]="draft.material"></label><label>Weight<input name="weight" type="number" min="0" [(ngModel)]="draft.weight"></label>
      <label>Dimensions<input name="dimensions" [(ngModel)]="draft.dimensions" placeholder="L x W x H"></label><label>HSN code<input name="hsnCode" [(ngModel)]="draft.hsnCode"></label>
      <label class="check"><input name="taxIncluded" type="checkbox" [(ngModel)]="draft.taxIncluded"> GST included in displayed price</label><label class="check"><input name="featured" type="checkbox" [(ngModel)]="draft.featured"> Featured product</label>
      <label class="wide">Colors (comma separated)<input name="colors" [ngModel]="(draft.colors||[]).join(', ')" (ngModelChange)="draft.colors=parseList($event)"></label>
      <label class="wide">Sizes (comma separated)<input name="sizes" [ngModel]="(draft.sizes||[]).join(', ')" (ngModelChange)="draft.sizes=parseList($event)"></label>
      <label class="wide">Tags (comma separated)<input name="tags" [ngModel]="(draft.tags||[]).join(', ')" (ngModelChange)="draft.tags=parseList($event)"></label>
      <label class="wide">Description<textarea name="description" rows="5" [(ngModel)]="draft.description"></textarea></label>
      <label class="wide file-label">Product images* <input type="file" accept="image/*" multiple (change)="selectFiles($event)"><small>{{selectedFiles.length}} new image(s) selected. Existing images are retained on edit. Max 5 MB each.</small></label>
     </div><div class="gallery" *ngIf="draft.images?.length"><div *ngFor="let img of draft.images;let i=index" class="gallery-item"><img [src]="imageUrl(img)"><button type="button" [disabled]="saving" (click)="removeExistingImage(img,i)">×</button></div></div><div class="gallery new-gallery" *ngIf="selectedFiles.length"><div *ngFor="let file of selectedFiles" class="gallery-item"><img [src]="previewUrl(file)" [alt]="file.name"></div></div><p class="error" *ngIf="error">{{error}}</p><button class="primary" [disabled]="saving">{{saving?'Saving...':(editingId?'Update product':'Create product')}}</button></form>
    </div>
   </section>

   <section class="content" *ngIf="section==='Inventory'"><h1>Inventory</h1><div class="panel table"><table><thead><tr><th>Product</th><th>SKU</th><th>Stock</th><th>Status</th><th>Adjust</th></tr></thead><tbody><tr *ngFor="let p of pageOf('inventory', products)"><td>{{p.name}}</td><td>{{p.sku}}</td><td>{{p.stock}}</td><td>{{p.status}}</td><td><button class="link" (click)="adjust(p,1)">+1</button><button class="link" (click)="adjust(p,-1)">-1</button></td></tr></tbody></table><div class="pagination" *ngIf="pageCount('inventory', products.length) > 1"><button (click)="prevPage('inventory')" [disabled]="page('inventory') === 1">← Prev</button><span>Page {{page('inventory')}} of {{pageCount('inventory', products.length)}}</span><button (click)="nextPage('inventory', products.length)" [disabled]="page('inventory') === pageCount('inventory', products.length)">Next →</button></div></div></section>

   <section class="content" *ngIf="section==='Orders'"><h1>Orders</h1><div class="panel table"><table><thead><tr><th>Order</th><th>Customer</th><th>Products</th><th>Amount</th><th>Payment</th><th>Delivery</th><th>Action</th></tr></thead><tbody><ng-container *ngFor="let o of pageOf('orders', orders)"><tr><td><b>{{o.orderNumber}}</b><small>{{o.createdAt|date:'medium'}}</small></td><td>{{o.customer?.name||'Customer'}}</td><td><button class="link" type="button" (click)="toggleOrderDetails(o)">{{expandedOrderId===o.id?'Hide':'View'}} {{(o.items||[]).length}} product{{(o.items||[]).length===1?'':'s'}}</button></td><td>₹{{o.total|number}}</td><td>{{o.paymentStatus}}</td><td>{{o.deliveryStatus}}</td><td><select [value]="o.deliveryStatus" (change)="setOrderStatus(o,$any($event.target).value)" [disabled]="o.deliveryStatus==='Cancelled'"><option>Processing</option><option>Shipped</option><option>Out for Delivery</option><option>Delivered</option><option>Delayed</option></select><button type="button" class="danger-link" *ngIf="canSellerReject(o)" (click)="rejectOrder(o)">Reject order</button></td></tr><tr *ngIf="expandedOrderId===o.id" class="order-items-row"><td colspan="7"><div class="order-items"><strong>Products ordered</strong><div class="order-item" *ngFor="let item of (o.items||[])"><img *ngIf="item.image" [src]="imageUrl(item.image)" [alt]="item.name"><div><b>{{item.name}}</b><small>{{item.category||'Product'}} <span *ngIf="item.variant">· {{item.variant}}</span></small></div><span>Qty {{item.quantity}}</span><b>₹{{item.price|number}}</b></div><div class="empty" *ngIf="!(o.items||[]).length">No product snapshot is available for this order.</div></div></td></tr></ng-container></tbody></table><div class="pagination" *ngIf="pageCount('orders', orders.length) > 1"><button (click)="prevPage('orders')" [disabled]="page('orders') === 1">← Prev</button><span>Page {{page('orders')}} of {{pageCount('orders', orders.length)}}</span><button (click)="nextPage('orders', orders.length)" [disabled]="page('orders') === pageCount('orders', orders.length)">Next →</button></div><div class="empty" *ngIf="!orders.length">No orders yet.</div></div></section>

   <section class="content" *ngIf="section==='Returns'"><h1>Returns & Refunds</h1><div class="panel table"><table><thead><tr><th>Order</th><th>Reason</th><th>Refund</th><th>Status</th><th>Action</th></tr></thead><tbody><tr *ngFor="let r of pageOf('returns', returns)"><td>{{r.order?.orderNumber}}</td><td>{{r.reason}}</td><td>₹{{r.refundAmount||0|number}}</td><td>{{r.status}}</td><td><select [value]="r.status" (change)="setReturnStatus(r,$any($event.target).value)"><option>REQUESTED</option><option>APPROVED</option><option>PICKUP_SCHEDULED</option><option>PICKED_UP</option><option>REFUND_INITIATED</option><option>REFUND_COMPLETED</option><option>REJECTED</option></select></td></tr></tbody></table><div class="pagination" *ngIf="pageCount('returns', returns.length) > 1"><button (click)="prevPage('returns')" [disabled]="page('returns') === 1">← Prev</button><span>Page {{page('returns')}} of {{pageCount('returns', returns.length)}}</span><button (click)="nextPage('returns', returns.length)" [disabled]="page('returns') === pageCount('returns', returns.length)">Next →</button></div></div></section>

   <section class="content" *ngIf="section==='Coupons'"><div class="title"><div><h1>Coupons</h1><p class="muted">Create unique seller coupons.</p></div><button class="primary" (click)="openCoupon()">+ Coupon</button></div><div class="panel table"><table><thead><tr><th>Code</th><th>Discount</th><th>Expiry</th><th>Usage</th><th>Status</th><th>Action</th></tr></thead><tbody><tr *ngFor="let c of pageOf('coupons', coupons)"><td>{{c.code}}</td><td>₹{{c.discount|number}}</td><td>{{c.expiry||'—'}}</td><td>{{c.usage}}</td><td>{{c.active?'Active':'Inactive'}}</td><td><button class="link" (click)="editCoupon(c)">Edit</button><button class="danger-link" (click)="deleteCoupon(c)">Delete</button></td></tr></tbody></table><div class="pagination" *ngIf="pageCount('coupons', coupons.length) > 1"><button (click)="prevPage('coupons')" [disabled]="page('coupons') === 1">← Prev</button><span>Page {{page('coupons')}} of {{pageCount('coupons', coupons.length)}}</span><button (click)="nextPage('coupons', coupons.length)" [disabled]="page('coupons') === pageCount('coupons', coupons.length)">Next →</button></div></div><div class="panel form" *ngIf="couponOpen"><form (ngSubmit)="saveCoupon()"><div class="grid"><label>Code*<input name="couponCode" [(ngModel)]="coupon.code" required></label><label>Discount*<input name="couponDiscount" type="number" min="1" [(ngModel)]="coupon.discount" required></label><label>Expiry<input name="couponExpiry" type="date" [(ngModel)]="coupon.expiry"></label><label class="check"><input name="couponActive" type="checkbox" [(ngModel)]="coupon.active"> Active</label></div><p class="error" *ngIf="error">{{error}}</p><button class="primary">{{coupon.id?'Update':'Create'}}</button></form></div></section>

   <section class="content" *ngIf="section==='Payouts'"><div class="title"><div><h1>Payouts</h1><p class="muted">Request seller settlement using your configured bank details.</p></div><button class="primary" (click)="requestPayout()">Request payout</button></div><div class="panel table"><table><thead><tr><th>Reference</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody><tr *ngFor="let p of pageOf('payouts', payouts)"><td>{{p.reference}}</td><td>₹{{p.amount|number}}</td><td>{{p.status}}</td><td>{{p.createdAt|date:'medium'}}</td></tr></tbody></table><div class="pagination" *ngIf="pageCount('payouts', payouts.length) > 1"><button (click)="prevPage('payouts')" [disabled]="page('payouts') === 1">← Prev</button><span>Page {{page('payouts')}} of {{pageCount('payouts', payouts.length)}}</span><button (click)="nextPage('payouts', payouts.length)" [disabled]="page('payouts') === pageCount('payouts', payouts.length)">Next →</button></div></div></section>

   <section class="content" *ngIf="section==='Reviews'"><h1>Customer Reviews</h1><div class="panel table"><table><thead><tr><th>Product</th><th>Customer</th><th>Rating</th><th>Title</th><th>Review</th></tr></thead><tbody><tr *ngFor="let r of pageOf('reviews', reviews)"><td>{{r.productName}}</td><td>{{r.author}}</td><td>★ {{r.rating}}</td><td>{{r.title}}</td><td class="wrap">{{r.text}}</td></tr></tbody></table><div class="pagination" *ngIf="pageCount('reviews', reviews.length) > 1"><button (click)="prevPage('reviews')" [disabled]="page('reviews') === 1">← Prev</button><span>Page {{page('reviews')}} of {{pageCount('reviews', reviews.length)}}</span><button (click)="nextPage('reviews', reviews.length)" [disabled]="page('reviews') === pageCount('reviews', reviews.length)">Next →</button></div><div class="empty" *ngIf="!reviews.length">No reviews yet.</div></div></section>

   <section class="content" *ngIf="section==='Store Profile'||section==='Pickup Address'||section==='Bank Details'||section==='Store Settings'"><div class="title"><div><h1>Store & Pickup Settings</h1><p class="muted">This is the address used for seller pickup/fulfillment.</p></div></div><div class="panel form" *ngIf="application"><form (ngSubmit)="saveSettings()"><div class="grid"><label>Store name<input name="storeName" [(ngModel)]="application.storeName" required></label><label>Owner name<input name="ownerName" [(ngModel)]="application.ownerName" required></label><label>Email<input name="email" type="email" [(ngModel)]="application.email"></label><label>Phone<input name="phone" [(ngModel)]="application.phone" required></label><label class="wide">Pickup / Warehouse address<textarea name="pickupAddress" rows="3" [(ngModel)]="application.pickupAddress" required></textarea></label><label>City<input name="city" [(ngModel)]="application.city" required></label><label>State<input name="state" [(ngModel)]="application.state" required></label><label>PIN code<input name="pincode" maxlength="6" [(ngModel)]="application.pincode" required></label><label>Bank account<input name="bankAccount" [(ngModel)]="application.bankAccount" required></label><label>IFSC<input name="ifsc" [(ngModel)]="application.ifsc" maxlength="11" required></label></div><p class="error" *ngIf="error">{{error}}</p><button class="primary" [disabled]="saving">Save settings</button></form></div></section>

   <section class="content" *ngIf="section==='Deliveries'">
    <div class="title"><div><h1>Deliveries</h1><p class="muted">Manage shipment status for your own orders.</p></div><button class="link" (click)="loadOrders()">Refresh</button></div>
    <div class="panel table"><table><thead><tr><th>Order</th><th>Customer</th><th>Amount</th><th>Delivery</th><th>Update</th></tr></thead>
    <tbody><tr *ngFor="let o of pageOf('deliveries', orders)"><td>{{o.orderNumber}}</td><td>{{o.customer?.name||'Customer'}}</td><td>₹{{o.total|number}}</td><td>{{o.deliveryStatus}}</td><td><select [value]="o.deliveryStatus" (change)="setOrderStatus(o,$any($event.target).value)"><option>Processing</option><option>Shipped</option><option>Out for Delivery</option><option>Delivered</option><option>Delayed</option></select></td></tr></tbody></table><div class="pagination" *ngIf="pageCount('deliveries', orders.length) > 1"><button (click)="prevPage('deliveries')" [disabled]="page('deliveries') === 1">← Prev</button><span>Page {{page('deliveries')}} of {{pageCount('deliveries', orders.length)}}</span><button (click)="nextPage('deliveries', orders.length)" [disabled]="page('deliveries') === pageCount('deliveries', orders.length)">Next →</button></div><div class="empty" *ngIf="!orders.length">No deliveries yet.</div></div>
   </section>

   <section class="content" *ngIf="section==='Payments'">
    <h1>Payments</h1><p class="muted">Payment status for your orders.</p>
    <div class="panel table"><table><thead><tr><th>Order</th><th>Customer</th><th>Amount</th><th>Payment</th><th>Delivery</th></tr></thead>
    <tbody><tr *ngFor="let o of pageOf('payments', orders)"><td>{{o.orderNumber}}</td><td>{{o.customer?.name||'Customer'}}</td><td>₹{{o.total|number}}</td><td>{{o.paymentStatus}}</td><td>{{o.deliveryStatus}}</td></tr></tbody></table><div class="pagination" *ngIf="pageCount('payments', orders.length) > 1"><button (click)="prevPage('payments')" [disabled]="page('payments') === 1">← Prev</button><span>Page {{page('payments')}} of {{pageCount('payments', orders.length)}}</span><button (click)="nextPage('payments', orders.length)" [disabled]="page('payments') === pageCount('payments', orders.length)">Next →</button></div><div class="empty" *ngIf="!orders.length">No payments yet.</div></div>
   </section>

   <section class="content" *ngIf="section==='Commissions'">
    <h1>Commissions</h1><p class="muted">Marketplace commission records associated with your orders.</p>
    <div class="panel table"><table><thead><tr><th>Order</th><th>Rate</th><th>Amount</th><th>Status</th></tr></thead>
    <tbody><tr *ngFor="let c of pageOf('commissions', commissions)"><td>{{c.order?.orderNumber||'—'}}</td><td>{{c.rate||0}}%</td><td>₹{{c.amount||0|number}}</td><td>{{c.status}}</td></tr></tbody></table><div class="pagination" *ngIf="pageCount('commissions', commissions.length) > 1"><button (click)="prevPage('commissions')" [disabled]="page('commissions') === 1">← Prev</button><span>Page {{page('commissions')}} of {{pageCount('commissions', commissions.length)}}</span><button (click)="nextPage('commissions', commissions.length)" [disabled]="page('commissions') === pageCount('commissions', commissions.length)">Next →</button></div><div class="empty" *ngIf="!commissions.length">No commission records yet.</div></div>
   </section>

   <section class="content" *ngIf="section==='Analytics'">
    <h1>Analytics</h1><p class="muted">Live marketplace metrics for this seller.</p>
    <div class="cards"><div><small>Total products</small><strong>{{report.products||0}}</strong></div><div><small>Live products</small><strong>{{report.liveProducts||0}}</strong></div><div><small>Orders</small><strong>{{report.orders||0}}</strong></div><div><small>Sales</small><strong>₹{{report.sales|number}}</strong></div><div><small>Returns</small><strong>{{report.returns||0}}</strong></div><div><small>Payouts</small><strong>{{report.payouts||0}}</strong></div></div>
   </section>

   <section class="content" *ngIf="section==='Reports'"><h1>Reports</h1><div class="cards"><div><small>Orders</small><strong>{{report.orders}}</strong></div><div><small>Sales</small><strong>₹{{report.sales|number}}</strong></div><div><small>Products</small><strong>{{report.products}}</strong></div><div><small>Returns</small><strong>{{report.returns}}</strong></div><div><small>Payout requests</small><strong>{{report.payouts}}</strong></div></div></section>

   <section class="content" *ngIf="section==='Disputes'"><h1>Disputes</h1><div class="panel table"><table><thead><tr><th>Order</th><th>Reason</th><th>Status</th><th>Response</th><th>Action</th></tr></thead><tbody><tr *ngFor="let d of pageOf('disputes', disputes)"><td>{{d.order?.orderNumber}}</td><td>{{d.reason}}</td><td>{{d.status}}</td><td>{{d.response||'—'}}</td><td><button class="link" (click)="respondDispute(d)">Respond</button></td></tr></tbody></table><div class="pagination" *ngIf="pageCount('disputes', disputes.length) > 1"><button (click)="prevPage('disputes')" [disabled]="page('disputes') === 1">← Prev</button><span>Page {{page('disputes')}} of {{pageCount('disputes', disputes.length)}}</span><button (click)="nextPage('disputes', disputes.length)" [disabled]="page('disputes') === pageCount('disputes', disputes.length)">Next →</button></div></div></section>
  </main>
 </div>`,
 styles:[`
 :host{display:block;background:#f7f7f4;min-height:100vh;color:#171717}.shell{display:flex;min-height:100vh}.side{width:255px;background:#151515;color:#fff;padding:20px 13px;box-sizing:border-box;display:flex;flex-direction:column;position:sticky;top:0;height:100vh}.brand{font-weight:900;font-size:20px;margin-bottom:22px}.brand span{font-weight:400}.brand small{display:block;font-size:9px;color:#aaa;margin-top:4px}.profile{padding:13px;border:1px solid #333;border-radius:12px;display:grid;gap:4px;margin-bottom:16px}.profile small{color:#aaa}.profile em{font-size:9px;color:#9fe2ad;font-style:normal}.side nav{display:grid;gap:4px;overflow:auto}.side nav button,.logout{background:transparent;border:0;color:#ddd;text-align:left;padding:10px;border-radius:9px;cursor:pointer}.side nav button.active,.side nav button:hover{background:#fff;color:#111}.logout{margin-top:auto;border:1px solid #333}.main{flex:1;min-width:0}.main header{height:64px;background:#fff;border-bottom:1px solid #e8e8e5;display:flex;align-items:center;padding:0 24px;gap:12px}.menu,.close{display:none}.spacer{flex:1}.global-search{width:220px;border:1px solid #ddd;border-radius:999px;padding:9px 13px;font:inherit;margin-right:14px}.global-search:focus{outline:2px solid #ddd}.content{padding:26px;max-width:1450px;margin:auto}.muted{color:#777}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:13px;margin-top:20px}.cards>div,.panel{background:#fff;border:1px solid #e8e8e5;border-radius:14px;padding:17px}.cards small{display:block;color:#777}.cards strong{font-size:26px;display:block;margin-top:7px}.title{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:18px}.primary{background:#111;color:#fff;border:0;border-radius:9px;padding:11px 15px;cursor:pointer}.primary:disabled{opacity:.45}.link,.danger-link{border:0;background:transparent;text-decoration:underline;cursor:pointer;margin-right:8px}.danger-link{color:#b42318}.table{overflow:auto}.table table{width:100%;border-collapse:collapse}.table th,.table td{padding:11px;border-bottom:1px solid #eee;text-align:left;font-size:13px;white-space:nowrap}.table small{display:block;color:#888}.wrap{white-space:normal!important;min-width:250px}.thumb{width:54px;height:54px;object-fit:cover;border-radius:8px}.status{font-size:11px;padding:5px 8px;border-radius:999px;background:#eee}.form{margin-top:18px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.grid label{display:grid;gap:6px;font-size:12px;font-weight:700}.grid input,.grid select,.grid textarea{border:1px solid #ddd;border-radius:9px;padding:10px;font:inherit;font-weight:400;background:#fff}.wide{grid-column:1/-1}.file-label{border:1px dashed #ccc;padding:12px;border-radius:10px}.gallery{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}.gallery-item{position:relative}.gallery img{width:90px;height:90px;object-fit:cover;border-radius:10px}.gallery-item button{position:absolute;right:4px;top:4px;border:0;border-radius:50%;background:#111;color:#fff;width:22px;height:22px;cursor:pointer}.error{color:#b42318;background:#fff0f0;padding:10px;border-radius:9px}.empty{text-align:center;color:#888;padding:35px}.row{display:flex;justify-content:space-between;gap:20px;padding:13px 0;border-bottom:1px solid #eee}.check{display:flex!important;align-items:center;grid-template-columns:auto 1fr}.check input{width:auto}
 @media(max-width:1000px){.cards{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:1fr 1fr}}
 @media(max-width:850px){.side{position:fixed;z-index:20;left:-270px;transition:.2s}.side.open{left:0}.menu,.close{display:block;border:0;background:transparent;color:inherit}.menu{font-size:20px}.close{position:absolute;right:10px;top:10px;font-size:24px}.content{padding:17px}.grid{grid-template-columns:1fr}.wide{grid-column:auto}}
 @media(max-width:480px){.cards{grid-template-columns:1fr}.main header{padding:0 12px}}
 
    .pagination{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:14px 4px 2px;font-size:13px;color:#667085}
    .pagination button{border:1px solid #d9dde5;background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer;font:inherit;color:#111}
    .pagination button:hover:not(:disabled){border-color:#111}
    .pagination button:disabled{opacity:.4;cursor:not-allowed}
    .pagination span{min-width:110px;text-align:center}
    .table td small{display:block;color:#667085;font-size:11px;margin-top:3px}
    .order-items-row td{background:#fafaf8!important;border-top:0!important}
    .order-items{padding:12px 10px;display:grid;gap:10px}
    .order-items>strong{font-size:13px}
    .order-item{display:grid;grid-template-columns:46px minmax(0,1fr) 70px 90px;gap:12px;align-items:center;padding:9px;border:1px solid #e6e7eb;border-radius:10px;background:#fff}
    .order-item img{width:46px;height:52px;object-fit:cover;border-radius:7px;background:#f2f2ef}
    .order-item small{display:block;color:#667085;margin-top:3px}
    .danger-link{border:0;background:transparent;color:#b42318;cursor:pointer;margin-left:8px;font:inherit}
    .danger-link:hover{text-decoration:underline}
`]
})
export class SellerComponent implements OnDestroy {
 private api=inject(BackendApiService); private cats=inject(CategoryService); private auth=inject(AuthService); private router=inject(Router); private cdr=inject(ChangeDetectorRef);
 section='Overview';mobile=false;
 private readonly pageAbort=new AbortController();
 private sectionAbort?: AbortController;
 nav=['Overview','Onboarding','Products','Inventory','Orders','Deliveries','Returns','Coupons','Payments','Commissions','Payouts','Reviews','Analytics','Store Profile','Pickup Address','Bank Details','Reports','Disputes','Support'];
 products:any[]=[];orders:any[]=[];returns:any[]=[];coupons:any[]=[];payouts:any[]=[];reviews:any[]=[];disputes:any[]=[];commissions:any[]=[];application:any=null;categories:any[]=[];
 saving=false;error='';formOpen=false;editingId:number|null=null;selectedFiles:File[]=[];couponOpen=false;
 expandedOrderId:number|null=null;
 coupon:any={code:'',discount:0,expiry:'',active:true};
 report:any={orders:0,sales:0,products:0,returns:0,payouts:0,coupons:0,liveProducts:0,pendingProducts:0};
 draft:any=this.emptyProduct();
 get userName(){return this.auth.user()?.name||'Seller'} get userPhone(){return this.auth.user()?.phone||''}
 get liveCount(){return this.products.filter(p=>p.status==='LIVE').length} get pendingCount(){return this.products.filter(p=>p.status==='PENDING').length}
 get subcategories(){return (this.categories.find(x=>x.name===this.draft.category)?.subcategories||[])}
 constructor(){void this.go('Overview');}
 ngOnDestroy(){
  this.sectionAbort?.abort();
  this.pageAbort.abort();
 }

 private get requestSignal(): AbortSignal {
  return (this.sectionAbort ??= new AbortController()).signal;
 }

 async go(n:string){
  this.sectionAbort?.abort();
  this.sectionAbort=new AbortController();

  this.section=n;
  this.mobile=false;
  this.resetPage(this.listKeyForSection(n));

  // Render the selected tab immediately. Do not wait for the API call.
  // This prevents the first-click blank-screen issue on slow requests.
  this.cdr.markForCheck();

  switch(n){
   case 'Overview':
   case 'Analytics':
   case 'Reports':
    await this.loadReport(); break;

   case 'Onboarding':
   case 'Store Profile':
   case 'Pickup Address':
   case 'Bank Details':
   case 'Store Settings':
    await this.loadApplication(); break;

   case 'Products':
    await this.loadProducts();
    await this.cats.load(this.requestSignal);
    this.categories=this.cats.categories(); break;

   case 'Inventory':
    await this.loadProducts(); break;

   case 'Orders':
   case 'Deliveries':
   case 'Payments':
    await this.loadOrders(); break;

   case 'Returns':
    await this.loadReturns(); break;

   case 'Coupons':
    await this.loadCoupons(); break;

   case 'Commissions':
    await this.loadCommissions(); break;

   case 'Payouts':
    await this.loadPayouts(); break;

   case 'Reviews':
    await this.loadReviews(); break;

   case 'Disputes':
    await this.loadDisputes(); break;
  }
 }

 async loadAll(){ await this.go(this.section); }

 async loadProducts(key:string='products'){ await this.loadPaged(key,'/seller/paged/products','products'); }
 async loadOrders(key:string='orders'){ await this.loadPaged(key,'/seller/paged/orders','orders'); }
 async loadApplication(){
  try{ this.application=await this.api.get('/sellers/applications/me',this.requestSignal); }
  catch{ if(!this.requestSignal.aborted) this.application=null; }
 }

 async loadReturns(){ await this.loadPaged('returns','/seller/paged/returns','returns'); }
 async loadCoupons(){ await this.loadPaged('coupons','/seller/paged/coupons','coupons'); }
 async loadPayouts(){ await this.loadPaged('payouts','/seller/paged/payouts','payouts'); }
 async loadReviews(){ await this.loadPaged('reviews','/seller/paged/reviews','reviews'); }
 async loadDisputes(){ await this.loadPaged('disputes','/seller/paged/disputes','disputes'); }
 async loadCommissions(){ await this.loadPaged('commissions','/seller/paged/commissions','commissions'); }
 private async loadPaged(key:string,path:string,target:string){
  try{const page=Math.max(0,this.page(key)-1),search=encodeURIComponent(this.searchState[key]||'');const data:any=await this.api.get(`${path}?page=${page}&size=${this.pageSize}&search=${search}`,this.requestSignal);if(this.requestSignal.aborted)return;(this as any)[target]=data?.content||[];this.totalState[key]=Number(data?.totalElements||0);if(this.page(key)>Math.max(1,Number(data?.totalPages||1)))this.pageState[key]=Math.max(1,Number(data?.totalPages||1));this.cdr.markForCheck();}catch{if(!this.requestSignal.aborted){(this as any)[target]=[];this.totalState[key]=0;this.cdr.markForCheck();}}
 }

 async loadReport(){
  try{
   this.report=await this.api.get('/reports/summary',this.requestSignal);
    this.cdr.markForCheck();
  }catch{
   if(!this.requestSignal.aborted){
    this.report={orders:0,sales:0,products:0,returns:0,payouts:0,coupons:0,liveProducts:0,pendingProducts:0};
   }
  }
 }
 emptyProduct(){return {name:'',sku:'',brand:'',gender:'',category:'',subcategory:'',type:'Physical',price:0,oldPrice:0,gstPercent:0,stock:0,shippingFee:0,platformFee:0,returnDays:7,warranty:'',material:'',weight:0,dimensions:'',hsnCode:'',taxIncluded:true,featured:false,description:'',images:[],tags:[],colors:[],sizes:[]}}
 openNew(){this.editingId=null;this.selectedFiles=[];this.error='';this.draft=this.emptyProduct();this.formOpen=true}
 edit(p:any){this.editingId=p.id;this.selectedFiles=[];this.error='';this.draft={...this.emptyProduct(),...p,images:[...(p.images||[])],tags:[...(p.tags||[])],colors:[...(p.colors||[])],sizes:[...(p.sizes||[])]};this.formOpen=true}
 parseList(v:string){return (v||'').split(',').map(x=>x.trim()).filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i)}
 selectFiles(e:any){const input=e.target as HTMLInputElement;const files=Array.from(input.files||[]) as File[];this.error='';const invalid=files.find(f=>!f.type.startsWith('image/')||f.size>5*1024*1024);if(invalid){this.selectedFiles=[];this.error=!invalid.type.startsWith('image/')?`${invalid.name} is not an image.`:`${invalid.name} is larger than 5 MB.`;input.value='';return;}const unique=new Map<string,File>();for(const f of files){unique.set(`${f.name}_${f.size}_${f.lastModified}`,f);}this.selectedFiles=Array.from(unique.values());}
 async removeExistingImage(img:string,index:number){if(!this.editingId||!img)return;const match=img.match(/\/products\/(\d+)\/images\/(\d+)$/);if(!match){this.draft.images=(this.draft.images||[]).filter((_:any,i:number)=>i!==index);return;}if(!confirm('Delete this product image?'))return;this.saving=true;this.error='';try{const updated:any=await this.api.delete(`/products/${this.editingId}/images/${match[2]}`);this.draft.images=[...(updated?.images||[])];this.draft.image=updated?.image||this.draft.images[0]||'';await this.loadProducts();}catch(e:any){this.error=e?.error?.error||e?.error?.message||e?.message||'Unable to delete image';}finally{this.saving=false;}}
 previewUrl(file:File):string{return URL.createObjectURL(file);}
 async save(){
  if(!this.draft.name||!this.draft.sku||!this.draft.category||Number(this.draft.price)<=0){
    this.error='Name, SKU, category and price are required'; return;
  }
  if(!this.editingId&&!this.selectedFiles.length&&!this.draft.images?.length){
    this.error='Please upload at least one product image'; return;
  }
  const tooLarge=this.selectedFiles.find(f=>f.size>5*1024*1024);
  if(tooLarge){this.error=`${tooLarge.name} is larger than 5 MB.`;return;}

  this.saving=true; this.error='';
  try{
    const payload={...this.draft,id:undefined,status:undefined};
    let saved:any;

    if(this.editingId){
      saved=await this.api.put(`/products/${this.editingId}`,payload);
      if(this.selectedFiles.length){
        const fd=new FormData();
        this.selectedFiles.forEach(f=>fd.append('files',f,f.name));
        saved=await this.api.upload(`/products/${this.editingId}/images`,fd);
      }
    }else{
      // Create product + all selected images in one multipart request.
      const fd=new FormData();
      fd.append('product',new Blob([JSON.stringify(payload)],{type:'application/json'}));
      this.selectedFiles.forEach(f=>fd.append('files',f,f.name));
      saved=await this.api.upload('/products/multipart',fd);
    }

    this.formOpen=false;
    this.selectedFiles=[];
    await this.loadProducts();
    this.cdr.markForCheck();
  }catch(e:any){
    const server=e?.error;
    this.error=server?.error||server?.message||e?.message||'Unable to save product';
  }finally{
    this.saving=false;
  }
}
 async remove(p:any){if(!confirm(`Delete ${p.name}?`))return;try{await this.api.delete(`/products/${p.id}`);await this.loadProducts()}catch(e:any){alert(e?.error?.error||'Delete failed')}}
 async adjust(p:any,delta:number){try{await this.api.patch(`/products/${p.id}/stock`,{}, {quantity:delta});await this.loadProducts(this.listKeyForSection(this.section))}catch(e:any){alert(e?.error?.error||'Stock update failed')}}
 async setOrderStatus(o:any,status:string){try{await this.api.patch(`/orders/${o.id}/status`,{}, {value:status});await this.loadOrders(this.listKeyForSection(this.section))}catch(e:any){alert(e?.error?.error||'Unable to update order')}}
 toggleOrderDetails(o:any){this.expandedOrderId=this.expandedOrderId===Number(o.id)?null:Number(o.id);}
 canSellerReject(o:any):boolean{return !!o && Number.isFinite(Number(o.id)) && String(o.deliveryStatus||'').toLowerCase()==='processing';}
 async rejectOrder(o:any){
  const reason=prompt('Reason for rejecting this order:','Seller rejected the order');
  if(reason===null||!reason.trim())return;
  try{
   await this.api.patch(`/orders/${o.id}/reject`,{reason:reason.trim()});
   this.expandedOrderId=null;
   await this.loadOrders(this.listKeyForSection(this.section));
  }catch(e:any){alert(e?.error?.error||e?.error?.message||'Unable to reject order');}
 }
 async setReturnStatus(r:any,status:string){try{await this.api.patch(`/returns/${r.id}/status`,{}, {value:status});await this.loadReturns()}catch(e:any){alert(e?.error?.error||'Unable to update return')}}
 openCoupon(){this.coupon={code:'',discount:0,expiry:'',active:true};this.couponOpen=true;this.error=''}
 editCoupon(c:any){this.coupon={...c};this.couponOpen=true;this.error=''}
 async saveCoupon(){try{if(this.coupon.id)await this.api.put(`/coupons/${this.coupon.id}`,this.coupon);else await this.api.post('/coupons',this.coupon);this.couponOpen=false;await this.loadCoupons()}catch(e:any){this.error=e?.error?.error||'Unable to save coupon'}}
 async deleteCoupon(c:any){if(!confirm(`Delete ${c.code}?`))return;try{await this.api.delete(`/coupons/${c.id}`);await this.loadCoupons()}catch(e:any){alert(e?.error?.error||'Delete failed')}}
 async requestPayout(){const amount=prompt('Payout amount (₹):');if(!amount)return;try{await this.api.post('/payouts/request',{amount:Number(amount)});await this.loadPayouts()}catch(e:any){alert(e?.error?.error||'Payout request failed')}}
 async saveSettings(){this.saving=true;this.error='';try{this.application=await this.api.put('/sellers/applications/me',this.application);alert('Store and pickup settings saved')}catch(e:any){this.error=e?.error?.error||'Unable to save settings'}finally{this.saving=false}}
 async respondDispute(d:any){const response=prompt('Enter response',d.response||'');if(response===null)return;try{await this.api.patch(`/disputes/${d.id}/respond`,{response});await this.loadDisputes()}catch(e:any){alert(e?.error?.error||'Unable to respond')}}
 maskedBank(v:string){if(!v)return '—';return v.length>4?'••••'+v.slice(-4):v}
 imageUrl(v:string){return !v?'':/^https?:\/\//.test(v)?v:`http://localhost:8080${v.startsWith('/')?'':'/'}${v}`}
 // Server-side pagination/search: each page button causes a fresh DB query.
 readonly pageSize=10;
 private pageState:Record<string,number>={};
 private totalState:Record<string,number>={};
 private searchState:Record<string,string>={};
 private searchTimer:any;
 page(key:string):number{return this.pageState[key]||1;}
 pageCount(key:string,_length?:number):number{return Math.max(1,Math.ceil((this.totalState[key]||0)/this.pageSize));}
 pageOf<T>(_key:string,rows:T[]):T[]{return rows||[];}
 listKeyForSection(section:string):string{return ({'Products':'products','Inventory':'inventory','Orders':'orders','Deliveries':'deliveries','Returns':'returns','Coupons':'coupons','Payments':'payments','Commissions':'commissions','Payouts':'payouts','Reviews':'reviews','Disputes':'disputes'} as any)[section]||section;}
 search():string{return this.searchState[this.listKeyForSection(this.section)]||'';}
 isListSection():boolean{return ['Products','Inventory','Orders','Deliveries','Returns','Coupons','Payments','Commissions','Payouts','Reviews','Disputes'].includes(this.section);}
 searchChanged(value:string){const key=this.listKeyForSection(this.section);this.searchState[key]=value||'';this.pageState[key]=1;clearTimeout(this.searchTimer);this.searchTimer=setTimeout(()=>this.loadCurrentList(),350);}
 private async loadCurrentList(){switch(this.section){case 'Products':return this.loadProducts();case 'Inventory':return this.loadProducts('inventory');case 'Orders':return this.loadOrders();case 'Deliveries':return this.loadOrders('deliveries');case 'Payments':return this.loadOrders('payments');case 'Returns':return this.loadReturns();case 'Coupons':return this.loadCoupons();case 'Commissions':return this.loadCommissions();case 'Payouts':return this.loadPayouts();case 'Reviews':return this.loadReviews();case 'Disputes':return this.loadDisputes();}}
 prevPage(key:string){if(this.page(key)<=1)return;this.pageState[key]=this.page(key)-1;void this.loadCurrentList();}
 nextPage(key:string,_length?:number){if(this.page(key)>=this.pageCount(key))return;this.pageState[key]=this.page(key)+1;void this.loadCurrentList();}
 resetPage(key:string){this.pageState[key]=1;}

 async logout(){await this.auth.signOut();this.router.navigateByUrl('/login')}}
