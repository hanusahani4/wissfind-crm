import { Component, inject } from '@angular/core';
import { DecimalPipe, NgIf } from '@angular/common';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { CartService } from './core/cart.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, NgIf, DecimalPipe],
  template: `
    <header class="header" *ngIf="!isWorkspace">
      <div class="container nav">
        <a routerLink="/" class="brand">WISS<span>FIND</span></a>
        <nav class="links" *ngIf="isCustomer">
          <a href="#shop" (click)="$event.preventDefault();navigateToCategory('All')">Shop</a>
          <a href="#shop" (click)="$event.preventDefault();navigateToCategory('Fashion')">Fashion</a>
          <a href="#shop" (click)="$event.preventDefault();navigateToCategory('Electronics')">Electronics</a>
          <a href="#shop" (click)="$event.preventDefault();navigateToCategory('Home & Living')">Home</a>
          <a href="#shop" (click)="$event.preventDefault();navigateToCategory('Beauty')">Beauty</a>
          <a href="#shop" (click)="$event.preventDefault();navigateToCategory('Sports & Fitness')">Sports</a>
          <a routerLink="/ai-shop">AI Shop</a><a routerLink="/compare">Compare</a><a routerLink="/ai-bundles">AI Bundles</a>
          <a routerLink="/" fragment="offers" class="offers">Offers <b>New</b></a>
        </nav>
        <div class="search" *ngIf="isCustomer"><input #searchBox type="search" placeholder="Search products..." (keyup.enter)="search(searchBox.value)"><button type="button" (click)="search(searchBox.value)">⌕</button></div>
        <div class="actions">
          <ng-container *ngIf="isCustomer">
            <a class="orders-link" routerLink="/orders">Orders</a><a class="orders-link" routerLink="/returns">Returns</a><a class="orders-link" routerLink="/price-alerts">Price alerts</a>
            <a class="cart-link" routerLink="/cart"><span class="cart-icon">🛒</span><span class="cart-copy"><strong>Cart</strong><small>₹{{cart.subtotal()|number}}</small></span><span class="cart-badge" *ngIf="cart.count()">{{cart.count()}}</span></a>
          </ng-container>
          <ng-container *ngIf="auth.user();else guest">
            <a *ngIf="isCustomer" class="seller-link" routerLink="/seller/register">Become a Seller</a>
            <a *ngIf="isSeller" class="workspace-link" routerLink="/seller">Seller Center</a>
            <a *ngIf="isAdmin" class="workspace-link" routerLink="/admin">Admin Panel</a>
            <button class="icon-btn" (click)="logout()">Logout</button>
          </ng-container>
          <ng-template #guest><a class="icon-btn" routerLink="/login">Login</a><a class="icon-btn filled" routerLink="/signup">Sign up</a></ng-template>
        </div>
      </div>
    </header>
    <router-outlet />
    <footer class="footer" *ngIf="!isWorkspace"><div class="container footer-inner"><div><div class="brand">WISS<span>FIND</span></div><p>Everyday style. Smarter tech.</p></div><div class="muted">© 2026 WissFind</div></div></footer>
  `,
  styles: [`
    .header {
      position: sticky;
      top: 0;
      z-index: 20;
      background: rgba(255,255,255,.97);
      backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--line);
    }

    .nav {
      min-height: 72px;
      display: flex;
      align-items: center;
      gap: 20px;
      padding-top: 10px;
      padding-bottom: 10px;
    }

    .brand {
      font: 700 21px "Space Grotesk", sans-serif;
      letter-spacing: -.055em;
      white-space: nowrap;
      flex: 0 0 auto;
    }

    .brand span { font-weight: 500; }

    .links {
      display: flex;
      gap: 18px;
      align-items: center;
      font-size: 14px;
      font-weight: 600;
      white-space: nowrap;
      flex: 0 1 auto;
      min-width: 0;
      overflow-x: hidden;
      scrollbar-width: none;
    }

    .links::-webkit-scrollbar,
    .actions::-webkit-scrollbar { display: none; }

    .links a { flex: 0 0 auto; }
    .ai-link { font-weight: 800; }

    .offers {
      display: flex;
      gap: 7px;
      align-items: center;
    }

    .offers b {
      background: #f3263f;
      color: #fff;
      border-radius: 999px;
      padding: 3px 7px;
      font-size: 10px;
    }

    .search {
      flex: 1 1 220px;
      max-width: 340px;
      min-width: 170px;
      display: flex;
      align-items: center;
      border: 1px solid var(--line);
      background: #fff;
      border-radius: 999px;
      padding: 0 12px 0 16px;
    }

    .search input {
      border: 0;
      outline: 0;
      min-width: 0;
      width: 100%;
      padding: 11px 0;
      background: transparent;
      font-size: 13px;
    }

    .search button {
      border: 0;
      background: transparent;
      font-size: 22px;
      line-height: 1;
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 7px;
      margin-left: auto;
      flex: 0 1 auto;
      min-width: 0;
      overflow-x: hidden;
      scrollbar-width: none;
      white-space: nowrap;
    }

    .orders-link {
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
      padding: 9px 10px;
      border-radius: 999px;
      flex: 0 0 auto;
    }

    .orders-link:hover { background: #f4f4f2; }

    .cart-link {
      position: relative;
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 90px;
      flex: 0 0 auto;
    }

    .cart-icon { font-size: 20px; filter: grayscale(1); }

    .cart-copy {
      display: grid;
      line-height: 1.05;
      font-size: 12px;
    }

    .cart-copy small { color: #555; margin-top: 3px; }

    .cart-badge {
      position: absolute;
      left: 12px;
      top: -8px;
      min-width: 19px;
      height: 19px;
      padding: 0 5px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: #f3263f;
      color: #fff;
      font-size: 10px;
      font-weight: 800;
    }

    .icon-btn {
      border: 1px solid var(--line);
      background: #fff;
      border-radius: 999px;
      padding: 10px 14px;
      font-weight: 700;
      font-size: 13px;
      white-space: nowrap;
      flex: 0 0 auto;
    }

    .icon-btn.filled {
      background: #111;
      color: #fff;
      border-color: #111;
    }

    .footer {
      border-top: 1px solid var(--line);
      padding: 32px 0;
      background: #fff;
    }

    .footer-inner {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .footer p { color: var(--muted); margin: 6px 0 0; }

    /* Tablet: keep every navigation item visible; move to rows instead of hiding. */
    @media (max-width: 1350px) {
      .nav {
        flex-wrap: wrap;
        gap: 9px 14px;
      }

      .links {
        order: 3;
        flex: 1 1 100%;
        width: 100%;
        padding: 4px 0 2px;
        overflow-x: hidden;
        flex-wrap: wrap;
      }

      .search {
        order: 2;
        flex: 1 1 260px;
        max-width: 360px;
      }

      .actions {
        order: 2;
        margin-left: auto;
        max-width: none;
        overflow-x: hidden;
        flex-wrap: wrap;
      }
    }

    /* Mobile: nothing is hidden. Navigation becomes horizontally scrollable rows. */
    @media (max-width: 700px) {
      .nav {
        min-height: auto;
        gap: 8px 10px;
        padding: 9px 0;
      }

      .brand {
        font-size: 19px;
      }

      .actions {
        order: 2;
        margin-left: auto;
        max-width: calc(100% - 125px);
        padding-bottom: 2px;
      }

      .links {
        order: 3;
        flex-basis: 100%;
        width: 100%;
        gap: 15px;
        padding: 5px 2px 4px;
        border-top: 1px solid var(--line);
      }

      .search {
        order: 4;
        flex-basis: 100%;
        width: 100%;
        max-width: none;
        min-width: 0;
      }

      .search input { padding: 10px 0; }

      .orders-link {
        display: inline-flex;
        font-size: 12px;
        padding: 8px 9px;
      }

      .cart-copy {
        display: none;
      }

      .cart-link {
        min-width: 32px;
      }

      .icon-btn {
        padding: 8px 11px;
      }
    }

    @media (max-width: 900px) {
      .nav { align-items: center; }
      .links { overflow: hidden; flex-wrap: wrap; }
      .actions { overflow: hidden; flex-wrap: wrap; }
    }

    @media (max-width: 430px) {
      .actions {
        max-width: calc(100% - 115px);
      }

      .icon-btn {
        padding: 8px 10px;
        font-size: 12px;
      }

      .links {
        gap: 14px;
        font-size: 13px;
      }
    }
  `]
})
export class AppComponent {
  navigateToCategory(category: 'All' | 'Fashion' | 'Electronics' | 'Home & Living' | 'Beauty' | 'Sports & Fitness' | 'Books & Stationery' | 'Grocery' | 'Travel') {
    const section = document.getElementById('shop');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    window.dispatchEvent(new CustomEvent('wissfind-category-change', {
      detail: category
    }));
  }


  readonly auth = inject(AuthService);
  readonly cart = inject(CartService);
  get isCustomer(){return this.auth.getRole()==='CUSTOMER';}
  get isSeller(){return this.auth.getRole()==='SELLER';}
  get isAdmin(){return this.auth.getRole()==='ADMIN';}
  get isWorkspace(){return this.isSeller||this.isAdmin;}
  private router = inject(Router);

  search(term: string) {
    const value = term.trim();
    if (value) {
      this.router.navigate(['/'], { queryParams: { q: value } });
    }
  }

  async logout() {
    await this.auth.signOut();
    await this.router.navigateByUrl('/');
  }
}
