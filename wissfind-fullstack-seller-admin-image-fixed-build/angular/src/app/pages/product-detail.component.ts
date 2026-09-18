import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DecimalPipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../core/product.service';
import { CartService } from '../core/cart.service';
import { AuthService } from '../core/auth.service';
import { ProductReview, ReviewService } from '../core/review.service';

// Existing template/styles are intentionally preserved. The important fix is
// that review data is loaded asynchronously and this application uses zoneless
// change detection, so the view must be explicitly refreshed after the await.

@Component({
  standalone: true,
  selector: 'app-product-detail',
  imports: [NgIf, NgFor, RouterLink, DecimalPipe, FormsModule],
  template: `
  <main class="page" *ngIf="product">
    <div class="container">
      <a routerLink="/" class="back">← Back to shop</a>
      <section class="detail">
        <div class="gallery">
          <div class="gallery-controls"><button type="button" class="auto-btn" (click)="toggleAutoSlide()">{{ isAutoPlaying ? 'Ⅱ Pause' : '▶ Play' }}</button></div>
          <div class="thumbs" aria-label="Product images"><button *ngFor="let image of product.images; let i = index" class="thumb" [class.active]="selectedImage === image" (click)="selectImage(image)" [attr.aria-label]="'View image ' + (i + 1)"><img [src]="image" [alt]="product.name + ' view ' + (i + 1)"></button></div>
          <div class="main-image" (mouseenter)="pauseAutoSlide()" (mouseleave)="resumeAutoSlide()"><button class="slide-arrow prev" type="button" (click)="previousImage()" aria-label="Previous image">‹</button><img [src]="selectedImage" [alt]="product.name"><button class="slide-arrow next" type="button" (click)="nextImage()" aria-label="Next image">›</button><div class="slide-progress"><span *ngFor="let image of product.images; let i = index" [class.active]="i === selectedIndex"></span></div><span class="image-count">{{ selectedIndex + 1 }} / {{ product.images.length }}</span></div>
        </div>
        <div class="copy">
          <div class="eyebrow">{{ product.category }} / {{ product.subcategory }}</div><h1>{{ product.name }}</h1>
          <div class="rating-row"><div class="rating"><span class="big-stars">{{ starText(product.rating) }}</span> <strong>{{ product.rating }}</strong> <span>({{ product.reviews }} reviews)</span></div><button type="button" class="product-like" [class.liked]="reviews.isProductLiked(product.id)" (click)="toggleProductLike()">{{ reviews.isProductLiked(product.id) ? '♥' : '♡' }} <span>{{ reviews.getProductLikeCount(product.id) }}</span></button></div>
          <div class="price"><strong>₹{{ product.price | number }}</strong><del *ngIf="product.oldPrice">₹{{ product.oldPrice | number }}</del></div><p>{{ product.description }}</p>
          <div class="product-specs" *ngIf="product.brand || product.gender || product.material || product.warranty || product.returnDays || product.shippingFee"><div *ngIf="product.brand"><small>Brand</small><strong>{{ product.brand }}</strong></div><div *ngIf="product.gender"><small>For</small><strong>{{ product.gender }}</strong></div><div *ngIf="product.material"><small>Material</small><strong>{{ product.material }}</strong></div><div *ngIf="product.warranty"><small>Warranty</small><strong>{{ product.warranty }}</strong></div><div *ngIf="product.returnDays !== undefined"><small>Returns</small><strong>{{ product.returnDays }} days</strong></div><div><small>Shipping</small><strong>{{ product.shippingFee ? ('₹' + product.shippingFee) : 'Free' }}</strong></div></div>
          <div class="option" *ngIf="product.sizes?.length"><strong>Size</strong><div class="swatches"><button *ngFor="let s of product.sizes">{{ s }}</button></div></div><div class="option" *ngIf="product.colors?.length"><strong>Color</strong><div class="swatches"><button *ngFor="let c of product.colors">{{ c }}</button></div></div>
          <button class="btn add" (click)="addToCart()">Add to bag</button>
          <div class="share"><strong>Share this product</strong><div class="share-row"><a [href]="facebookUrl" target="_blank" rel="noopener">Facebook</a><a [href]="xUrl" target="_blank" rel="noopener">X</a><button type="button" (click)="shareProduct()">WhatsApp · Image + Link</button></div><small>On mobile, WhatsApp sharing includes the product image and link. On desktop, WhatsApp uses the product page preview image.</small></div>
        </div>
      </section>
      <section class="ai-review-summary"><div><div class="eyebrow">WISSFIND AI</div><h2>Review intelligence</h2><p>AI summary of customer feedback for {{ product.name }}.</p></div><div class="ai-score">{{ aiReviewScore }}/100</div><div class="ai-columns"><div><strong>👍 Customers like</strong><span>{{ aiPros }}</span></div><div><strong>👎 Common complaints</strong><span>{{ aiCons }}</span></div><div><strong>AI verdict</strong><span>{{ aiVerdict }}</span></div></div></section>
      <section class="reviews-section"><div class="reviews-heading"><div><div class="eyebrow">Customer feedback</div><h2>Reviews & ratings</h2></div><div class="review-summary"><strong>{{ averageRating.toFixed(1) }}</strong><span class="big-stars">{{ starText(averageRating) }}</span><small>{{ reviewList.length }} customer reviews</small></div></div><div class="review-layout"><div class="review-list"><article class="review-card" *ngFor="let review of reviewList"><div class="review-top"><div><strong>{{ review.author }}</strong><div class="small-stars">{{ starText(review.rating) }}</div></div><span>{{ review.date }}</span></div><h3>{{ review.title }}</h3><p>{{ review.text }}</p><button type="button" class="helpful" [class.liked]="reviews.isReviewLiked(review.id)" (click)="toggleReviewLike(review.id)">{{ reviews.isReviewLiked(review.id) ? '♥ Helpful' : '♡ Helpful' }} · {{ review.likes + (reviews.isReviewLiked(review.id) ? 1 : 0) }}</button></article></div><aside class="write-review"><h3>Rate this product</h3><p class="muted" *ngIf="!auth.user()">Login to leave a rating and review.</p><div class="star-picker" aria-label="Choose rating"><button *ngFor="let star of [1,2,3,4,5]" type="button" [class.selected]="star <= reviewRating" (click)="reviewRating = star">{{ star <= reviewRating ? '★' : '☆' }}</button></div><input [(ngModel)]="reviewTitle" placeholder="Review title"><textarea [(ngModel)]="reviewText" rows="5" placeholder="Tell other shoppers what you think..."></textarea><button class="btn" type="button" [disabled]="!auth.user()" (click)="submitReview()">Submit review</button><p class="form-message" *ngIf="reviewMessage">{{ reviewMessage }}</p></aside></div></section>
    </div>
    <section class="related-products-section" *ngIf="relatedProducts.length"><div class="related-heading"><div><div class="eyebrow">You may also like</div><h2>Related products</h2></div><button type="button" class="view-all-category" (click)="openAllCategoryProducts()">View all →</button></div><div class="related-grid"><a class="related-card" *ngFor="let related of relatedProducts" [routerLink]="['/product', related.id]"><div class="related-image"><span class="sale-badge" *ngIf="related.oldPrice">SALE</span><img [src]="related.image" [alt]="related.name"><button type="button" class="related-like" (click)="$event.preventDefault(); $event.stopPropagation(); toggleRelatedLike(related.id)">{{ isRelatedLiked(related.id) ? '♥' : '♡' }}</button></div><div class="related-meta"><span class="related-category">{{ related.category }}</span><span class="related-rating">★ {{ related.rating }}</span></div><h3>{{ related.name }}</h3><div class="related-price"><strong>₹{{ related.price | number }}</strong><del *ngIf="related.oldPrice">₹{{ related.oldPrice | number }}</del></div></a></div></section>
    <section id="category-products" class="category-products-section" *ngIf="showAllCategoryProducts"><div class="category-products-heading"><div><div class="eyebrow">Shop this category</div><h2>More {{ product.category }} products</h2><p>Showing products from the same category as {{ product.name }}.</p></div><span class="category-count">{{ categoryProducts.length }} products</span></div><div class="category-products-grid"><a class="category-product-card" *ngFor="let item of pagedCategoryProducts" [routerLink]="['/product', item.id]"><div class="category-product-image"><span class="sale-badge" *ngIf="item.oldPrice">SALE</span><img [src]="item.image" [alt]="item.name"></div><div class="related-meta"><span class="related-category">{{ item.category }}</span><span class="related-rating">★ {{ item.rating }}</span></div><h3>{{ item.name }}</h3><div class="related-price"><strong>₹{{ item.price | number }}</strong><del *ngIf="item.oldPrice">₹{{ item.oldPrice | number }}</del></div></a></div><nav class="category-pagination" *ngIf="categoryPageCount > 1" aria-label="Category product pages"><button type="button" class="pagination-button" [disabled]="categoryPage === 1" (click)="setCategoryPage(categoryPage - 1)">←</button><button type="button" class="pagination-button" *ngFor="let page of categoryPageNumbers" [class.active]="categoryPage === page" (click)="setCategoryPage(page)">{{ page }}</button><button type="button" class="pagination-button" [disabled]="categoryPage === categoryPageCount" (click)="setCategoryPage(categoryPage + 1)">→</button></nav></section>
  </main>
  `,
  styles: [`
    .view-all-category{border:1px solid var(--line);background:#fff;color:#111;border-radius:999px;padding:10px 16px;font:inherit;font-weight:700;cursor:pointer}.view-all-category:hover{border-color:#111}.category-products-section{margin:76px 0 30px;padding-top:42px;border-top:1px solid var(--line);scroll-margin-top:30px}.category-products-heading{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:24px}.category-products-heading h2{margin:6px 0 7px;font-size:32px;letter-spacing:-.04em}.category-products-heading p{margin:0;color:#777}.category-count{color:#777;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.category-products-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:28px 18px}.category-product-card{color:inherit;text-decoration:none;min-width:0}.category-product-image{position:relative;height:285px;border-radius:18px;overflow:hidden;background:#f1f1ef}.category-product-image img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s ease}.category-product-card:hover .category-product-image img{transform:scale(1.035)}.category-product-card h3{font-size:16px;margin:8px 0 7px}.category-pagination{display:flex;justify-content:center;align-items:center;gap:8px;margin-top:38px}.pagination-button{min-width:40px;height:40px;padding:0 12px;border:1px solid var(--line);background:#fff;border-radius:999px;cursor:pointer;font:inherit}.pagination-button:hover:not(:disabled){border-color:#111}.pagination-button.active{background:#111;color:#fff;border-color:#111}.pagination-button:disabled{opacity:.35;cursor:not-allowed}
    @media(max-width:1000px){.category-products-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.related-grid{grid-template-columns:repeat(2,minmax(0,1fr))}} @media(max-width:600px){.category-products-grid{grid-template-columns:1fr 1fr;gap:22px 12px}.category-product-image{height:210px}.category-products-heading{align-items:start}.category-products-heading h2{font-size:26px}.category-count{display:none}.related-grid{grid-template-columns:1fr 1fr}.related-image{height:210px}.related-heading h2{font-size:26px}}
    .ai-review-summary{margin-top:22px;background:#111;color:#fff;border-radius:20px;padding:22px;display:grid;grid-template-columns:1fr auto;gap:8px 20px}.ai-review-summary .eyebrow{color:#aaa}.ai-review-summary h2{margin:6px 0;font-size:24px}.ai-review-summary p{margin:0;color:#aaa;font-size:12px}.ai-score{font-size:28px;font-weight:900;align-self:center}.ai-columns{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}.ai-columns div{background:#1d1d1d;border-radius:12px;padding:13px;display:grid;gap:7px}.ai-columns strong{font-size:12px}.ai-columns span{font-size:11px;line-height:1.5;color:#aaa}.related-products-section{margin:76px 0 20px;padding-top:42px;border-top:1px solid var(--line)}.related-heading{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:22px}.related-heading h2{margin:6px 0 0;font-size:32px;letter-spacing:-.04em}.related-heading a{color:#111;text-decoration:none;font-weight:700}.related-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}.related-card{color:inherit;text-decoration:none;min-width:0}.related-image{position:relative;height:285px;border-radius:18px;overflow:hidden;background:#f1f1ef}.related-image img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s ease}.related-card:hover .related-image img{transform:scale(1.035)}.sale-badge{position:absolute;z-index:2;top:12px;left:12px;background:#fff;border-radius:999px;padding:7px 10px;font-size:10px;font-weight:800}.related-like{position:absolute;z-index:3;right:12px;top:12px;width:36px;height:36px;border:0;border-radius:50%;background:#fff;font-size:18px;cursor:pointer}.related-meta{display:flex;justify-content:space-between;gap:10px;margin-top:12px;font-size:11px;color:#777;text-transform:uppercase;letter-spacing:.06em}.related-rating{color:#666;text-transform:none;letter-spacing:0}.related-card h3{font-size:16px;margin:8px 0 7px}.related-price{display:flex;align-items:center;gap:8px}.related-price strong{font-size:15px}.related-price del{font-size:12px;color:#999}.back{display:inline-block;color:#666;font-size:13px;margin-bottom:24px}.detail{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(420px,.92fr);gap:54px;align-items:start}.gallery{display:grid;grid-template-columns:88px minmax(0,1fr);gap:14px;min-width:0}.gallery-controls{grid-column:1/-1;display:flex;justify-content:flex-end;margin-bottom:-2px}.auto-btn{border:1px solid var(--line);background:#fff;border-radius:999px;padding:7px 11px;font-size:11px;font-weight:700}.thumbs{display:grid;grid-auto-rows:88px;gap:10px;align-content:start}.thumb{padding:0;border:1px solid var(--line);background:#eee;border-radius:12px;overflow:hidden;cursor:pointer;opacity:.78;transition:.2s}.thumb:hover,.thumb.active{opacity:1;border-color:#111;box-shadow:0 0 0 1px #111}.thumb img{width:100%;height:100%;object-fit:cover}.main-image{position:relative;background:#f1f1ef;border-radius:18px;overflow:hidden;aspect-ratio:1/1}.main-image>img{width:100%;height:100%;object-fit:cover;display:block}.slide-arrow{position:absolute;top:50%;transform:translateY(-50%);z-index:2;border:0;border-radius:50%;width:38px;height:38px;background:rgba(255,255,255,.9);font-size:24px;cursor:pointer}.slide-arrow.prev{left:12px}.slide-arrow.next{right:12px}.slide-progress{position:absolute;left:16px;right:16px;bottom:12px;display:flex;gap:4px}.slide-progress span{height:3px;flex:1;background:rgba(255,255,255,.55);border-radius:9px}.slide-progress span.active{background:#111}.image-count{position:absolute;right:12px;bottom:20px;background:#fff;border-radius:999px;padding:4px 8px;font-size:10px}.copy h1{font-size:42px;letter-spacing:-.05em;margin:5px 0 12px}.eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#777;font-weight:800}.rating-row{display:flex;justify-content:space-between;align-items:center;gap:12px}.rating{font-size:12px;color:#777}.big-stars{color:#111;letter-spacing:1px}.product-like{border:1px solid var(--line);background:#fff;border-radius:999px;padding:7px 10px;cursor:pointer}.product-like.liked{background:#111;color:#fff}.price{display:flex;align-items:center;gap:10px;margin:22px 0 12px}.price strong{font-size:28px}.price del{color:#999}.copy>p{line-height:1.65;color:#555}.product-specs{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:24px 0}.product-specs div{padding:11px;background:#f7f7f4;border-radius:10px}.product-specs small,.product-specs strong{display:block}.product-specs small{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.08em}.product-specs strong{font-size:12px;margin-top:4px}.option{margin:18px 0}.swatches{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}.swatches button{background:#fff;border:1px solid var(--line);border-radius:8px;padding:9px 12px}.btn{border:0;background:#111;color:#fff;border-radius:10px;padding:13px 18px;font-weight:800;cursor:pointer}.btn:disabled{opacity:.4}.add{width:100%;margin-top:10px}.share{margin-top:18px;padding-top:18px;border-top:1px solid var(--line)}.share-row{display:flex;gap:8px;flex-wrap:wrap;margin:9px 0}.share-row a,.share-row button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:8px 11px;text-decoration:none;color:#111;font:inherit}.share small{font-size:10px;color:#888}.reviews-section{margin-top:60px;padding-top:42px;border-top:1px solid var(--line)}.reviews-heading{display:flex;justify-content:space-between;gap:20px}.reviews-heading h2{margin:6px 0 20px}.review-summary{display:grid;justify-items:end;gap:3px}.review-summary strong{font-size:26px}.review-summary small{color:#777}.review-layout{display:grid;grid-template-columns:1.4fr .8fr;gap:20px}.review-list{display:grid;gap:10px}.review-card,.write-review{border:1px solid var(--line);border-radius:14px;padding:15px}.review-top{display:flex;justify-content:space-between;color:#777;font-size:11px}.small-stars{color:#111;margin-top:3px}.review-card h3{font-size:15px;margin:10px 0 6px}.review-card p{font-size:12px;line-height:1.6;color:#555}.helpful{border:0;background:#f7f7f4;border-radius:999px;padding:7px 10px}.write-review{display:grid;gap:10px;align-content:start}.write-review h3{margin:0}.muted,.form-message{font-size:12px;color:#777}.star-picker{display:flex;gap:2px}.star-picker button{border:0;background:none;font-size:25px;cursor:pointer}.write-review input,.write-review textarea{border:1px solid var(--line);border-radius:8px;padding:10px;font:inherit}.related-products-section{margin-top:60px}.category-products-section{margin-top:60px}@media(max-width:900px){.detail{grid-template-columns:1fr}.copy h1{font-size:34px}.review-layout{grid-template-columns:1fr}.ai-columns{grid-template-columns:1fr}.product-specs{grid-template-columns:repeat(2,1fr)}}
  `]
})
export class ProductDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private products = inject(ProductService);
  private cart = inject(CartService);
  auth = inject(AuthService);
  reviews = inject(ReviewService);
  private cdr = inject(ChangeDetectorRef);
  product: any;
  relatedProducts: any[] = [];
  categoryProducts: any[] = [];
  pagedCategoryProducts: any[] = [];
  selectedImage = '';
  selectedIndex = 0;
  isAutoPlaying = true;
  private timer?: ReturnType<typeof setInterval>;
  averageRating = 0;
  reviewList: ProductReview[] = [];
  reviewRating = 5;
  reviewTitle = '';
  reviewText = '';
  reviewMessage = '';
  aiReviewScore = 0;
  aiPros = '';
  aiCons = '';
  aiVerdict = '';
  showAllCategoryProducts = false;
  categoryPage = 1;
  categoryPageSize = 8;
  facebookUrl = '';
  xUrl = '';

  constructor() {
    // Keep the product gallery visible immediately. Variant selection is hydrated
    // in the background and must not block the first product image paint.
  }

  async ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.product = await this.products.getByIdAsync(id);
    if (!this.product) { this.router.navigateByUrl('/'); return; }
    this.selectedImage = this.product.images?.[0] || this.product.image || '';
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    this.facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    this.xUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(this.product.name || '')}`;
    this.startAutoSlide();
    this.cdr.markForCheck();

    // Secondary data must never block the first product paint.
    const relatedPromise = this.products.getRelated(this.product.category, id).catch(() => []);
    const reviewsPromise = this.reviews.getReviews(id).catch(() => []);
    const [related, reviews] = await Promise.all([relatedPromise, reviewsPromise]);
    this.relatedProducts = related.slice(0, 4);
    this.reviewList = reviews;
    this.averageRating = this.reviewList.length
      ? this.reviewList.reduce((sum, r) => sum + r.rating, 0) / this.reviewList.length
      : Number(this.product.rating || 0);
    this.aiReviewScore = Math.round(this.averageRating * 20);
    this.aiPros = this.averageRating >= 4 ? 'Strong overall customer satisfaction.' : 'Customers have mixed feedback.';
    this.aiCons = this.averageRating < 4 ? 'Some customers report room for improvement.' : 'No recurring issue is dominant.';
    this.aiVerdict = this.averageRating >= 4 ? 'Generally positive customer feedback.' : 'Review the detailed feedback before buying.';
    this.cdr.markForCheck();
  }

  ngOnDestroy() { this.stopAutoSlide(); }
  startAutoSlide() { this.stopAutoSlide(); if (this.isAutoPlaying) this.timer = setInterval(() => this.nextImage(), 4500); }
  stopAutoSlide() { if (this.timer) { clearInterval(this.timer); this.timer = undefined; } }
  pauseAutoSlide() { this.stopAutoSlide(); }
  resumeAutoSlide() { if (this.isAutoPlaying) this.startAutoSlide(); }
  toggleAutoSlide() { this.isAutoPlaying = !this.isAutoPlaying; this.isAutoPlaying ? this.startAutoSlide() : this.stopAutoSlide(); }
  selectImage(image: string) { this.selectedImage = image; this.selectedIndex = this.product.images.indexOf(image); }
  previousImage() { if (!this.product?.images?.length) return; this.selectedIndex = (this.selectedIndex - 1 + this.product.images.length) % this.product.images.length; this.selectedImage = this.product.images[this.selectedIndex]; }
  nextImage() { if (!this.product?.images?.length) return; this.selectedIndex = (this.selectedIndex + 1) % this.product.images.length; this.selectedImage = this.product.images[this.selectedIndex]; }
  starText(rating: number) { const full = Math.round(Number(rating || 0)); return '★'.repeat(full) + '☆'.repeat(Math.max(0, 5 - full)); }
  async addToCart() { await this.cart.add(this.product); }
  async toggleProductLike() { await this.reviews.toggleProductLike(this.product.id); this.cdr.markForCheck(); }
  async toggleReviewLike(id: number) { await this.reviews.toggleReviewLike(id); this.cdr.markForCheck(); }
  async submitReview() { if (!this.auth.user()) return; this.reviewMessage = await this.reviews.addReview(this.product.id, { rating: this.reviewRating, title: this.reviewTitle, text: this.reviewText }); this.reviewTitle = ''; this.reviewText = ''; this.reviewList = await this.reviews.getReviews(this.product.id); this.averageRating = this.reviewList.reduce((sum, r) => sum + r.rating, 0) / this.reviewList.length; this.cdr.markForCheck(); }
  isRelatedLiked(id: number) { return this.reviews.isProductLiked(id); }
  async toggleRelatedLike(id: number) { await this.reviews.toggleProductLike(id); this.cdr.markForCheck(); }
  async openAllCategoryProducts() { this.showAllCategoryProducts = true; this.categoryProducts = await this.products.getByCategory(this.product.category); this.setCategoryPage(1); setTimeout(() => document.getElementById('category-products')?.scrollIntoView({ behavior: 'smooth' })); this.cdr.markForCheck(); }
  setCategoryPage(page: number) { const count = Math.max(1, Math.ceil(this.categoryProducts.length / this.categoryPageSize)); this.categoryPage = Math.min(Math.max(1, page), count); const start = (this.categoryPage - 1) * this.categoryPageSize; this.pagedCategoryProducts = this.categoryProducts.slice(start, start + this.categoryPageSize); }
  get categoryPageCount() { return Math.ceil(this.categoryProducts.length / this.categoryPageSize); }
  get categoryPageNumbers() { return Array.from({ length: this.categoryPageCount }, (_, i) => i + 1); }
  async shareProduct() { const text = `${this.product.name} - ${window.location.href}`; if (navigator.share) await navigator.share({ title: this.product.name, text, url: window.location.href }); else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank'); }
}
