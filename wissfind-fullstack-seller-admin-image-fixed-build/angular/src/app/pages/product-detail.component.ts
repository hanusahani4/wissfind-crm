import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DecimalPipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../core/product.service';
import { CartService } from '../core/cart.service';
import { AuthService } from '../core/auth.service';
import { ProductReview, ReviewService } from '../core/review.service';

@Component({
  standalone: true,
  imports: [NgIf, NgFor, RouterLink, DecimalPipe, FormsModule],
  template: `
  <main class="page" *ngIf="product">
    <div class="container">
      <a routerLink="/" class="back">← Back to shop</a>

      <section class="detail">
        <div class="gallery">
          <div class="gallery-controls">
            <button type="button" class="auto-btn" (click)="toggleAutoSlide()">
              {{ isAutoPlaying ? 'Ⅱ Pause' : '▶ Play' }}
            </button>
          </div>

          <div class="thumbs" aria-label="Product images">
            <button
              *ngFor="let image of product.images; let i = index"
              class="thumb"
              [class.active]="selectedImage === image"
              (click)="selectImage(image)"
              [attr.aria-label]="'View image ' + (i + 1)">
              <img [src]="image" [alt]="product.name + ' view ' + (i + 1)">
            </button>
          </div>

          <div class="main-image"
               (mouseenter)="pauseAutoSlide()"
               (mouseleave)="resumeAutoSlide()">
            <button class="slide-arrow prev"
                    type="button"
                    (click)="previousImage()"
                    aria-label="Previous image">‹</button>

            <img [src]="selectedImage" [alt]="product.name">

            <button class="slide-arrow next"
                    type="button"
                    (click)="nextImage()"
                    aria-label="Next image">›</button>

            <div class="slide-progress">
              <span *ngFor="let image of product.images; let i = index"
                    [class.active]="i === selectedIndex"></span>
            </div>

            <span class="image-count">{{ selectedIndex + 1 }} / {{ product.images.length }}</span>
          </div>
        </div>

        <div class="copy">
          <div class="eyebrow">{{ product.category }} / {{ product.subcategory }}</div>
          <h1>{{ product.name }}</h1>
          <div class="rating-row">
            <div class="rating"><span class="big-stars">{{ starText(product.rating) }}</span> <strong>{{ product.rating }}</strong> <span>({{ product.reviews }} reviews)</span></div>
            <button type="button" class="product-like" [class.liked]="reviews.isProductLiked(product.id)" (click)="toggleProductLike()">
              {{ reviews.isProductLiked(product.id) ? '♥' : '♡' }}
              <span>{{ reviews.getProductLikeCount(product.id) }}</span>
            </button>
          </div>

          <div class="price">
            <strong>₹{{ product.price | number }}</strong>
            <del *ngIf="product.oldPrice">₹{{ product.oldPrice | number }}</del>
          </div>

          <p>{{ product.description }}</p>

          <div class="product-specs" *ngIf="product.brand || product.gender || product.material || product.warranty || product.returnDays || product.shippingFee">
            <div *ngIf="product.brand"><small>Brand</small><strong>{{ product.brand }}</strong></div>
            <div *ngIf="product.gender"><small>For</small><strong>{{ product.gender }}</strong></div>
            <div *ngIf="product.material"><small>Material</small><strong>{{ product.material }}</strong></div>
            <div *ngIf="product.warranty"><small>Warranty</small><strong>{{ product.warranty }}</strong></div>
            <div *ngIf="product.returnDays !== undefined"><small>Returns</small><strong>{{ product.returnDays }} days</strong></div>
            <div><small>Shipping</small><strong>{{ product.shippingFee ? ('₹' + product.shippingFee) : 'Free' }}</strong></div>
          </div>

          <div class="option" *ngIf="product.sizes?.length">
            <strong>Size</strong>
            <div class="swatches"><button *ngFor="let s of product.sizes">{{ s }}</button></div>
          </div>

          <div class="option" *ngIf="product.colors?.length">
            <strong>Color</strong>
            <div class="swatches">
              <button *ngFor="let c of product.colors">{{ c }}</button>
            </div>
          </div>

          <button class="btn add" (click)="addToCart()">Add to bag</button>

          <div class="share">
            <strong>Share this product</strong>
            <div class="share-row">
              <a [href]="facebookUrl" target="_blank" rel="noopener">Facebook</a>
              <a [href]="xUrl" target="_blank" rel="noopener">X</a>
              <a [href]="whatsappUrl" target="_blank" rel="noopener">WhatsApp</a>
              <button *ngIf="canNativeShare" (click)="nativeShare()">Share image + link</button>
            </div>
            <small>Social links share the product page URL. Native share can include the selected product image.</small>
          </div>
        </div>
      </section>

      <section class="ai-review-summary">
        <div>
          <div class="eyebrow">WISSFIND AI</div>
          <h2>Review intelligence</h2>
          <p>AI summary of customer feedback for {{ product.name }}.</p>
        </div>
        <div class="ai-score">{{ aiReviewScore }}/100</div>
        <div class="ai-columns">
          <div><strong>👍 Customers like</strong><span>{{ aiPros }}</span></div>
          <div><strong>👎 Common complaints</strong><span>{{ aiCons }}</span></div>
          <div><strong>AI verdict</strong><span>{{ aiVerdict }}</span></div>
        </div>
      </section>

      <section class="reviews-section">
        <div class="reviews-heading">
          <div>
            <div class="eyebrow">Customer feedback</div>
            <h2>Reviews & ratings</h2>
          </div>
          <div class="review-summary">
            <strong>{{ averageRating.toFixed(1) }}</strong>
            <span class="big-stars">{{ starText(averageRating) }}</span>
            <small>{{ reviewList.length }} customer reviews</small>
          </div>
        </div>

        <div class="review-layout">
          <div class="review-list">
            <article class="review-card" *ngFor="let review of reviewList">
              <div class="review-top">
                <div>
                  <strong>{{ review.author }}</strong>
                  <div class="small-stars">{{ starText(review.rating) }}</div>
                </div>
                <span>{{ review.date }}</span>
              </div>
              <h3>{{ review.title }}</h3>
              <p>{{ review.text }}</p>
              <button type="button"
                      class="helpful"
                      [class.liked]="reviews.isReviewLiked(review.id)"
                      (click)="toggleReviewLike(review.id)">
                {{ reviews.isReviewLiked(review.id) ? '♥ Helpful' : '♡ Helpful' }}
                · {{ review.likes + (reviews.isReviewLiked(review.id) ? 1 : 0) }}
              </button>
            </article>
          </div>

          <aside class="write-review">
            <h3>Rate this product</h3>
            <p class="muted" *ngIf="!auth.user()">Login to leave a rating and review.</p>

            <div class="star-picker" aria-label="Choose rating">
              <button *ngFor="let star of [1,2,3,4,5]"
                      type="button"
                      [class.selected]="star <= reviewRating"
                      (click)="reviewRating = star">
                {{ star <= reviewRating ? '★' : '☆' }}
              </button>
            </div>

            <input [(ngModel)]="reviewTitle" placeholder="Review title">
            <textarea [(ngModel)]="reviewText" rows="5" placeholder="Tell other shoppers what you think..."></textarea>

            <button class="btn" type="button" [disabled]="!auth.user()" (click)="submitReview()">
              Submit review
            </button>

            <p class="form-message" *ngIf="reviewMessage">{{ reviewMessage }}</p>
          </aside>
        </div>
      </section>
    </div>

    <section class="related-products-section" *ngIf="relatedProducts.length">
      <div class="related-heading">
        <div>
          <div class="eyebrow">You may also like</div>
          <h2>Related products</h2>
        </div>
        <button type="button" class="view-all-category" (click)="openAllCategoryProducts()">View all →</button>
      </div>

      <div class="related-grid">
        <a class="related-card"
           *ngFor="let related of relatedProducts"
           [routerLink]="['/product', related.id]">
          <div class="related-image">
            <span class="sale-badge" *ngIf="related.oldPrice">SALE</span>
            <img [src]="related.image" [alt]="related.name">
            <button type="button"
                    class="related-like"
                    (click)="$event.preventDefault(); $event.stopPropagation(); toggleRelatedLike(related.id)">
              {{ isRelatedLiked(related.id) ? '♥' : '♡' }}
            </button>
          </div>
          <div class="related-meta">
            <span class="related-category">{{ related.category }}</span>
            <span class="related-rating">★ {{ related.rating }}</span>
          </div>
          <h3>{{ related.name }}</h3>
          <div class="related-price">
            <strong>₹{{ related.price | number }}</strong>
            <del *ngIf="related.oldPrice">₹{{ related.oldPrice | number }}</del>
          </div>
        </a>
      </div>
    </section>


    <section id="category-products"
             class="category-products-section"
             *ngIf="showAllCategoryProducts">
      <div class="category-products-heading">
        <div>
          <div class="eyebrow">Shop this category</div>
          <h2>More {{ product.category }} products</h2>
          <p>Showing products from the same category as {{ product.name }}.</p>
        </div>
        <span class="category-count">{{ categoryProducts.length }} products</span>
      </div>

      <div class="category-products-grid">
        <a class="category-product-card"
           *ngFor="let item of pagedCategoryProducts"
           [routerLink]="['/product', item.id]">
          <div class="category-product-image">
            <span class="sale-badge" *ngIf="item.oldPrice">SALE</span>
            <img [src]="item.image" [alt]="item.name">
          </div>

          <div class="related-meta">
            <span class="related-category">{{ item.category }}</span>
            <span class="related-rating">★ {{ item.rating }}</span>
          </div>

          <h3>{{ item.name }}</h3>

          <div class="related-price">
            <strong>₹{{ item.price | number }}</strong>
            <del *ngIf="item.oldPrice">₹{{ item.oldPrice | number }}</del>
          </div>
        </a>
      </div>

      <nav class="category-pagination"
           *ngIf="categoryPageCount > 1"
           aria-label="Category product pages">
        <button type="button"
                class="pagination-button"
                [disabled]="categoryPage === 1"
                (click)="setCategoryPage(categoryPage - 1)">
          ←
        </button>

        <button type="button"
                class="pagination-button"
                *ngFor="let page of categoryPageNumbers"
                [class.active]="categoryPage === page"
                (click)="setCategoryPage(page)">
          {{ page }}
        </button>

        <button type="button"
                class="pagination-button"
                [disabled]="categoryPage === categoryPageCount"
                (click)="setCategoryPage(categoryPage + 1)">
          →
        </button>
      </nav>
    </section>

  </main>
  `,


  styles: [`

    .view-all-category{
      border:1px solid var(--line);
      background:#fff;
      color:#111;
      border-radius:999px;
      padding:10px 16px;
      font:inherit;
      font-weight:700;
      cursor:pointer;
    }
    .view-all-category:hover{border-color:#111}
    .category-products-section{
      margin:76px 0 30px;
      padding-top:42px;
      border-top:1px solid var(--line);
      scroll-margin-top:30px;
    }
    .category-products-heading{
      display:flex;
      align-items:end;
      justify-content:space-between;
      gap:24px;
      margin-bottom:24px;
    }
    .category-products-heading h2{
      margin:6px 0 7px;
      font-size:32px;
      letter-spacing:-.04em;
    }
    .category-products-heading p{margin:0;color:#777}
    .category-count{
      color:#777;
      font-size:12px;
      text-transform:uppercase;
      letter-spacing:.08em;
    }
    .category-products-grid{
      display:grid;
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:28px 18px;
    }
    .category-product-card{
      color:inherit;
      text-decoration:none;
      min-width:0;
    }
    .category-product-image{
      position:relative;
      height:285px;
      border-radius:18px;
      overflow:hidden;
      background:#f1f1ef;
    }
    .category-product-image img{
      width:100%;
      height:100%;
      object-fit:cover;
      display:block;
      transition:transform .4s ease;
    }
    .category-product-card:hover .category-product-image img{
      transform:scale(1.035);
    }
    .category-product-card h3{
      font-size:16px;
      margin:8px 0 7px;
    }
    .category-pagination{
      display:flex;
      justify-content:center;
      align-items:center;
      gap:8px;
      margin-top:38px;
    }
    .pagination-button{
      min-width:40px;
      height:40px;
      padding:0 12px;
      border:1px solid var(--line);
      background:#fff;
      border-radius:999px;
      cursor:pointer;
      font:inherit;
    }
    .pagination-button:hover:not(:disabled){border-color:#111}
    .pagination-button.active{
      background:#111;
      color:#fff;
      border-color:#111;
    }
    .pagination-button:disabled{
      opacity:.35;
      cursor:not-allowed;
    }
    @media(max-width:1000px){
      .category-products-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
    }
    @media(max-width:600px){
      .category-products-grid{grid-template-columns:1fr 1fr;gap:22px 12px}
      .category-product-image{height:210px}
      .category-products-heading{align-items:start}
      .category-products-heading h2{font-size:26px}
      .category-count{display:none}
    }


    .ai-review-summary{margin-top:22px;background:#111;color:#fff;border-radius:20px;padding:22px;display:grid;grid-template-columns:1fr auto;gap:8px 20px}.ai-review-summary .eyebrow{color:#aaa}.ai-review-summary h2{margin:6px 0;font-size:24px}.ai-review-summary p{margin:0;color:#aaa;font-size:12px}.ai-score{font-size:28px;font-weight:900;align-self:center}.ai-columns{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}.ai-columns div{background:#1d1d1d;border-radius:12px;padding:13px;display:grid;gap:7px}.ai-columns strong{font-size:12px}.ai-columns span{font-size:11px;line-height:1.5;color:#aaa}
    .related-products-section{margin:76px 0 20px;padding-top:42px;border-top:1px solid var(--line)}
    .related-heading{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:22px}
    .related-heading h2{margin:6px 0 0;font-size:32px;letter-spacing:-.04em}
    .related-heading a{color:#111;text-decoration:none;font-weight:700}
    .related-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}
    .related-card{color:inherit;text-decoration:none;min-width:0}
    .related-image{position:relative;height:285px;border-radius:18px;overflow:hidden;background:#f1f1ef}
    .related-image img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s ease}
    .related-card:hover .related-image img{transform:scale(1.035)}
    .sale-badge{position:absolute;z-index:2;top:12px;left:12px;background:#fff;border-radius:999px;padding:7px 10px;font-size:10px;font-weight:800}
    .related-like{position:absolute;z-index:3;right:12px;top:12px;width:36px;height:36px;border:0;border-radius:50%;background:#fff;font-size:18px;cursor:pointer}
    .related-meta{display:flex;justify-content:space-between;gap:10px;margin-top:12px;font-size:11px;color:#777;text-transform:uppercase;letter-spacing:.06em}
    .related-rating{color:#666;text-transform:none;letter-spacing:0}
    .related-card h3{font-size:16px;margin:8px 0 7px}
    .related-price{display:flex;align-items:center;gap:8px}
    .related-price strong{font-size:15px}
    .related-price del{font-size:12px;color:#999}
    @media(max-width:1000px){.related-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:600px){.related-grid{grid-template-columns:1fr 1fr}.related-image{height:210px}.related-heading h2{font-size:26px}}

    .back {
      display: inline-block;
      color: #666;
      font-size: 13px;
      margin-bottom: 24px;
    }

    .detail {
      display: grid;
      grid-template-columns: minmax(0, 1.08fr) minmax(420px, .92fr);
      gap: 54px;
      align-items: start;
    }

    .gallery {
      display: grid;
      grid-template-columns: 88px minmax(0, 1fr);
      gap: 14px;
      min-width: 0;
    }

    .gallery-controls {
      grid-column: 1 / -1;
      display: flex;
      justify-content: flex-end;
      margin-bottom: -2px;
    }

    .auto-btn {
      border: 1px solid var(--line);
      background: #fff;
      border-radius: 999px;
      padding: 7px 11px;
      font-size: 11px;
      font-weight: 700;
    }

    .thumbs {
      display: grid;
      grid-auto-rows: 88px;
      gap: 10px;
      align-content: start;
    }

    .thumb {
      padding: 0;
      border: 1px solid var(--line);
      background: #eee;
      border-radius: 12px;
      overflow: hidden;
      cursor: pointer;
      opacity: .78;
      transition: .2s;
    }

    .thumb:hover,
    .thumb.active {
      opacity: 1;
      border-color: #111;
      box-shadow: 0 0 0 1px #111;
    }

    .thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .main-image {
      position: relative;
      background: #eee;
      border-radius: 24px;
      overflow: hidden;
      aspect-ratio: 1 / 1;
      min-width: 0;
    }

    .main-image > img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: opacity .28s ease, transform .35s ease;
    }

    .slide-arrow {
      position: absolute;
      top: 50%;
      z-index: 2;
      transform: translateY(-50%);
      width: 42px;
      height: 42px;
      border: 0;
      border-radius: 50%;
      background: rgba(255,255,255,.92);
      color: #111;
      font-size: 32px;
      line-height: 1;
      display: grid;
      place-items: center;
      box-shadow: 0 5px 18px rgba(0,0,0,.12);
      opacity: 0;
      transition: opacity .2s ease, transform .2s ease;
    }

    .main-image:hover .slide-arrow {
      opacity: 1;
    }

    .slide-arrow:hover {
      transform: translateY(-50%) scale(1.06);
    }

    .slide-arrow.prev { left: 14px; }
    .slide-arrow.next { right: 14px; }

    .slide-progress {
      position: absolute;
      left: 50%;
      bottom: 15px;
      transform: translateX(-50%);
      display: flex;
      gap: 6px;
      padding: 6px 9px;
      background: rgba(255,255,255,.82);
      border-radius: 999px;
    }

    .slide-progress span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #aaa;
      transition: all .2s ease;
    }

    .slide-progress span.active {
      width: 18px;
      border-radius: 999px;
      background: #111;
    }

    .image-count {
      position: absolute;
      right: 14px;
      bottom: 14px;
      padding: 7px 10px;
      background: rgba(255,255,255,.92);
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
    }

    .copy { padding: 22px 0; }
    .copy h1 { margin: 16px 0 12px; font-size: clamp(36px, 4.4vw, 58px); }
    .rating { font-size: 13px; margin-bottom: 22px; }
    .rating span { color: #888; }

    .price {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 20px;
    }

    .price strong { font-size: 26px; }
    .price del { color: #999; }

    .copy p {
      color: #666;
      line-height: 1.8;
      max-width: 560px;
    }

    .option { margin: 28px 0; }

    .swatches {
      display: flex;
      gap: 8px;
      margin-top: 10px;
      flex-wrap: wrap;
    }

    .swatches button {
      border: 1px solid var(--line);
      background: #fff;
      padding: 9px 13px;
      border-radius: 999px;
    }

    .add {
      width: 100%;
      padding: 15px;
      margin-bottom: 28px;
    }

    .product-specs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:20px 0}.product-specs>div{border:1px solid var(--line);border-radius:10px;padding:10px}.product-specs small{display:block;color:#777;font-size:10px}.product-specs strong{display:block;margin-top:3px;font-size:12px}
    .share {
      border-top: 1px solid var(--line);
      padding-top: 20px;
    }

    .share-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin: 12px 0;
    }

    .share-row a,
    .share-row button {
      border: 1px solid var(--line);
      background: #fff;
      border-radius: 999px;
      padding: 9px 12px;
      font-size: 12px;
      font-weight: 700;
    }

    .share small {
      display: block;
      color: #888;
      line-height: 1.5;
    }

    .rating-row{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:22px}
    .rating{margin-bottom:0;display:flex;align-items:center;gap:6px}
    .big-stars{color:#f5a623;letter-spacing:1px}
    .product-like{border:1px solid var(--line);background:#fff;border-radius:999px;padding:9px 13px;font-weight:700;cursor:pointer}
    .product-like.liked{color:#e5394f;border-color:#f0b2ba}
    .reviews-section{margin-top:70px;padding-top:46px;border-top:1px solid var(--line)}
    .reviews-heading{display:flex;justify-content:space-between;align-items:end;gap:24px;margin-bottom:28px}
    .reviews-heading h2{margin:8px 0 0;font-size:34px}
    .review-summary{display:grid;grid-template-columns:auto auto;gap:5px 10px;align-items:center;text-align:right}
    .review-summary strong{font-size:32px}
    .review-summary small{grid-column:1/-1;color:#888}
    .review-layout{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(300px,.7fr);gap:28px;align-items:start}
    .review-list{display:grid;gap:14px}
    .review-card{border:1px solid var(--line);border-radius:18px;padding:20px;background:#fff}
    .review-top{display:flex;justify-content:space-between;gap:15px;color:#888;font-size:12px}
    .review-card h3{margin:12px 0 6px;font-size:16px}
    .review-card p{color:#666;line-height:1.65;margin:0 0 12px}
    .small-stars{color:#f5a623;letter-spacing:1px;margin-top:4px}
    .helpful{border:0;background:transparent;padding:0;color:#777;font-weight:700;cursor:pointer}
    .helpful.liked{color:#e5394f}
    .write-review{position:sticky;top:92px;border:1px solid var(--line);border-radius:18px;padding:22px;background:#fff}
    .write-review h3{margin:0 0 8px}
    .star-picker{display:flex;gap:2px;margin:16px 0}
    .star-picker button{border:0;background:transparent;font-size:28px;color:#aaa;cursor:pointer;padding:0}
    .star-picker button.selected{color:#f5a623}
    .write-review input,.write-review textarea{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:10px;font:inherit;outline:none}
    .write-review textarea{resize:vertical}
    .write-review .btn{width:100%}
    .write-review .btn:disabled{opacity:.5;cursor:not-allowed}
    .form-message{font-size:12px;color:#666;margin:10px 0 0}

    @media (max-width: 900px) {
      .detail {
        grid-template-columns: 1fr;
        gap: 22px;
      }

      .copy { padding: 0; }
    }

    @media (max-width: 560px) {
      .gallery {
        grid-template-columns: 1fr;
      }

      .thumbs {
        order: 2;
        grid-auto-flow: column;
        grid-auto-columns: 76px;
        grid-template-rows: 76px;
        overflow-x: auto;
      }

      .main-image {
        order: 1;
      }
    }
    @media(max-width:700px){.ai-columns{grid-template-columns:1fr}.ai-review-summary{grid-template-columns:1fr}.ai-score{justify-self:start}}
  `]
})
export class ProductDetailComponent implements OnInit, OnDestroy {

