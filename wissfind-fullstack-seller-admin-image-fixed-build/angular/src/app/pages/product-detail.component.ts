import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DecimalPipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../core/product.service';
import { CartService } from '../core/cart.service';
import { AuthService } from '../core/auth.service';
import { ProductReview, ReviewService } from '../core/review.service';
import { WishlistService } from '../core/wishlist.service';

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
        <div class="gallery" [class.single-image]="product.images?.length <= 1">
          <div class="gallery-controls"><button type="button" class="auto-btn" (click)="toggleAutoSlide()">{{ isAutoPlaying ? 'Ⅱ Pause' : '▶ Play' }}</button></div>
          <div class="main-image" (mouseenter)="pauseAutoSlide()" (mouseleave)="resumeAutoSlide()"><button class="slide-arrow prev" type="button" (click)="previousImage()" aria-label="Previous image">‹</button><img [src]="selectedImage" [alt]="product.name"><button class="slide-arrow next" type="button" (click)="nextImage()" aria-label="Next image">›</button><div class="slide-progress"><span *ngFor="let image of product.images; let i = index" [class.active]="i === selectedIndex"></span></div><span class="image-count">{{ selectedIndex + 1 }} / {{ product.images.length }}</span></div>
          <div class="thumbs" aria-label="Product images"><button *ngFor="let image of product.images; let i = index" class="thumb" [class.active]="selectedImage === image" (click)="selectImage(image)" [attr.aria-label]="'View image ' + (i + 1)"><img [src]="image" [alt]="product.name + ' view ' + (i + 1)"></button></div>
        </div>
        <div class="copy">
          <div class="eyebrow">{{ product.category }} / {{ product.subcategory }}</div><h1>{{ product.name }}</h1>
          <div class="rating-row"><div class="rating"><span class="big-stars">{{ starText(product.rating) }}</span> <strong>{{ product.rating }}</strong> <span>({{ product.reviews }} reviews)</span></div><button type="button" class="product-like" [class.liked]="wishlist.isWishlisted(product.id)" (click)="toggleWishlist()" [attr.aria-label]="wishlist.isWishlisted(product.id) ? 'Remove from wishlist' : 'Add to wishlist'">{{ wishlist.isWishlisted(product.id) ? '♥' : '♡' }} <span>{{ wishlist.isWishlisted(product.id) ? 'Saved' : 'Wishlist' }}</span></button></div>
          <div class="price"><strong>₹{{ product.price | number }}</strong><del *ngIf="product.oldPrice">₹{{ product.oldPrice | number }}</del></div><p>{{ product.description }}</p>
          <div class="product-specs" *ngIf="product.brand || product.gender || product.material || product.warranty || product.returnDays || product.shippingFee"><div *ngIf="product.brand"><small>Brand</small><strong>{{ product.brand }}</strong></div><div *ngIf="product.gender"><small>For</small><strong>{{ product.gender }}</strong></div><div *ngIf="product.material"><small>Material</small><strong>{{ product.material }}</strong></div><div *ngIf="product.warranty"><small>Warranty</small><strong>{{ product.warranty }}</strong></div><div *ngIf="product.returnDays !== undefined"><small>Returns</small><strong>{{ product.returnDays }} days</strong></div><div><small>Shipping</small><strong>{{ product.shippingFee ? ('₹' + product.shippingFee) : 'Free' }}</strong></div></div>
          <div class="option" *ngIf="product.sizes?.length"><strong>Size</strong><div class="swatches"><button *ngFor="let s of product.sizes">{{ s }}</button></div></div><div class="option" *ngIf="product.colors?.length"><strong>Color</strong><div class="swatches"><button *ngFor="let c of product.colors">{{ c }}</button></div></div>
          <button type="button" class="btn add" (click)="addToCart()">Add to bag</button>
          <div class="share"><strong>Share this product</strong><div class="share-row"><a [href]="facebookUrl" target="_blank" rel="noopener">Facebook</a><a [href]="xUrl" target="_blank" rel="noopener">X</a><button type="button" (click)="shareProduct()">WhatsApp · Image + Link</button></div><small>On mobile, WhatsApp sharing includes the product image and link. On desktop, WhatsApp uses the product page preview image.</small></div>
        </div>
      </section>
      <section class="ai-review-summary"><div><div class="eyebrow">WISSFIND AI</div><h2>Review intelligence</h2><p>AI summary of customer feedback for {{ product.name }}.</p></div><div class="ai-score">{{ aiReviewScore }}/100</div><div class="ai-columns"><div><strong>👍 Customers like</strong><span>{{ aiPros }}</span></div><div><strong>👎 Common complaints</strong><span>{{ aiCons }}</span></div><div><strong>AI verdict</strong><span>{{ aiVerdict }}</span></div></div></section>
      <section class="reviews-section"><div class="reviews-heading"><div><div class="eyebrow">Customer feedback</div><h2>Reviews & ratings</h2></div><div class="review-summary"><strong>{{ averageRating.toFixed(1) }}</strong><span class="big-stars">{{ starText(averageRating) }}</span><small>{{ reviewList.length }} customer reviews</small></div></div><div class="review-layout"><div class="review-list"><article class="review-card" *ngFor="let review of reviewList"><div class="review-top"><div><strong>{{ review.author }}</strong><div class="small-stars">{{ starText(review.rating) }}</div></div><span>{{ review.date }}</span></div><h3>{{ review.title }}</h3><p>{{ review.text }}</p><button type="button" class="helpful" [class.liked]="reviews.isReviewLiked(review.id)" (click)="toggleReviewLike(review.id)">{{ reviews.isReviewLiked(review.id) ? '♥ Helpful' : '♡ Helpful' }} · {{ review.likes + (reviews.isReviewLiked(review.id) ? 1 : 0) }}</button></article></div><aside class="write-review"><h3>Rate this product</h3><p class="muted" *ngIf="!auth.user()">Login to leave a rating and review.</p><div class="star-picker" aria-label="Choose rating"><button *ngFor="let star of [1,2,3,4,5]" type="button" [class.selected]="star <= reviewRating" (click)="reviewRating = star">{{ star <= reviewRating ? '★' : '☆' }}</button></div><input [(ngModel)]="reviewTitle" placeholder="Review title"><textarea [(ngModel)]="reviewText" rows="5" placeholder="Tell other shoppers what you think..."></textarea><button class="btn" type="button" [disabled]="!auth.user()" (click)="submitReview()">Submit review</button><p class="form-message" *ngIf="reviewMessage">{{ reviewMessage }}</p></aside></div></section>
    </div>
    <section class="related-products-section" *ngIf="relatedProducts.length"><div class="related-heading"><div><div class="eyebrow">You may also like</div><h2>Related products</h2></div><button type="button" class="view-all-category" (click)="openAllCategoryProducts()">View all →</button></div><div class="related-grid"><a class="related-card" *ngFor="let related of relatedProducts" [routerLink]="['/product', related.id]" [state]="{product:related}" (click)="openRelatedProduct($event, related)"><div class="related-image"><span class="sale-badge" *ngIf="related.oldPrice">SALE</span><img [src]="related.image" [alt]="related.name"><button type="button" class="related-like" (click)="$event.preventDefault(); $event.stopPropagation(); toggleRelatedWishlist(related.id)">{{ wishlist.isWishlisted(related.id) ? '♥' : '♡' }}</button></div><div class="related-meta"><span class="related-category">{{ related.category }}</span><span class="related-rating">★ {{ related.rating }}</span></div><h3>{{ related.name }}</h3><div class="related-price"><strong>₹{{ related.price | number }}</strong><del *ngIf="related.oldPrice">₹{{ related.oldPrice | number }}</del></div></a></div></section>
    <section id="category-products" class="category-products-section" *ngIf="showAllCategoryProducts"><div class="category-products-heading"><div><div class="eyebrow">Shop this category</div><h2>More {{ product.category }} products</h2><p>Showing products from the same category as {{ product.name }}.</p></div><span class="category-count">{{ categoryProducts.length }} products</span></div><div class="category-products-grid"><a class="category-product-card" *ngFor="let item of pagedCategoryProducts" [routerLink]="['/product', item.id]" [state]="{product:item}" (click)="openRelatedProduct($event, item)"><div class="category-product-image"><span class="sale-badge" *ngIf="item.oldPrice">SALE</span><img [src]="item.image" [alt]="item.name"></div><div class="related-meta"><span class="related-category">{{ item.category }}</span><span class="related-rating">★ {{ item.rating }}</span></div><h3>{{ item.name }}</h3><div class="related-price"><strong>₹{{ item.price | number }}</strong><del *ngIf="item.oldPrice">₹{{ item.oldPrice | number }}</del></div></a></div><nav class="category-pagination" *ngIf="categoryPageCount > 1" aria-label="Category product pages"><button type="button" class="pagination-button" [disabled]="categoryPage === 1" (click)="setCategoryPage(categoryPage - 1)">←</button><button type="button" class="pagination-button" *ngFor="let page of categoryPageNumbers" [class.active]="categoryPage === page" (click)="setCategoryPage(page)">{{ page }}</button><button type="button" class="pagination-button" [disabled]="categoryPage === categoryPageCount" (click)="setCategoryPage(categoryPage + 1)">→</button></nav></section>
  </main>
  `,
  styles: []
})
export class ProductDetailComponent implements OnInit, OnDestroy {
  product: any;
  relatedProducts: any[] = [];
  reviewList: ProductReview[] = [];
  averageRating = 0;
  aiReviewScore = 0;
  aiPros = '';
  aiCons = '';
  aiVerdict = '';
  reviewRating = 5;
  reviewTitle = '';
  reviewText = '';
  reviewMessage = '';
  selectedImage = '';
  selectedIndex = 0;
  isAutoPlaying = true;
  timer?: ReturnType<typeof setInterval>;
  showAllCategoryProducts = false;
  categoryPage = 1;
  categoryPageSize = 8;
  facebookUrl = '';
  xUrl = '';
  private detailRequestId = 0;
  private readonly route = inject(ActivatedRoute);
  private readonly products = inject(ProductService);
  readonly cart = inject(CartService);
  readonly auth = inject(AuthService);
  readonly reviews = inject(ReviewService);
  readonly wishlist = inject(WishlistService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor() {
    // Keep the product gallery visible immediately. Variant selection is hydrated
    // in the background and must not block the first product image paint.
  }

  async ngOnInit() {
    if (this.auth.getRole() === 'CUSTOMER') void this.wishlist.load();
    this.route.paramMap.subscribe(params => {
      const id = Number(params.get('id'));
      if (!Number.isFinite(id) || id <= 0) return;
      const stateProduct = typeof history !== 'undefined' ? (history.state?.product as any) : undefined;
      void this.loadProductDetail(id, stateProduct);
    });
  }

  private async loadProductDetail(id: number, stateProduct?: any) {
    const requestId = ++this.detailRequestId;
    this.stopAutoSlide();
    this.product = undefined;
    this.relatedProducts = [];
    this.reviewList = [];
    this.selectedImage = '';
    this.selectedIndex = 0;
    this.cdr.markForCheck();

    const sameStateProduct = stateProduct && String(stateProduct.id) === String(id);
    if (sameStateProduct) {
      this.product = this.prepareNavigationProduct(stateProduct);
      this.selectedImage = this.product.images?.[0] || this.product.image || '';
      this.startAutoSlide();
      this.cdr.markForCheck();
    }

    try {
      const freshProduct = await this.products.getByIdAsync(id);
      if (requestId !== this.detailRequestId) return;
      if (freshProduct) {
        this.product = freshProduct;
        this.selectedImage = this.product.images?.[0] || this.product.image || '';
        this.startAutoSlide();
        this.cdr.markForCheck();
      }
    } catch {}

    if (requestId !== this.detailRequestId) return;
    if (!this.product) {
      void this.router.navigateByUrl('/');
      return;
    }

    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    this.facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    this.xUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(this.product.name || '')}`;
    this.cdr.markForCheck();

    const relatedPromise = this.products.getRelated(this.product.category, id).catch(() => []);
    const reviewsPromise = this.reviews.getReviews(id).catch(() => []);
    const [related, reviews] = await Promise.all([relatedPromise, reviewsPromise]);
    if (requestId !== this.detailRequestId) return;
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

  openRelatedProduct(event: Event, product: any) {
    event.preventDefault();
    event.stopPropagation();
    void this.router.navigate(['/product', product.id], { state: { product } });
  }

  private prepareNavigationProduct(raw: any): any {
    const product = { ...raw };
    const vp = product.variantPreview?.hasVariants ? product.variantPreview : undefined;
    if (vp?.image) {
      product.image = vp.image;
      product.images = [vp.image];
      product.price = Number(vp.price ?? product.price ?? 0);
      product.oldPrice = vp.oldPrice == null ? product.oldPrice : Number(vp.oldPrice);
      product.stock = Number(vp.stock ?? product.stock ?? 0);
    } else {
      product.images = Array.isArray(product.images) ? [...product.images] : (product.image ? [product.image] : []);
    }
    return product;
  }

  ngOnDestroy() { this.detailRequestId++; this.stopAutoSlide(); }
  startAutoSlide() { this.stopAutoSlide(); if (this.isAutoPlaying) this.timer = setInterval(() => this.nextImage(), 4500); }
  stopAutoSlide() { if (this.timer) { clearInterval(this.timer); this.timer = undefined; } }
  pauseAutoSlide() { this.stopAutoSlide(); }
  resumeAutoSlide() { if (this.isAutoPlaying) this.startAutoSlide(); }
  toggleAutoSlide() { this.isAutoPlaying = !this.isAutoPlaying; this.isAutoPlaying ? this.startAutoSlide() : this.stopAutoSlide(); }
  selectImage(image: string) { this.selectedImage = image; this.selectedIndex = this.product.images.indexOf(image); }
  previousImage() { if (!this.product?.images?.length) return; this.selectedIndex = (this.selectedIndex - 1 + this.product.images.length) % this.product.images.length; this.selectedImage = this.product.images[this.selectedIndex]; }
  nextImage() { if (!this.product?.images?.length) return; this.selectedIndex = (this.selectedIndex + 1) % this.product.images.length; this.selectedImage = this.product.images[this.selectedIndex]; }
  starText(rating: number) { const full = Math.round(Number(rating || 0)); return '★'.repeat(full) + '☆'.repeat(Math.max(0, 5 - full)); }
  async addToCart() {
    if (!this.product?.id) return;
    this.cart.add(this.product);
    this.cdr.markForCheck();
    const navigated = await this.router.navigateByUrl('/cart');
    if (!navigated && typeof window !== 'undefined') window.location.assign('/cart');
  }
  async toggleProductLike() { await this.reviews.toggleProductLike(this.product.id); this.cdr.markForCheck(); }
  async toggleWishlist() { if (!this.auth.user()) { await this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } }); return; } await this.wishlist.toggle(this.product.id); this.cdr.markForCheck(); }
  async toggleReviewLike(id: number) { await this.reviews.toggleReviewLike(id); this.cdr.markForCheck(); }
  async submitReview() { if (!this.auth.user()) return; this.reviewMessage = await this.reviews.addReview(this.product.id, { rating: this.reviewRating, title: this.reviewTitle, text: this.reviewText }); this.reviewTitle = ''; this.reviewText = ''; this.reviewList = await this.reviews.getReviews(this.product.id); this.averageRating = this.reviewList.reduce((sum, r) => sum + r.rating, 0) / this.reviewList.length; this.cdr.markForCheck(); }
  isRelatedLiked(id: number) { return this.wishlist.isWishlisted(id); }
  async toggleRelatedWishlist(id: number) { await this.wishlist.toggle(id); this.cdr.markForCheck(); }
  async openAllCategoryProducts() { this.showAllCategoryProducts = true; this.categoryProducts = await this.products.getByCategory(this.product.category); this.setCategoryPage(1); setTimeout(() => document.getElementById('category-products')?.scrollIntoView({ behavior: 'smooth' })); this.cdr.markForCheck(); }
  setCategoryPage(page: number) { const count = Math.max(1, Math.ceil(this.categoryProducts.length / this.categoryPageSize)); this.categoryPage = Math.min(Math.max(1, page), count); const start = (this.categoryPage - 1) * this.categoryPageSize; this.pagedCategoryProducts = this.categoryProducts.slice(start, start + this.categoryPageSize); }
  get categoryPageCount() { return Math.ceil(this.categoryProducts.length / this.categoryPageSize); }
  get categoryPageNumbers() { return Array.from({ length: this.categoryPageCount }, (_, i) => i + 1); }
  async shareProduct() { const text = `${this.product.name} - ${window.location.href}`; if (navigator.share) await navigator.share({ title: this.product.name, text, url: window.location.href }); else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank'); }
  categoryProducts: any[] = [];
  pagedCategoryProducts: any[] = [];
}
