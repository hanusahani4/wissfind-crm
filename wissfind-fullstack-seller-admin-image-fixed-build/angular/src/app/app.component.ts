import { Component, HostListener, inject, signal } from '@angular/core';
import { DecimalPipe, NgFor, NgIf } from '@angular/common';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { CartService } from './core/cart.service';
import { BackendApiService } from './core/backend-api.service';
import { WishlistService } from './core/wishlist.service';
import { HomepageSectionsComponent } from './pages/homepage-sections.component';

@Component({
  selector: 'app-root', standalone: true,
  imports: [RouterOutlet, RouterLink, NgIf, NgFor, DecimalPipe, HomepageSectionsComponent],
  template: `
    <header class="header" *ngIf="!isWorkspace"><div class="container nav"><a routerLink="/" class="brand">WISS<span>FIND</span></a><div class="links-wrap"><nav class="links" *ngIf="isCustomer"><a href="#shop" (click)="goHomeCategory($event, 'All')">Shop</a><div class="header-category" *ngFor="let category of headerCategories"><button type="button" class="header-category-btn" [class.active]="openHeaderCategory()===category" (click)="toggleHeaderCategory($event,category)">{{category}} <span>⌄</span></button></div><a routerLink="/ai-shop">AI Shop</a><a routerLink="/compare">Compare</a><a href="#shop" (click)="goHomeCategory($event, 'All')" class="offers">Offers <b>New</b></a></nav><div class="header-category-panel" *ngIf="openHeaderCategory()" [style.top.px]="mobileHeaderBottom()"><button type="button" class="header-child-btn active" (click)="selectHeaderChild($event,openHeaderCategory()!,'All')">All</button><button type="button" class="header-child-btn" *ngFor="let child of headerCategoryMap[openHeaderCategory()!]" (click)="selectHeaderChild($event,openHeaderCategory()!,child)">{{child}}</button></div><button class="mobile-links-arrow" *ngIf="isCustomer" type="button" aria-label="Show more categories" (click)="scrollLinks()">››</button></div><div class="search" *ngIf="isCustomer"><input #searchBox type="search" placeholder="Search products..." [value]="searchTerm" (input)="onSearchInput(searchBox.value)" (keyup.enter)="search(searchBox.value)"><button type="button" aria-label="Search" (click)="search(searchBox.value)">⌕</button></div><div class="actions-wrap"><div class="actions"><ng-container *ngIf="isCustomer"><a class="orders-link" routerLink="/orders">Orders</a><a class="orders-link" routerLink="/returns">Returns</a><a class="orders-link" routerLink="/price-alerts">Price alerts</a><a class="orders-link wishlist-link" routerLink="/wishlist">Wishlist<span *ngIf="wishlist.count()">{{wishlist.count()}}</span></a><a class="cart-link" routerLink="/cart"><span class="cart-icon">🛒</span><span class="cart-copy"><strong>Cart</strong><small>₹{{cart.subtotal()|number}}</small></span><span class="cart-badge" *ngIf="cart.count()">{{cart.count()}}</span></a></ng-container><ng-container *ngIf="auth.user();else guest"><a *ngIf="isCustomer" class="seller-link" routerLink="/seller/register">Become a Seller</a><a *ngIf="isSeller" class="workspace-link" routerLink="/seller">Seller Center</a><a *ngIf="isAdmin" class="workspace-link" routerLink="/admin">Admin Panel</a><button class="icon-btn" (click)="logout()">Logout</button></ng-container><ng-template #guest><a class="icon-btn" routerLink="/login">Login</a><a class="icon-btn filled" routerLink="/signup">Sign up</a></ng-template></div><button class="mobile-scroll-arrow" type="button" aria-label="Show more header options" (click)="scrollActions()">››</button></div></div></header>
    <div class="header-spacer" *ngIf="!isWorkspace"></div>
    <div class="mobile-search-layer" *ngIf="isCustomer">
      <div class="mobile-search-panel" *ngIf="mobileSearchOpen()" [style.left.px]="searchPanelLeft()" [style.top.px]="mobileSearchTop()">
        <input #mobileSearchBox type="search" placeholder="Search products..." [value]="searchTerm" (input)="searchTerm=mobileSearchBox.value" (keyup.enter)="search(mobileSearchBox.value)" autofocus>
      </div>
      <button type="button" class="mobile-search-fab" [class.open]="mobileSearchOpen()" [style.left.px]="mobileSearchLeft()" [style.top.px]="mobileSearchTop()" aria-label="Search products" (click)="toggleMobileSearch($event)" (pointerdown)="startSearchDrag($event)" (pointermove)="dragSearch($event)" (pointerup)="endSearchDrag($event)" (pointercancel)="endSearchDrag($event)">
        ⌕
      </button>
    </div>
    <div class="admin-tools" *ngIf="isAdmin"><a routerLink="/admin">Admin Panel</a><a routerLink="/admin/homepage">🏠 Homepage Management</a><a routerLink="/admin/shipping">🚚 Delivery & COD</a></div>
    <div class="seller-tools" *ngIf="isSeller">
      <div class="seller-tools-inner">
        <div><strong>Telegram order notifications</strong><small>{{telegramConnected ? 'Connected — new orders will be sent to Telegram.' : 'Connect once to receive new seller orders.'}}</small></div>
        <button type="button" class="telegram-connect-btn" [disabled]="telegramBusy" (click)="connectTelegram()">{{telegramBusy ? 'Opening Telegram...' : (telegramConnected ? 'Reconnect Telegram' : 'Connect Telegram')}}</button>
      </div>
      <div class="seller-tools-error" *ngIf="telegramError">{{telegramError}}</div>
    </div>
    <router-outlet />
    <app-homepage-sections *ngIf="!isWorkspace && isHome" />
    <footer class="footer" *ngIf="!isWorkspace"><div class="container footer-inner"><div><div class="brand">WISS<span>FIND</span></div><p>Everyday style. Smarter tech.</p></div><div class="footer-support"><strong>Customer Support</strong><a href="tel:+918299360496">8299360496</a></div><div class="muted">© 2026 WissFind</div></div></footer>
  `,
  styles: [`
    .header{position:fixed!important;top:0!important;left:0!important;right:0!important;width:100%!important;z-index:2000!important;background:rgba(255,255,255,.97);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}.nav{min-height:72px;display:flex;align-items:center;gap:20px;padding-top:10px;padding-bottom:10px}.brand{font:700 21px "Space Grotesk",sans-serif;letter-spacing:-.055em;white-space:nowrap;flex:0 0 auto}.brand span{font-weight:500}.links-wrap{display:flex;align-items:center;min-width:0;flex:0 1 auto}.links{display:flex;gap:18px;align-items:center;font-size:14px;font-weight:600;white-space:nowrap;flex:0 1 auto;min-width:0;overflow-x:hidden;scrollbar-width:none}.links::-webkit-scrollbar,.actions::-webkit-scrollbar{display:none}.links a{flex:0 0 auto;cursor:pointer}.header-category{position:relative;flex:0 0 auto}.header-category-btn{border:0;background:transparent;padding:9px 0;font:inherit;font-weight:600;white-space:nowrap;cursor:pointer;color:inherit}.header-category-btn span{font-size:10px;margin-left:3px}.header-category-btn.active{font-weight:800}.header-category-panel{position:fixed;top:92px;left:50%;transform:translateX(-50%);width:min(900px,calc(100% - 32px));display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 14px;background:#fff;border:1px solid var(--line);border-radius:0 0 16px 16px;box-shadow:0 10px 30px rgba(0,0,0,.10);z-index:1999}.header-child-btn{border:1px solid var(--line);background:#fff;color:#111;border-radius:999px;padding:8px 14px;font-size:12px;font-weight:700;white-space:nowrap;cursor:pointer}.header-child-btn:hover,.header-child-btn.active{background:#111;color:#fff;border-color:#111}.offers{display:flex;gap:7px;align-items:center}.offers b{background:#f3263f;color:#fff;border-radius:999px;padding:3px 7px;font-size:10px}.search{position:relative;flex:1 1 220px;max-width:340px;min-width:170px;display:flex;align-items:center;border:1px solid var(--line);background:#fff;border-radius:999px;padding:0 12px 0 16px}.search input{border:0;outline:0;min-width:0;width:100%;padding:11px 0;background:transparent;font-size:13px}.search button{border:0;background:transparent;font-size:22px;line-height:1;cursor:pointer}.actions-wrap{display:flex;align-items:center;min-width:0;position:relative;margin-left:auto}.actions{display:flex;align-items:center;gap:7px;min-width:0;overflow-x:hidden;scrollbar-width:none;white-space:nowrap}.orders-link{font-size:12px;font-weight:700;white-space:nowrap;padding:9px 10px;border-radius:999px;flex:0 0 auto}.orders-link:hover{background:#f4f4f2}.wishlist-link{display:inline-flex;align-items:center;gap:4px}.wishlist-link span{min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:#f3263f;color:#fff;display:grid;place-items:center;font-size:9px;font-weight:800}.cart-link{position:relative;display:flex;align-items:center;gap:8px;min-width:90px;flex:0 0 auto}.cart-icon{font-size:20px;filter:grayscale(1)}.cart-copy{display:grid;line-height:1.05;font-size:12px}.cart-copy small{color:#555;margin-top:3px}.cart-badge{position:absolute;left:12px;top:-8px;min-width:19px;height:19px;padding:0 5px;border-radius:50%;display:grid;place-items:center;background:#f3263f;color:#fff;font-size:10px;font-weight:800}.icon-btn{border:1px solid var(--line);background:#fff;border-radius:999px;padding:10px 14px;font-weight:700;font-size:13px;white-space:nowrap;flex:0 0 auto;cursor:pointer}.icon-btn.filled{background:#111;color:#fff;border-color:#111}.mobile-scroll-arrow,.mobile-links-arrow{display:none;border:0;background:#111;color:#fff;border-radius:999px;width:28px;height:28px;flex:0 0 28px;font-size:17px;font-weight:800;line-height:1;box-shadow:0 3px 10px rgba(0,0,0,.16);cursor:pointer}.admin-tools{display:flex;gap:8px;padding:10px 18px;background:#151515;color:#fff;position:relative;z-index:19}.admin-tools a{color:#ddd;text-decoration:none;border:1px solid #444;border-radius:999px;padding:7px 11px;font-size:11px;font-weight:800}.admin-tools a:hover{background:#fff;color:#111}.seller-tools{padding:10px 18px;background:#151515;color:#fff;position:relative;z-index:19}.seller-tools-inner{max-width:1450px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:14px}.seller-tools-inner>div{display:grid;gap:2px}.seller-tools-inner strong{font-size:12px}.seller-tools-inner small{color:#bbb;font-size:11px}.telegram-connect-btn{border:1px solid #555;background:#fff;color:#111;border-radius:999px;padding:8px 13px;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap}.telegram-connect-btn:disabled{opacity:.55;cursor:wait}.seller-tools-error{max-width:1450px;margin:5px auto 0;color:#ffb4b4;font-size:11px}.header-spacer{height:92px}.mobile-search-layer{display:none}.mobile-search-fab,.mobile-search-panel{display:none}.footer{border-top:1px solid var(--line);padding:32px 0;background:#fff}.footer-inner{display:flex;justify-content:space-between;align-items:center;gap:28px}.footer p{color:var(--muted);margin:6px 0 0}.footer-support{display:grid;gap:5px}.footer-support strong{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#777}.footer-support a{color:#111;text-decoration:none;font-weight:800;font-size:15px}.footer-support a:hover{text-decoration:underline}@media(max-width:1350px){.nav{flex-wrap:wrap;gap:9px 14px}.links-wrap{order:3;flex:1 1 100%;width:100%;min-width:0}.links{width:100%;padding:4px 0 2px;overflow-x:auto;flex-wrap:nowrap}.search{order:2;flex:1 1 260px;max-width:360px}.actions-wrap{order:2;margin-left:auto;max-width:none}.actions{overflow-x:auto;flex-wrap:nowrap}}@media(max-width:700px){
      .header-category-panel{width:calc(100% - 20px);left:10px;transform:none;padding:10px 11px;border-radius:14px}
      .header-child-btn{font-size:11px;padding:8px 12px}
      .header-category-btn{font-size:13px}

      .header .search{display:none!important}
      .mobile-search-layer{display:block;position:fixed;inset:0;z-index:2100;pointer-events:none}
      .mobile-search-fab{
        display:grid;position:fixed;top:184px;width:48px;height:48px;min-width:48px;border:1px solid #ddd;border-radius:50%;
        background:#fff;color:#111;place-items:center;font-size:24px;line-height:1;box-shadow:0 8px 24px rgba(0,0,0,.15);
        padding:0;touch-action:none;user-select:none;cursor:grab;pointer-events:auto;z-index:2101
      }
      .mobile-search-fab:active{cursor:grabbing}
      .mobile-search-fab.open{box-shadow:0 8px 28px rgba(0,0,0,.22)}
      .mobile-search-panel{
        display:flex;position:fixed;width:min(52vw,300px);min-width:210px;height:48px;align-items:center;
        border:1px solid #ddd;border-radius:999px;background:#fff;box-shadow:0 10px 28px rgba(0,0,0,.16);
        padding:0 16px;pointer-events:auto;z-index:2100
      }
      .mobile-search-panel input{border:0;outline:0;background:transparent;min-width:0;width:100%;font-size:14px;padding:10px 0}
      .mobile-search-panel button{border:0;background:transparent;font-size:23px;line-height:1;cursor:pointer}
      .header-spacer{height:171px}.nav{min-height:auto;gap:8px 10px;padding:9px 0}.brand{font-size:19px}.actions-wrap{order:2;margin-left:auto;max-width:calc(100% - 125px);padding-bottom:2px;overflow:hidden}.actions{max-width:100%;overflow-x:auto;flex-wrap:nowrap;padding-right:2px}.mobile-scroll-arrow{display:block;margin-left:5px}.links-wrap{order:3;flex-basis:100%;width:100%;display:flex;align-items:center;gap:5px;overflow:hidden}.links{flex:1 1 auto;width:auto;gap:15px;padding:5px 2px 4px;border-top:1px solid var(--line);overflow-x:auto;flex-wrap:nowrap}.mobile-links-arrow{display:block;margin-left:0}.search{order:4;flex-basis:100%;width:100%;max-width:none;min-width:0}.search input{padding:10px 0}.orders-link{display:inline-flex;font-size:12px;padding:8px 9px}.cart-copy{display:none}.cart-link{min-width:32px}.icon-btn{padding:8px 11px}.admin-tools{overflow:auto;white-space:nowrap}.seller-tools{padding:9px 12px}.seller-tools-inner{align-items:flex-start}.telegram-connect-btn{margin-left:auto}.footer-inner{align-items:flex-start;flex-wrap:wrap;gap:20px}.footer-support{min-width:150px}}@media(max-width:430px){.actions-wrap{max-width:calc(100% - 115px)}.icon-btn{padding:8px 10px;font-size:12px}.links{gap:14px;font-size:13px}}
      @media(max-width:900px){
        .header .search{display:none!important}
        .mobile-search-layer{display:block;position:fixed;inset:0;z-index:2100;pointer-events:none}
        .mobile-search-fab{
          display:grid;position:fixed;width:48px;height:48px;min-width:48px;border:1px solid #ddd;border-radius:50%;
          background:#fff;color:#111;place-items:center;font-size:24px;line-height:1;box-shadow:0 8px 24px rgba(0,0,0,.15);
          padding:0;touch-action:none;user-select:none;cursor:grab;pointer-events:auto;z-index:2101
        }
        .mobile-search-fab:active{cursor:grabbing}
        .mobile-search-fab.open{box-shadow:0 8px 28px rgba(0,0,0,.22)}
        .mobile-search-panel{
          display:flex;position:fixed;width:min(52vw,300px);min-width:210px;height:48px;align-items:center;
          border:1px solid #ddd;border-radius:999px;background:#fff;box-shadow:0 10px 28px rgba(0,0,0,.16);
          padding:0 10px 0 16px;pointer-events:auto;z-index:2100
        }
        .mobile-search-panel input{border:0;outline:0;background:transparent;min-width:0;width:100%;font-size:14px;padding:10px 0}
        .mobile-search-panel button{border:0;background:transparent;font-size:23px;line-height:1;cursor:pointer}
      }
  `]
})
export class AppComponent {
  readonly auth=inject(AuthService);readonly cart=inject(CartService);readonly wishlist=inject(WishlistService);private readonly router=inject(Router);private readonly api=inject(BackendApiService);
  telegramConnected=false;telegramBusy=false;telegramError='';searchTerm='';openHeaderCategory=signal<string|null>(null);mobileHeaderBottom=signal(0);headerCategories=['Fashion','Electronics','Home & Living','Beauty','Sports & Fitness'];headerCategoryMap:Record<string,string[]>={Fashion:['Men','Women','Kids','Accessories','Footwear'],Electronics:['Smartphones','Laptops','Tablets','Audio','Wearables','Gaming','Cameras','TVs & Displays','Accessories'],'Home & Living':['Furniture','Kitchen','Home Decor','Lighting','Storage','Appliances'],Beauty:['Skincare','Makeup','Hair Care','Fragrances','Grooming'],'Sports & Fitness':['Running','Gym','Yoga','Cycling','Sports Shoes','Fitness Equipment']};private searchTimer?:number;mobileSearchOpen=signal(false);mobileSearchLeft=signal(0);private draggingSearch=false;private searchDragMoved=false;private suppressSearchClick=false;private searchDragOffsetX=0;private searchDragOffsetY=0;mobileSearchTop=signal(184);
  get isCustomer(){return this.auth.getRole()==='CUSTOMER'}get isSeller(){return this.auth.getRole()==='SELLER'}get isAdmin(){return this.auth.getRole()==='ADMIN'}get isWorkspace(){return this.isSeller||this.isAdmin}get isHome(){return this.router.url==='/'||this.router.url.startsWith('/?')}
  constructor(){void this.loadTelegramStatus();if(this.isCustomer)void this.wishlist.load();queueMicrotask(()=>{this.positionSearchFab();this.measureMobileHeader();});}
  toggleHeaderCategory(event:Event,category:string){
    event.preventDefault();
    event.stopPropagation();
    this.openHeaderCategory.update(v=>v===category?null:category);
  }
  selectHeaderChild(event:Event,category:string,child:string){
    event.preventDefault();
    event.stopPropagation();
    this.openHeaderCategory.set(null);
    if(category==='Fashion'||category==='Electronics'||category==='Home & Living'||category==='Beauty'||category==='Sports & Fitness'){
      if(this.isHome) {
        window.dispatchEvent(new CustomEvent('wissfind-category-change',{detail:{category,subcategory:child}}));
        const section=document.getElementById('shop');
        setTimeout(()=>section?.scrollIntoView({behavior:'smooth',block:'start'}),0);
      } else {
        void this.router.navigate(['/'],{queryParams:{category,subcategory:child},fragment:'shop'});
      }
    }
  }

