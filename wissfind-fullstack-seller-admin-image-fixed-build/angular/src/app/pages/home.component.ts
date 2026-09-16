import { Component, HostListener, computed, inject, signal, OnDestroy } from '@angular/core';
import { DecimalPipe, NgFor, NgIf } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductService } from '../core/product.service';
import { ReviewService } from '../core/review.service';
import { CartService } from '../core/cart.service';

type CategoryFilter =
  | 'All'
  | 'Fashion'
  | 'Electronics'
  | 'Home & Living'
  | 'Beauty'
  | 'Sports & Fitness'
  | 'Books & Stationery'
  | 'Grocery'
  | 'Travel';

@Component({
  standalone: true,
  imports: [NgFor, NgIf, DecimalPipe, RouterLink],
  template: `
  <main class="page">
    <div class="container">
      <section class="hero">
        <div class="hero-copy">
          <div class="eyebrow">New season / 2026</div>
          <h1>Style meets<br><em>smart living.</em></h1>
          <p>Curated fashion and everyday tech, designed to make your daily essentials better.</p>
          <a class="btn" href="#shop">Shop collection →</a>
        </div>
        <div class="hero-image">
          <img src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=85" alt="Modern electronics and lifestyle products">
          <div class="hero-badge">UP TO<br><strong>30% OFF</strong></div>
        </div>
      </section>

      
      

<section id="shop" class="toolbar">
        <div>
          <div class="eyebrow">The edit</div>
          <h2>Shop all</h2>
        </div>
        <div class="filters-row">
          <div class="main-filters">
            <button type="button"
                    *ngFor="let c of topCategories"
                    [class.active]="category() === c"
                    (click)="selectCategory(c)">
              {{ c }}
            </button>
          </div>

          <div class="subcategory-wrap" *ngIf="category() !== 'All'">
            <span class="subcategory-label">{{ category() }}</span>
            <div class="subcategory-list">
              <button type="button"
                      [class.active]="subcategory() === 'All'"
                      (click)="selectSubcategory('All')">All</button>
              <button type="button"
                      *ngFor="let item of subcategoriesFor(category())"
                      [class.active]="subcategory() === item"
                      (click)="selectSubcategory(item)">
                {{ displaySubcategory(item) }}
              </button>
            </div>
          </div>

          <div class="subcategory-wrap detail-wrap"
               *ngIf="category() !== 'All' && subcategory() !== 'All' && detailCategoriesFor(category(), subcategory()).length">
            <span class="subcategory-label">More</span>
            <div class="subcategory-list">
              <button type="button"
                      [class.active]="detail() === 'All'"
                      (click)="selectDetail('All')">All</button>
              <button type="button"
                      *ngFor="let item of detailCategoriesFor(category(), subcategory())"
                      [class.active]="detail() === item"
                      (click)="selectDetail(item)">
                {{ item }}
              </button>
            </div>
          </div>

          <select (change)="changeSort($any($event.target).value)">
            <option value="featured">Featured</option>
            <option value="low">Price: low to high</option>
            <option value="high">Price: high to low</option>
            <option value="rating">Top rated</option>
          </select>
        </div>
      </section>

      <div class="chips">
        <span>Free shipping over ₹5,000</span><span>7-day easy returns</span><span>Secure checkout</span>
      </div>

      <section class="grid">
        <article class="product-card" *ngFor="let p of pagedProducts()">
          <a [routerLink]="['/product', p.id]" class="image-wrap">
            <img [src]="p.image" [alt]="p.name" loading="lazy">
            <span *ngIf="p.oldPrice" class="sale">SALE</span>
          </a>
          <div class="product-info">
            <div class="meta">
              <span>{{ p.category }} · {{ p.subcategory }}</span>
              <span class="card-rating" aria-label="Product rating">
                <span class="stars">{{ starText(p.rating) }}</span>
                {{ p.rating }} <small>({{ p.reviews }})</small>
              </span>
            </div>
            <a [routerLink]="['/product', p.id]"><h3>{{ p.name }}</h3></a>
            <div class="card-social">
              <button
                type="button"
                class="like-btn"
                [class.liked]="reviews.isProductLiked(p.id)"
                (click)="toggleLike($event, p.id)"
                [attr.aria-label]="reviews.isProductLiked(p.id) ? 'Unlike product' : 'Like product'">
                {{ reviews.isProductLiked(p.id) ? '♥' : '♡' }}
                <span>{{ reviews.getProductLikeCount(p.id) }}</span>
              </button>
              <a [routerLink]="['/product', p.id]" class="review-link">Read reviews →</a>
            </div>
            <div class="price-row">
              <div class="price"><strong>₹{{ p.price | number }}</strong><del *ngIf="p.oldPrice">₹{{ p.oldPrice | number }}</del></div>
              <button type="button"
                      class="add-cart"
                      (click)="addToCart($event, p)"
                      [disabled]="!p.stock">
                {{ p.stock ? 'Add to cart' : 'Out of stock' }}
              </button>
            </div>
          </div>
        </article>
      </section>

      <div class="homepage-pagination" *ngIf="pageCount() > 1">
        <button type="button"
                class="pagination-button"
                [disabled]="page() === 1"
                (click)="setPage(page() - 1)">
          ←
        </button>

        <button type="button"
                class="pagination-button"
                *ngFor="let pageNumber of pageNumbers()"
                [class.active]="page() === pageNumber"
                (click)="setPage(pageNumber)">
          {{ pageNumber }}
        </button>

        <button type="button"
                class="pagination-button"
                [disabled]="page() === pageCount()"
                (click)="setPage(page() + 1)">
          →
        </button>
      </div>
    </div>
  </main>
  `,
  styles: [`

    .homepage-pagination{display:flex;justify-content:center;align-items:center;gap:8px;margin:38px 0 10px}
    .pagination-button{min-width:40px;height:40px;padding:0 12px;border:1px solid var(--line);background:#fff;border-radius:999px;cursor:pointer;font:inherit}
    .pagination-button:hover:not(:disabled){border-color:#111}
    .pagination-button.active{background:#111;color:#fff;border-color:#111}
    .pagination-button:disabled{opacity:.35;cursor:not-allowed}

    .hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);min-height:clamp(390px,42vw,560px);overflow:hidden;border-radius:28px;background:#e7e6df;margin-bottom:64px}
    .hero-copy{padding:clamp(32px,5vw,70px);display:flex;flex-direction:column;justify-content:center}
    .hero-copy h1{margin:18px 0 22px}.hero-copy h1 em{font-style:normal;color:#555}
    .hero-copy p{max-width:430px;color:#5f5f5f;line-height:1.7;margin:0 0 30px}.hero-copy .btn{width:max-content}
    .hero-image{position:relative;min-height:0}.hero-image img{height:100%;width:100%;object-fit:cover}.hero-badge{position:absolute;right:22px;bottom:22px;background:#fff;padding:16px 18px;border-radius:16px;font-size:11px;letter-spacing:.08em}.hero-badge strong{font-size:16px}
    .toolbar{min-width:0;max-width:100%;display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:22px}.filters{display:flex;gap:8px;align-items:center}.filters button,.filters select{border:1px solid var(--line);background:#fff;border-radius:999px;padding:10px 14px;font-weight:700}.filters button.active{background:#111;color:#fff;border-color:#111}

    .filters-row{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap}
    .main-filters{display:flex;align-items:center;gap:8px;flex-wrap:wrap;max-width:100%}
    .main-filters button,.subcategory-list button,.filters-row select{border:1px solid var(--line);background:#fff;color:#111;border-radius:999px;padding:10px 14px;font-weight:700;white-space:nowrap}
    .main-filters button,.subcategory-list button{cursor:pointer}
    .main-filters button.active,.subcategory-list button.active{background:#111;color:#fff;border-color:#111}
    .subcategory-wrap{display:flex;align-items:center;gap:7px;padding-left:12px;border-left:1px solid var(--line);max-width:100%}.detail-wrap{border-left:1px dashed #ddd}
    .subcategory-label{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#888;font-weight:800}
    .subcategory-list{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .subcategory-list button{font-size:12px;padding:8px 12px}
    @media(max-width:900px){
      .filters-row{justify-content:flex-start}
      .subcategory-wrap{width:100%;padding-left:0;border-left:0}
    }
    .chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px}.chips span{font-size:12px;border:1px solid var(--line);background:#fff;padding:8px 11px;border-radius:999px;color:#666}
    .grid{display:grid;width:100%;max-width:100%;min-width:0;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}.product-card{min-width:0}.image-wrap{position:relative;display:block;aspect-ratio:4/5;background:#eee;border-radius:18px;overflow:hidden}.image-wrap img{width:100%;height:100%;object-fit:cover;transition:transform .35s}.product-card:hover .image-wrap img{transform:scale(1.035)}.sale{position:absolute;left:12px;top:12px;background:#fff;padding:7px 9px;border-radius:999px;font-size:10px;font-weight:800}.product-info{padding:12px 3px}.meta{display:flex;justify-content:space-between;color:#777;font-size:11px;text-transform:uppercase;letter-spacing:.08em}.card-rating{display:flex;gap:4px;align-items:center}.card-rating small{font-size:10px;color:#999}.stars{letter-spacing:1px;color:#f5a623}.product-info h3{font-size:16px;margin:8px 0}.price{display:flex;gap:9px;align-items:center}.price strong{font-size:15px}.price del{font-size:12px;color:#999}.price-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px}.add-cart{border:1px solid #111;background:#111;color:#fff;border-radius:999px;padding:8px 11px;font:inherit;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap}.add-cart:disabled{opacity:.4;cursor:not-allowed}
    .card-social{display:flex;align-items:center;justify-content:space-between;margin-top:10px}
    .like-btn{border:0;background:transparent;padding:3px 0;display:flex;gap:5px;align-items:center;font-size:13px;color:#777;cursor:pointer}
    .like-btn.liked{color:#e5394f}.like-btn.liked:first-letter{color:#e5394f}
    .review-link{font-size:11px;font-weight:700;color:#666}
    .category-art,.category-art img{width:100%;height:100%}
    .category-art img{display:block;object-fit:cover;transition:transform .5s ease}
    .category-card:hover .category-art img{transform:scale(1.045)}
    .category-card:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 35%,rgba(0,0,0,.72) 100%)}
    .category-content span{font-size:11px;opacity:.75}
    @media(max-width:700px){
    }
    .view-all{display:flex;justify-content:center;margin-top:28px}
    @media(min-width:1400px){
      .hero{min-height:540px}
      .hero-copy{padding:76px}
      .grid{gap:20px}
    }
    @media(max-width:1000px){
      .grid{grid-template-columns:repeat(3,minmax(0,1fr));}
      .toolbar,.filters,.main-filters,.subcategory-list{max-width:100%;min-width:0;flex-wrap:wrap;}
    }
    @media(max-width:760px){
      .hero{grid-template-columns:1fr;margin-bottom:42px;border-radius:22px}
      .hero-copy{padding:34px 28px}.hero-image{min-height:300px}
      .toolbar{min-width:0;max-width:100%;align-items:flex-start;flex-direction:column}.filters{width:100%}
      .filters button,.filters select{flex:1}
      .grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    }
    @media(max-width:430px){
      .hero-copy{padding:28px 22px}.hero-image{min-height:240px}
      .hero-copy p{font-size:14px}.product-info h3{font-size:14px}
    }
  `]
})
export class HomeComponent implements OnDestroy {
  @HostListener('window:wissfind-category-change', ['$event'])
  onHeaderCategoryChange(event: Event) {
    const category = (event as CustomEvent).detail as CategoryFilter;
    if (this.topCategories.includes(category)) this.selectCategory(category);
  }