  private relatedLiked = new Set<string>();
  showAllCategoryProducts = false;
  categoryPage = 1;
  readonly categoryPageSize = 8;

  get categoryProducts() {
    if (!this.product) return [];

    return this.products.products.filter(p =>
      p.category === this.product!.category
    );
  }

  get categoryPageCount() {
    return Math.max(1, Math.ceil(this.categoryProducts.length / this.categoryPageSize));
  }

  get pagedCategoryProducts() {
    const start = (this.categoryPage - 1) * this.categoryPageSize;
    return this.categoryProducts.slice(start, start + this.categoryPageSize);
  }

  get categoryPageNumbers() {
    return Array.from({ length: this.categoryPageCount }, (_, i) => i + 1);
  }

  openAllCategoryProducts() {
    this.showAllCategoryProducts = true;
    this.categoryPage = 1;

    setTimeout(() => {
      const section = document.getElementById('category-products');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 0);
  }

  setCategoryPage(page: number) {
    if (page < 1 || page > this.categoryPageCount) return;

    this.categoryPage = page;

    setTimeout(() => {
      document.getElementById('category-products')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    });
  }


  get relatedProducts() {
    if (!this.product) return [];

    const sameSubcategory = this.products.products.filter(p =>
      p.id !== this.product!.id &&
      p.category === this.product!.category &&
      p.subcategory === this.product!.subcategory
    );

    const sameCategory = this.products.products.filter(p =>
      p.id !== this.product!.id &&
      p.category === this.product!.category &&
      !sameSubcategory.some(x => x.id === p.id)
    );

    return [...sameSubcategory, ...sameCategory].slice(0, 4);
  }

  get aiReviewScore(): number {
    const p = this.product; if (!p) return 0; return Math.min(99, Math.round(p.rating * 18 + Math.min(p.reviews, 300) / 15));
  }

  get aiPros(): string {
    const p = this.product; if (!p) return ''; const tags = p.tags.slice(0, 3).join(', ');
    return tags ? `Strong ${tags} feedback and an overall ${p.rating}/5 rating.` : 'Strong overall customer sentiment.';
  }

  get aiCons(): string {
    const p = this.product; if (!p) return ''; if (p.rating >= 4.7) return 'Only a small number of lower-rated reviews; no major recurring issue in this demo.';
    return 'Some customers mention trade-offs; read the detailed reviews before buying.';
  }

  get aiVerdict(): string {
    const p = this.product; if (!p) return ''; if (p.rating >= 4.7) return 'Excellent choice for shoppers prioritizing value and customer satisfaction.';
    if (p.rating >= 4.3) return 'Good overall choice with a few trade-offs.';
    return 'Worth comparing with alternatives before buying.';
  }

  toggleRelatedLike(id: string) {
    if (this.relatedLiked.has(id)) {
      this.relatedLiked.delete(id);
    } else {
      this.relatedLiked.add(id);
    }
  }

  isRelatedLiked(id: string) {
    return this.relatedLiked.has(id);
  }

  private route = inject(ActivatedRoute);
  private products = inject(ProductService);
  private cart = inject(CartService);
  private router = inject(Router);

  product = this.products.getById(this.route.snapshot.paramMap.get('id') || '');
  selectedImage = this.product?.images?.[0] || this.product?.image || '';
  private autoSlideTimer?: ReturnType<typeof setInterval>;
  private readonly pageAbort = new AbortController();
  private autoSlideDelay = 3500;
  isAutoPlaying = true;

  get selectedIndex() {
    return Math.max(0, this.product?.images?.indexOf(this.selectedImage) ?? 0);
  }

  /**
   * Share the Angular product route, not the current backend/API URL.
   * Using window.location.origin means localhost works now and the
   * production domain is picked up automatically after deployment.
   */
  get pageUrl() {
    if (typeof window === 'undefined' || !this.product) return '';
    return `${window.location.origin}/product/${encodeURIComponent(this.product.id)}`;
  }

  get facebookUrl() {
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(this.pageUrl)}`;
  }

  get xUrl() {
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(this.product?.name || '')}&url=${encodeURIComponent(this.pageUrl)}`;
  }