  goHomeCategory(event:Event,category:'All'|'Fashion'|'Electronics'|'Home & Living'|'Beauty'|'Sports & Fitness'){event.preventDefault();if(this.isHome){const section=document.getElementById('shop');window.dispatchEvent(new CustomEvent('wissfind-category-change',{detail:category}));setTimeout(()=>section?.scrollIntoView({behavior:'smooth',block:'start'}),0);return;}void this.router.navigate(['/'],{queryParams:{category},fragment:'shop'});}
  scrollLinks(){const element=document.querySelector('.links') as HTMLElement|null;element?.scrollBy({left:Math.max(element.clientWidth*.75,160),behavior:'smooth'});}
  scrollActions(){const element=document.querySelector('.actions') as HTMLElement|null;element?.scrollBy({left:Math.max(element.clientWidth*.75,140),behavior:'smooth'});}
  onSearchInput(term:string){
    this.searchTerm=term;
    if(this.searchTimer)window.clearTimeout(this.searchTimer);
    this.searchTimer=window.setTimeout(()=>{
      const value=this.searchTerm.trim();
      if(value)this.router.navigate(['/'],{queryParams:{q:value},fragment:'shop'});
      else this.router.navigate(['/'],{queryParams:{},fragment:'shop'});
    },280);
  }
  private positionSearchFab(){
    if(typeof window==='undefined')return;
    this.mobileSearchLeft.set(Math.max(8,window.innerWidth-64));
    this.mobileSearchTop.set(Math.min(240,Math.max(70,window.innerHeight-110)));
  }
  searchPanelLeft(){
    if(typeof window==='undefined')return 14;
    const width=Math.min(window.innerWidth*0.52,300);
    const gap=8;
    const leftSide=this.mobileSearchLeft() < window.innerWidth/2;
    return leftSide
      ? Math.min(window.innerWidth-width-8,this.mobileSearchLeft()+56+gap)
      : Math.max(8,this.mobileSearchLeft()-width-gap);
  }
  private measureMobileHeader(){if(typeof window==='undefined'||window.innerWidth>700)return;const header=document.querySelector('.header') as HTMLElement|null;if(header)this.mobileHeaderBottom.set(Math.ceil(header.getBoundingClientRect().bottom));}
  @HostListener('window:resize') onWindowResize(){if(typeof window!=='undefined'&&window.innerWidth<=700){this.measureMobileHeader();if(!this.draggingSearch){this.mobileSearchLeft.set(Math.min(window.innerWidth-56,Math.max(8,this.mobileSearchLeft())));this.mobileSearchTop.set(Math.min(window.innerHeight-56,Math.max(70,this.mobileSearchTop())));}}}
  startSearchDrag(event:PointerEvent){
    if(event.button!==0&&event.pointerType!=='touch')return;
    const target=event.currentTarget as HTMLElement;
    const rect=target.getBoundingClientRect();
    this.draggingSearch=true;this.searchDragMoved=false;this.searchDragOffsetX=event.clientX-rect.left;this.searchDragOffsetY=event.clientY-rect.top;
    try{target.setPointerCapture(event.pointerId);}catch{}
  }
  dragSearch(event:PointerEvent){
    if(!this.draggingSearch||typeof window==='undefined')return;
    const nextX=event.clientX-this.searchDragOffsetX;
    const nextY=event.clientY-this.searchDragOffsetY;
    const clampedX=Math.min(window.innerWidth-56,Math.max(8,nextX));
    const clampedY=Math.min(window.innerHeight-56,Math.max(70,nextY));
    if(Math.abs(clampedX-this.mobileSearchLeft())>3||Math.abs(clampedY-this.mobileSearchTop())>3)this.searchDragMoved=true;
    this.mobileSearchLeft.set(clampedX);
    this.mobileSearchTop.set(clampedY);
    event.preventDefault();
  }
  endSearchDrag(event:PointerEvent){
    if(!this.draggingSearch)return;
    this.draggingSearch=false;
    try{(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);}catch{}
    if(this.searchDragMoved)this.suppressSearchClick=true;
  }
  toggleMobileSearch(event:Event){
    if(this.suppressSearchClick){event.preventDefault();this.suppressSearchClick=false;return;}
    this.mobileSearchOpen.update((v: boolean)=>!v);
  }
  search(term:string){
    const value=term.trim();
    this.searchTerm=value;
    if(this.searchTimer)window.clearTimeout(this.searchTimer);
    if(value)this.router.navigate(['/'],{queryParams:{q:value},fragment:'shop'});
    else this.router.navigate(['/'],{queryParams:{},fragment:'shop'});
  }
  async loadTelegramStatus(){if(!this.isSeller)return;try{const data:any=await this.api.get('/telegram/status');this.telegramConnected=!!data?.connected;}catch{}}
  async connectTelegram(){
    if(this.telegramBusy)return;
    this.telegramBusy=true;this.telegramError='';
    try{
      const data:any=await this.api.get('/telegram/connect');
      if(!data?.connectUrl)throw new Error('Telegram connection link is unavailable');
      window.open(data.connectUrl,'_blank','noopener,noreferrer');
      const started=Date.now();
      const check=async()=>{
        try{
          const status:any=await this.api.get('/telegram/status');
          if(status?.connected){this.telegramConnected=true;this.telegramBusy=false;return;}
        }catch{}
        if(Date.now()-started<60000)window.setTimeout(()=>void check(),3000);
        else this.telegramBusy=false;
      };
      window.setTimeout(()=>void check(),3000);
    }catch(e:any){this.telegramBusy=false;this.telegramError=e?.error?.error||e?.error?.message||e?.message||'Unable to connect Telegram';}
  }
  async logout(){await this.auth.signOut();await this.router.navigateByUrl('/')}
}
