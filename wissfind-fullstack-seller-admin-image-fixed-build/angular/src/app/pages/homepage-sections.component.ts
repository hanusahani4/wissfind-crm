import { CommonModule, DecimalPipe } from '@angular/common';
import { AfterViewInit, Component, ElementRef, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BackendApiService } from '../core/backend-api.service';
import { CartService } from '../core/cart.service';
import { ReviewService } from '../core/review.service';

@Component({
  selector: 'app-homepage-sections',
  standalone: true,
  imports: [CommonModule, DecimalPipe, RouterLink],
  template: `
    <section class="homepage-sections" *ngIf="sections.length">
      <div class="section" *ngFor="let section of sections">
        <div class="section-head">
          <div><div class="eyebrow">CURATED FOR YOU</div><h2>{{ section.title }}</h2></div>
          <a *ngIf="section.showViewAll" href="#shop" class="view-all">View all →</a>
        </div>
        <div class="product-row">
          <article class="card" *ngFor="let p of section.products">
            <a [routerLink]="['/product', p.id]" class="image">
              <img [src]="imageUrl(p.image)" [alt]="p.name" loading="lazy">
              <span class="badge" *ngIf="p.salePrice || p.oldPrice">SALE</span>
            </a>
            <div class="info">
              <div class="meta"><span>{{ p.category }}</span><span>★ {{ p.rating || 0 }}</span></div>
              <a [routerLink]="['/product', p.id]"><h3>{{ p.name }}</h3></a>
              <div class="social">
                <button type="button" (click)="like($event,p.id)" [class.liked]="reviews.isProductLiked(p.id)">{{ reviews.isProductLiked(p.id) ? '♥' : '♡' }} {{ reviews.getProductLikeCount(p.id) }}</button>
                <a [routerLink]="['/product',p.id]">Reviews →</a>
              </div>
              <div class="bottom">
                <div><b>₹{{ (p.salePrice || p.price) | number }}</b><del *ngIf="p.salePrice || p.oldPrice">₹{{ p.oldPrice || p.price | number }}</del></div>
                <button type="button" class="cart" (click)="add($event,p)" [disabled]="!p.stock">Add to cart</button>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host{display:block;width:100%;box-sizing:border-box}.homepage-sections{display:grid;gap:42px;margin:0 0 56px}.section{min-width:0}.section-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:16px}.eyebrow{font-size:10px;letter-spacing:.13em;color:#888;font-weight:900}.section h2{font-size:26px;margin:5px 0 0}.view-all{font-size:12px;font-weight:800;color:#555;white-space:nowrap}.product-row{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px;overflow:hidden}.card{min-width:0}.image{position:relative;display:block;aspect-ratio:4/5;background:#eee;border-radius:15px;overflow:hidden}.image img{width:100%;height:100%;object-fit:cover;transition:transform .3s}.card:hover .image img{transform:scale(1.035)}.badge{position:absolute;left:9px;top:9px;background:#fff;border-radius:999px;padding:5px 7px;font-size:9px;font-weight:900}.info{padding:9px 2px}.meta{display:flex;justify-content:space-between;color:#777;font-size:10px;text-transform:uppercase;letter-spacing:.06em}.info h3{font-size:14px;margin:7px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.social{display:flex;justify-content:space-between;align-items:center;font-size:10px;margin:6px 0}.social button{border:0;background:none;padding:0;color:#777;cursor:pointer}.social button.liked{color:#e5394f}.social a{color:#777;font-weight:700}.bottom{display:flex;align-items:center;justify-content:space-between;gap:7px}.bottom b{font-size:14px}.bottom del{display:block;color:#aaa;font-size:10px}.cart{border:0;background:#111;color:#fff;border-radius:999px;padding:7px 9px;font-size:10px;font-weight:800;white-space:nowrap;cursor:pointer}.cart:disabled{opacity:.4}@media(max-width:1100px){.product-row{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:800px){.product-row{grid-template-columns:repeat(3,minmax(0,1fr));overflow:auto}.section h2{font-size:22px}}@media(max-width:560px){.product-row{grid-template-columns:repeat(2,minmax(0,1fr))}.section-head{align-items:flex-start}.info h3{font-size:13px}}
  `]
})
export class HomepageSectionsComponent implements AfterViewInit {
  private api = inject(BackendApiService);
  private cart = inject(CartService);
  private router = inject(Router);
  private host = inject(ElementRef<HTMLElement>);
  readonly reviews = inject(ReviewService);
  sections:any[]=[];

  constructor(){void this.load();}

  ngAfterViewInit(){
    this.moveInsideCustomerHome();
  }

  private moveInsideCustomerHome(attempt=0){
    const host=this.host.nativeElement;
    const shop=document.getElementById('shop');
    const parent=shop?.parentElement;
    if(parent && host.parentElement!==parent){
      parent.insertBefore(host,shop);
      return;
    }
    if(!parent && attempt<20)setTimeout(()=>this.moveInsideCustomerHome(attempt+1),100);
  }

  async load(){
    try{
      const data:any=await this.api.get('/homepage');
      this.sections=Array.isArray(data?.sections)?data.sections:[];
    }catch{this.sections=[];}
  }

  add(event:Event,p:any){event.preventDefault();event.stopPropagation();if(!p?.stock)return;this.cart.add(p);void this.router.navigateByUrl('/cart');}
  like(event:Event,id:string){event.preventDefault();event.stopPropagation();this.reviews.toggleProductLike(id);}
  imageUrl(url:string){if(!url)return '';return /^https?:\/\//i.test(url)?url:`http://localhost:8080${url.startsWith('/')?'':'/'}${url}`;}
}
