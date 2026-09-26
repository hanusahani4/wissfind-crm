import { Component, inject, signal } from '@angular/core';
import { DecimalPipe, NgFor, NgIf } from '@angular/common';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { CartService } from './core/cart.service';
import { BackendApiService } from './core/backend-api.service';
import { WishlistService } from './core/wishlist.service';
import { HomepageSectionsComponent } from './pages/homepage-sections.component';
import { ProductService } from './core/product.service';

@Component({
  selector: 'app-root', standalone: true,
  imports: [RouterOutlet, RouterLink, NgIf, NgFor, DecimalPipe, HomepageSectionsComponent],
  template: `
    <header class="header" *ngIf="!isWorkspace"><div class="container nav"><a routerLink="/" class="brand">WISS<span>FIND</span></a><div class="links-wrap"><nav class="links" *ngIf="isCustomer"><a href="#shop" (click)="goHomeCategory($event, 'All')">Shop</a><a href="#shop" (click)="goHomeCategory($event, 'Fashion')">Fashion</a><a href="#shop" (click)="goHomeCategory($event, 'Electronics')">Electronics</a><a href="#shop" (click)="goHomeCategory($event, 'Home & Living')">Home</a><a href="#shop" (click)="goHomeCategory($event, 'Beauty')">Beauty</a><a href="#shop" (click)="goHomeCategory($event, 'Sports & Fitness')">Sports</a><a routerLink="/ai-shop">AI Shop</a><a routerLink="/compare">Compare</a><a href="#shop" (click)="goHomeCategory($event, 'All')" class="offers">Offers <b>New</b></a></nav><button class="mobile-links-arrow" *ngIf="isCustomer" type="button" aria-label="Show more categories" (click)="scrollLinks()">››</button></div><div class="search" *ngIf="isCustomer"><input #searchBox type="search" placeholder="Search products..." [value]="searchTerm" (input)="onSearchInput(searchBox.value)" (focus)="onSearchInput(searchBox.value, true)" (keyup.enter)="search(searchBox.value)" (blur)="closeSearchSuggestions()"><button type="button" aria-label="Search" (click)="search(searchBox.value)">⌕</button><div class="search-suggestions" *ngIf="searchSuggestions().length && searchOpen()"><button type="button" *ngFor="let item of searchSuggestions()" (mousedown)="$event.preventDefault()" (click)="openSearchProduct(item)"><span class="suggestion-image"><img [src]="item.image" [alt]="item.name"></span><span class="suggestion-copy"><strong>{{item.name}}</strong><small>{{item.category}} · {{item.subcategory || 'Product'}}</small><b>₹{{item.price|number}}</b></span></button></div></div><div class="actions-wrap"><div class="actions"><ng-container *ngIf="isCustomer"><a class="orders-link" routerLink="/orders">Orders</a><a class="orders-link" routerLink="/returns">Returns</a><a class="orders-link" routerLink="/price-alerts">Price alerts</a><a class="orders-link wishlist-link" routerLink="/wishlist">Wishlist<span *ngIf="wishlist.count()">{{wishlist.count()}}</span></a><a class="cart-link" routerLink="/cart"><span class="cart-icon">🛒</span><span class="cart-copy"><strong>Cart</strong><small>₹{{cart.subtotal()|number}}</small></span><span class="cart-badge" *ngIf="cart.count()">{{cart.count()}}</span></a></ng-container><ng-container *ngIf="auth.user();else guest"><a *ngIf="isCustomer" class="seller-link" routerLink="/seller/register">Become a Seller</a><a *ngIf="isSeller" class="workspace-link" routerLink="/seller">Seller Center</a><a *ngIf="isAdmin" class="workspace-link" routerLink="/admin">Admin Panel</a><button class="icon-btn" (click)="logout()">Logout</button></ng-container><ng-template #guest><a class="icon-btn" routerLink="/login">Login</a><a class="icon-btn filled" routerLink="/signup">Sign up</a></ng-template></div><button class="mobile-scroll-arrow" type="button" aria-label="Show more header options" (click)="scrollActions()">››</button></div></div></header>
    <div class="header-spacer" *ngIf="!isWorkspace"></div>
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
    .header{position:fixed!important;top:0!important;left:0!important;right:0!important;width:100%!important;z-index:2000!important;background:rgba(255,255,255,.97);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}.nav{min-height:72px;display:flex;align-items:center;gap:20px;padding-top:10px;padding-bottom:10px}.brand{font:700 21px "Space Grotesk",sans-serif;letter-spacing:-.055em;white-space:nowrap;flex:0 0 auto}.brand span{font-weight:500}.links-wrap{display:flex;align-items:center;min-width:0;flex:0 1 auto}.links{display:flex;gap:18px;align-items:center;font-size:14px;font-weight:600;white-space:nowrap;flex:0 1 auto;min-width:0;overflow-x:hidden;scrollbar-width:none}.links::-webkit-scrollbar,.actions::-webkit-scrollbar{display:none}.links a{flex:0 0 auto;cursor:pointer}.offers{display:flex;gap:7px;align-items:center}.offers b{background:#f3263f;color:#fff;border-radius:999px;padding:3px 7px;font-size:10px}.search{position:relative;flex:1 1 220px;max-width:340px;min-width:170px;display:flex;align-items:center;border:1px solid var(--line);background:#fff;border-radius:999px;padding:0 12px 0 16px}.search input{border:0;outline:0;min-width:0;width:100%;padding:11px 0;background:transparent;font-size:13px}.search button{border:0;background:transparent;font-size:22px;line-height:1;cursor:pointer}.search-suggestions{position:absolute;left:0;right:0;top:calc(100% + 8px);background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 12px 30px rgba(0,0,0,.12);padding:6px;z-index:1200;overflow:hidden}.search-suggestions>button{width:100%;display:grid;grid-template-columns:42px 1fr;gap:10px;align-items:center;text-align:left;padding:9px;border-radius:12px;background:#fff;border:0}.search-suggestions>button:hover{background:#f7f7f5}.suggestion-image{width:42px;height:42px;border-radius:8px;overflow:hidden;background:#f1f1ee}.suggestion-image img{width:100%;height:100%;object-fit:cover}.suggestion-copy{display:grid;gap:2px;min-width:0}.suggestion-copy strong,.suggestion-copy small,.suggestion-copy b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.suggestion-copy strong{font-size:12px}.suggestion-copy small{font-size:10px;color:#777}.suggestion-copy b{font-size:11px}.actions-wrap{display:flex;align-items:center;min-width:0;position:relative;margin-left:auto}.actions{display:flex;align-items:center;gap:7px;min-width:0;overflow-x:hidden;scrollbar-width:none;white-space:nowrap}.orders-link{font-size:12px;font-weight:700;white-space:nowrap;padding:9px 10px;border-radius:999px;flex:0 0 auto}.orders-link:hover{background:#f4f4f2}.wishlist-link{display:inline-flex;align-items:center;gap:4px}.wishlist-link span{min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:#f3263f;color:#fff;display:grid;place-items:center;font-size:9px;font-weight:800}.cart-link{position:relative;display:flex;align-items:center;gap:8px;min-width:90px;flex:0 0 auto}.cart-icon{font-size:20px;filter:grayscale(1)}.cart-copy{display:grid;line-height:1.05;font-size:12px}.cart-copy small{color:#555;margin-top:3px}.cart-badge{position:absolute;left:12px;top:-8px;min-width:19px;height:19px;padding:0 5px;border-radius:50%;display:grid;place-items:center;background:#f3263f;color:#fff;font-size:10px;font-weight:800}.icon-btn{border:1px solid var(--line);background:#fff;border-radius:999px;padding:10px 14px;font-weight:700;font-size:13px;white-space:nowrap;flex:0 0 auto;cursor:pointer}.icon-btn.filled{background:#111;color:#fff;border-color:#111}.mobile-scroll-arrow,.mobile-links-arrow{display:none;border:0;background:#111;color:#fff;border-radius:999px;width:28px;height:28px;flex:0 0 28px;font-size:17px;font-weight:800;line-height:1;box-shadow:0 3px 10px rgba(0,0,0,.16);cursor:pointer}.admin-tools{display:flex;gap:8px;padding:10px 18px;background:#151515;color:#fff;position:relative;z-index:19}.admin-tools a{color:#ddd;text-decoration:none;border:1px solid #444;border-radius:999px;padding:7px 11px;font-size:11px;font-weight:800}.admin-tools a:hover{background:#fff;color:#111}.seller-tools{padding:10px 18px;background:#151515;color:#fff;position:relative;z-index:19}.seller-tools-inner{max-width:1450px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:14px}.seller-tools-inner>div{display:grid;gap:2px}.seller-tools-inner strong{font-size:12px}.seller-tools-inner small{color:#bbb;font-size:11px}.telegram-connect-btn{border:1px solid #555;background:#fff;color:#111;border-radius:999px;padding:8px 13px;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap}.telegram-connect-btn:disabled{opacity:.55;cursor:wait}.seller-tools-error{max-width:1450px;margin:5px auto 0;color:#ffb4b4;font-size:11px}.header-spacer{height:92px}.footer{border-top:1px solid var(--line);padding:32px 0;background:#fff}.footer-inner{display:flex;justify-content:space-between;align-items:center;gap:28px}.footer p{color:var(--muted);margin:6px 0 0}.footer-support{display:grid;gap:5px}.footer-support strong{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#777}.footer-support a{color:#111;text-decoration:none;font-weight:800;font-size:15px}.footer-support a:hover{text-decoration:underline}@media(max-width:1350px){.nav{flex-wrap:wrap;gap:9px 14px}.links-wrap{order:3;flex:1 1 100%;width:100%;min-width:0}.links{width:100%;padding:4px 0 2px;overflow-x:auto;flex-wrap:nowrap}.search{order:2;flex:1 1 260px;max-width:360px}.actions-wrap{order:2;margin-left:auto;max-width:none}.actions{overflow-x:auto;flex-wrap:nowrap}}@media(max-width:700px){.header-spacer{height:171px}.nav{min-height:auto;gap:8px 10px;padding:9px 0}.brand{font-size:19px}.actions-wrap{order:2;margin-left:auto;max-width:calc(100% - 125px);padding-bottom:2px;overflow:hidden}.actions{max-width:100%;overflow-x:auto;flex-wrap:nowrap;padding-right:2px}.mobile-scroll-arrow{display:block;margin-left:5px}.links-wrap{order:3;flex-basis:100%;width:100%;display:flex;align-items:center;gap:5px;overflow:hidden}.links{flex:1 1 auto;width:auto;gap:15px;padding:5px 2px 4px;border-top:1px solid var(--line);overflow-x:auto;flex-wrap:nowrap}.mobile-links-arrow{display:block;margin-left:0}.search{order:4;flex-basis:100%;width:100%;max-width:none;min-width:0}.search input{padding:10px 0}.orders-link{display:inline-flex;font-size:12px;padding:8px 9px}.cart-copy{display:none}.cart-link{min-width:32px}.icon-btn{padding:8px 11px}.admin-tools{overflow:auto;white-space:nowrap}.seller-tools{padding:9px 12px}.seller-tools-inner{align-items:flex-start}.telegram-connect-btn{margin-left:auto}.footer-inner{align-items:flex-start;flex-wrap:wrap;gap:20px}.footer-support{min-width:150px}}@media(max-width:430px){.actions-wrap{max-width:calc(100% - 115px)}.icon-btn{padding:8px 10px;font-size:12px}.links{gap:14px;font-size:13px}}
  `]
})
export class AppComponent {
  readonly auth=inject(AuthService);readonly cart=inject(CartService);readonly wishlist=inject(WishlistService);private readonly router=inject(Router);private readonly api=inject(BackendApiService);private readonly products=inject(ProductService);
  telegramConnected=false;telegramBusy=false;telegramError='';searchTerm='';searchSuggestions=signal<any[]>([]);searchOpen=signal(false);private searchTimer?:number;private searchRequestId=0;
  get isCustomer(){return this.auth.getRole()==='CUSTOMER'}get isSeller(){return this.auth.getRole()==='SELLER'}get isAdmin(){return this.auth.getRole()==='ADMIN'}get isWorkspace(){return this.isSeller||this.isAdmin}get isHome(){return this.router.url==='/'||this.router.url.startsWith('/?')}
  constructor(){void this.loadTelegramStatus();if(this.isCustomer)void this.wishlist.load();}
  goHomeCategory(event:Event,category:'All'|'Fashion'|'Electronics'|'Home & Living'|'Beauty'|'Sports & Fitness'){event.preventDefault();if(this.isHome){const section=document.getElementById('shop');window.dispatchEvent(new CustomEvent('wissfind-category-change',{detail:category}));setTimeout(()=>section?.scrollIntoView({behavior:'smooth',block:'start'}),0);return;}void this.router.navigate(['/'],{queryParams:{category},fragment:'shop'});}
  scrollLinks(){const element=document.querySelector('.links') as HTMLElement|null;element?.scrollBy({left:Math.max(element.clientWidth*.75,160),behavior:'smooth'});}
  scrollActions(){const element=document.querySelector('.actions') as HTMLElement|null;element?.scrollBy({left:Math.max(element.clientWidth*.75,140),behavior:'smooth'});}
  search(term:string){
    const value=term.trim();
    this.searchTerm=value;
    this.searchOpen.set(false);
    if(value)this.router.navigate(['/'],{queryParams:{q:value}});
  }
  onSearchInput(term:string,focus=false){
    this.searchTerm=term;
    this.searchOpen.set(focus || term.trim().length>0);
    if(this.searchTimer)window.clearTimeout(this.searchTimer);
    const q=term.trim();
    if(q.length<2){this.searchSuggestions.set([]);return;}
    this.searchTimer=window.setTimeout(()=>void this.loadSearchSuggestions(q),220);
  }
  private async loadSearchSuggestions(term:string){
    const id=++this.searchRequestId;
    try{
      const result=await this.products.searchProducts(term,0,6);
      if(id===this.searchRequestId){
        this.searchSuggestions.set(result.items);
        this.searchOpen.set(true);
      }
    }catch{
      if(id===this.searchRequestId)this.searchSuggestions.set([]);
    }
  }
  closeSearchSuggestions(){window.setTimeout(()=>this.searchOpen.set(false),150);}
  openSearchProduct(item:any){this.searchTerm=item?.name||'';this.searchOpen.set(false);void this.router.navigate(['/product',item.id],{state:{product:item}});}
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