  private readonly productService = inject(ProductService);
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);
  private products = this.productService.products;
  private readonly pageAbort = new AbortController();
  readonly reviews = inject(ReviewService);
  private route = inject(ActivatedRoute);
  query = signal('');

  constructor() {
    // Home owns the catalog request. Other routes do not trigger /products.
    void this.productService.load(this.pageAbort.signal);

    this.route.queryParamMap.subscribe(params => {
      this.query.set((params.get('q') || '').toLowerCase());
      this.page.set(1);
    });
  }

  ngOnDestroy() {
    this.pageAbort.abort();
  }


  category = signal<CategoryFilter>('All');
  subcategory = signal('All');
  detail = signal('All');

  readonly topCategories: CategoryFilter[] = [
    'All', 'Fashion', 'Electronics', 'Home & Living', 'Beauty',
    'Sports & Fitness', 'Books & Stationery', 'Grocery', 'Travel'
  ];

  readonly categoryMap: Record<string, string[]> = {
    Fashion: ['Men', 'Women', 'Kids', 'Accessories', 'Footwear'],
    Electronics: ['Smartphones', 'Laptops', 'Tablets', 'Audio', 'Wearables', 'Gaming', 'Cameras', 'TVs & Displays', 'Accessories'],
    'Home & Living': ['Furniture', 'Kitchen', 'Home Decor', 'Lighting', 'Storage', 'Appliances'],
    Beauty: ['Skincare', 'Makeup', 'Hair Care', 'Fragrances', 'Grooming'],
    'Sports & Fitness': ['Running', 'Gym', 'Yoga', 'Cycling', 'Sports Shoes', 'Fitness Equipment'],
    'Books & Stationery': ['Books', 'Notebooks', 'Pens', 'Office Supplies', 'Art & Craft'],
    Grocery: ['Snacks', 'Beverages', 'Packaged Food', 'Household Essentials'],
    Travel: ['Luggage', 'Backpacks', 'Travel Accessories']
  };

  readonly detailMap: Record<string, string[]> = {
    'Fashion:Men': ['T-Shirts', 'Shirts', 'Jeans', 'Trousers', 'Jackets', 'Sneakers', 'Watches', 'Bags'],
    'Fashion:Women': ['Dresses', 'Tops', 'Jeans', 'Skirts', 'Jackets', 'Heels', 'Sneakers', 'Handbags', 'Jewellery'],
    'Fashion:Kids': ['Boys', 'Girls', 'Baby'],
    'Fashion:Accessories': ['Sunglasses', 'Belts', 'Wallets', 'Caps', 'Watches'],
    'Electronics:Audio': ['Headphones', 'Earbuds', 'Speakers'],
    'Electronics:Gaming': ['Gaming Laptops', 'Keyboards', 'Mouse', 'Headsets', 'Controllers'],
    'Electronics:Accessories': ['Chargers', 'Power Banks', 'Cables', 'Cases']
  };

  sort = signal('featured');
  page = signal(1);
  readonly pageSize = 8;

  pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize)));

  pageNumbers = computed(() =>
    Array.from({ length: this.pageCount() }, (_, i) => i + 1)
  );

  pagedProducts = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });

  setPage(pageNumber: number) {
    const safePage = Math.min(Math.max(pageNumber, 1), this.pageCount());
    this.page.set(safePage);

    setTimeout(() => {
      document.getElementById('shop')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    });
  }





  subcategoriesFor(category: CategoryFilter): string[] {
    return this.categoryMap[category] || [];
  }

  displaySubcategory(value: string): string {
    return value === 'Wearables' ? 'Smartwatches' : value;
  }

  detailCategoriesFor(category: CategoryFilter, subcategory: string): string[] {
    return this.detailMap[`${category}:${subcategory}`] || [];
  }

  addToCart(event: Event, product: any) {
    event.preventDefault();
    event.stopPropagation();

    if (!product || !product.stock) return;

    this.cart.add(product);
    void this.router.navigateByUrl('/cart');
  }

  selectCategory(category: CategoryFilter) {
    this.category.set(category);
    this.subcategory.set('All');
    this.detail.set('All');
    this.page.set(1);
  }

  changeSort(value: string) {
    this.sort.set(value);
    this.page.set(1);
  }

  selectSubcategory(subcategory: string) {
    this.subcategory.set(subcategory);
    this.detail.set('All');
    this.page.set(1);
  }

  selectDetail(detail: string) {
    this.detail.set(detail);
    this.page.set(1);
  }

  matchesSubcategory(p: any): boolean {
    if (this.subcategory() === 'All') return true;

    const value = `${p.subcategory || ''} ${p.type || ''} ${(p.tags || []).join(' ')}`.toLowerCase();

    const aliases: Record<string, string[]> = {
      Men: ['men'], Women: ['women'], Kids: ['kids', 'boys', 'girls', 'baby'],
      Footwear: ['footwear', 'sneaker', 'shoe'], Accessories: ['accessor', 'bag'],
      Wearables: ['wearable', 'smartwatch', 'smart watch'],
      'TVs & Displays': ['tv', 'display', 'television'],
      'Sports Shoes': ['running', 'shoe'], 'Fitness Equipment': ['fitness', 'gym', 'equipment'],
      'Home Decor': ['home decor', 'decor', 'lamp'], 'Hair Care': ['hair'],
      'Office Supplies': ['office'], 'Travel Accessories': ['travel', 'accessory']
    };

    const terms = aliases[this.subcategory()] || [this.subcategory().toLowerCase()];
    return terms.some(term => value.includes(term));
  }

  matchesDetail(p: any): boolean {
    if (this.detail() === 'All') return true;
    const value = `${p.name} ${p.subcategory || ''} ${p.type || ''} ${(p.tags || []).join(' ')}`.toLowerCase();
    const term = this.detail().toLowerCase().replace(/s$/, '');
    return value.includes(term);
  }

  starText(rating: number) {
    const full = Math.round(rating);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }

  toggleLike(event: Event, productId: string) {
    event.preventDefault();
    event.stopPropagation();
    this.reviews.toggleProductLike(productId);
  }

  filtered = computed(() => {
    // Depend on ProductService's reactive version so products appear immediately
    // when the first API response arrives, without navigating away and back.
    this.productService.productsVersion();
    let list = this.products.filter(
      p => this.category() === 'All' || p.category === this.category()
    );

    if (this.subcategory() !== 'All') {
      list = list.filter(p => this.matchesSubcategory(p));
    }

    if (this.detail() !== 'All') {
      list = list.filter(p => this.matchesDetail(p));
    }

    const q = this.query();
    if (q) {
      list = list.filter(p =>
        `${p.name} ${p.category} ${p.subcategory} ${p.tags.join(' ')}`
          .toLowerCase()
          .includes(q)
      );
    }
    switch (this.sort()) {
      case 'low': return [...list].sort((a,b)=>a.price-b.price);
      case 'high': return [...list].sort((a,b)=>b.price-a.price);
      case 'rating': return [...list].sort((a,b)=>b.rating-a.rating);
      default: return list;
    }
  });
}