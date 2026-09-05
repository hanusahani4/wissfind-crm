import { Routes } from '@angular/router';
import { roleGuard } from './core/role.guard';
import { sharedProductGuard } from './core/shared-product.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home.component').then(m => m.HomeComponent) },
  { path: 'product/:id', canActivate: [sharedProductGuard], loadComponent: () => import('./pages/product-detail.component').then(m => m.ProductDetailComponent) },
  { path: 'login', loadComponent: () => import('./pages/login.component').then(m => m.LoginComponent) },
  { path: 'signup', loadComponent: () => import('./pages/signup.component').then(m => m.SignupComponent) },
  { path: 'forgot-password', loadComponent: () => import('./pages/forgot-password.component').then(m => m.ForgotPasswordComponent) },
  { path: 'cart', loadComponent: () => import('./pages/cart.component').then(m => m.CartComponent) },
  { path: 'checkout', canActivate: [roleGuard(['CUSTOMER'])], loadComponent: () => import('./pages/checkout.component').then(m => m.CheckoutComponent) },
  { path: 'orders', canActivate: [roleGuard(['CUSTOMER'])], loadComponent: () => import('./pages/orders.component').then(m => m.OrdersComponent) },
  { path: 'ai-shop', canActivate: [roleGuard(['CUSTOMER'])], loadComponent: () => import('./pages/ai-shop.component').then(m => m.AiShopComponent) },
  { path: 'compare', canActivate: [roleGuard(['CUSTOMER'])], loadComponent: () => import('./pages/compare.component').then(m => m.CompareComponent) },
  { path: 'price-alerts', canActivate: [roleGuard(['CUSTOMER'])], loadComponent: () => import('./pages/price-alerts.component').then(m => m.PriceAlertsComponent) },
  { path: 'returns', canActivate: [roleGuard(['CUSTOMER'])], loadComponent: () => import('./pages/returns.component').then(m => m.ReturnsComponent) },
  { path: 'ai-bundles', canActivate: [roleGuard(['CUSTOMER'])], loadComponent: () => import('./pages/ai-bundles.component').then(m => m.AiBundlesComponent) },
  { path: 'admin', canActivate: [roleGuard(['ADMIN'])], loadComponent: () => import('./pages/admin.component').then(m => m.AdminComponent) },
  { path: 'seller/register', canActivate: [roleGuard(['CUSTOMER'])], loadComponent: () => import('./pages/seller-register.component').then(m => m.SellerRegisterComponent) },
  { path: 'seller', canActivate: [roleGuard(['SELLER'])], loadComponent: () => import('./pages/seller.component').then(m => m.SellerComponent) },
  { path: '**', redirectTo: '' }
];