  get whatsappUrl() {
    const text = `${this.product?.name || 'WISSFIND Product'}\n${this.pageUrl}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;
  readonly reviews = inject(ReviewService);
  readonly auth = inject(AuthService);
  reviewList: ProductReview[] = [];
  reviewRating = 5;
  reviewTitle = '';
  reviewText = '';
  reviewMessage = '';

  async ngOnInit() {
    const id=this.route.snapshot.paramMap.get('id') || '';
    const loaded=await this.products.getByIdAsync(id, this.pageAbort.signal);
    if(loaded){
      this.product=loaded;
      this.selectedImage=loaded.images?.[0] || loaded.image || '';
    }
    await this.loadReviews();
    this.startAutoSlide();
  }

  async loadReviews() {
    if (!this.product) return;
    this.reviewList = await this.reviews.getReviews(this.product.id, this.pageAbort.signal);
  }

  get averageRating() {
    if (!this.reviewList.length) return this.product?.rating || 0;
    return this.reviewList.reduce((sum, r) => sum + r.rating, 0) / this.reviewList.length;
  }

  starText(rating: number) {
    const full = Math.round(rating);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }

  toggleProductLike() {
    if (!this.product) return;
    this.reviews.toggleProductLike(this.product.id);
  }

  async toggleReviewLike(reviewId: string) {
    await this.reviews.toggleReviewLike(reviewId);
    this.reviewList = await this.reviews.getReviews(this.product?.id || '', this.pageAbort.signal);
  }

  async submitReview() {
    if (!this.product) return;

    if (!this.auth.user()) {
      this.reviewMessage = 'Please login first to submit a review.';
      return;
    }

    if (!this.reviewText.trim()) {
      this.reviewMessage = 'Please write a short review.';
      return;
    }
const customerName = this.auth.user()?.name || 'WissFind Customer';

await this.reviews.addReview({
  productId: this.product.id,
  author: customerName,
  rating: this.reviewRating,
  title: this.reviewTitle.trim() || 'My review',
  text: this.reviewText.trim()
});

    this.reviewTitle = '';
    this.reviewText = '';
    this.reviewRating = 5;
    this.reviewMessage = 'Thanks! Your review was added.';
    this.loadReviews();
  }

  ngOnDestroy() {
    this.pageAbort.abort();
    this.stopAutoSlide();
  }

  private startAutoSlide() {
    this.stopAutoSlide();

    if (!this.product || this.product.images.length <= 1 || !this.isAutoPlaying) {
      return;
    }

    this.autoSlideTimer = setInterval(() => {
      this.nextImage();
    }, this.autoSlideDelay);
  }

  private stopAutoSlide() {
    if (this.autoSlideTimer) {
      clearInterval(this.autoSlideTimer);
      this.autoSlideTimer = undefined;
    }
  }

  nextImage() {
    if (!this.product?.images?.length) return;

    const images = this.product.images;
    const current = images.indexOf(this.selectedImage);
    this.selectedImage = images[(current + 1) % images.length];
  }

  previousImage() {
    if (!this.product?.images?.length) return;

    const images = this.product.images;
    const current = images.indexOf(this.selectedImage);
    this.selectedImage = images[(current - 1 + images.length) % images.length];
  }

  selectImage(image: string) {
    this.selectedImage = image;
    this.restartAutoSlide();
  }

  pauseAutoSlide() {
    if (this.isAutoPlaying) {
      this.stopAutoSlide();
    }
  }

  resumeAutoSlide() {
    if (this.isAutoPlaying) {
      this.startAutoSlide();
    }
  }

  toggleAutoSlide() {
    this.isAutoPlaying = !this.isAutoPlaying;

    if (this.isAutoPlaying) {
      this.startAutoSlide();
    } else {
      this.stopAutoSlide();
    }
  }

  private restartAutoSlide() {
    if (this.isAutoPlaying) {
      this.startAutoSlide();
    }
  }

  async addToCart() {
    if (!this.product || !this.product.stock) return;

    this.cart.add(this.product);
    await this.router.navigateByUrl('/cart');
  }

  async nativeShare() {
    if (!this.product || !navigator.share) return;

    try {
      const response = await fetch(this.selectedImage);
      const blob = await response.blob();
      const file = new File(
        [blob],
        `${this.product.id}-image.jpg`,
        { type: blob.type || 'image/jpeg' }
      );

      const data: ShareData = {
        title: this.product.name,
        text: `${this.product.name}\n${this.pageUrl}`,
        url: this.pageUrl
      };

      if (navigator.canShare?.({ files: [file] })) {
        (data as any).files = [file];
      }

      await navigator.share(data);
    } catch {}
  }
}
