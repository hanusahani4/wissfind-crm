import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ProductService } from './product.service';
import { CartService } from './cart.service';
import { AuthService } from './auth.service';

/**
 * Shared product purchase links use /product/:id?shared=1.
 *
 * IMPORTANT:
 * A normal product URL must NEVER be treated as a shared purchase link.
 * This prevents a browser refresh on /product/:id from adding the product
 * to the cart and redirecting the customer to checkout.
 */
export const sharedProductGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  const products = inject(ProductService);
  const cart = inject(CartService);
  const auth = inject(AuthService);

  // Only an explicitly generated shared purchase URL may trigger the
  // add-to-cart + checkout flow. Normal/direct/refresh product URLs pass through.
  const isSharedPurchaseLink = route.queryParamMap.get('shared') === '1';
  if (!isSharedPurchaseLink) {
    return true;
  }

  const id = String(route.paramMap.get('id') || '').trim();
  if (!id) return true;

  const product = await products.getByIdAsync(id);
  if (!product) return true;

  // Never create a purchase flow for an unavailable product.
  if (Number(product.stock) <= 0) return true;

  cart.add(product);
  await auth.ready();

  if (!auth.user()) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: `/product/${encodeURIComponent(id)}` }
    });
  }

  return router.createUrlTree(['/checkout']);
};
