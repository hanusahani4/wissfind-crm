import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ProductService } from './product.service';
import { CartService } from './cart.service';
import { AuthService } from './auth.service';

/**
 * Shared product links are opened as /product/:id.
 * On a fresh browser load, put that product into the cart and continue
 * directly to checkout. Normal in-app product navigation is unaffected.
 */
export const sharedProductGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  const products = inject(ProductService);
  const cart = inject(CartService);
  const auth = inject(AuthService);

  // Only treat a fresh/direct browser load as a shared purchase link.
  // Internal Angular navigation should continue to the normal product page.
  if (router.navigated) {
    return true;
  }

  const id = String(route.paramMap.get('id') || '').trim();
  if (!id) return true;

  const product = await products.getByIdAsync(id);
  if (!product) return true;

  // Never create an order for an unavailable product.
  if (Number(product.stock) <= 0) return true;

  cart.add(product);
  await auth.ready();

  if (!auth.user()) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: '/checkout' }
    });
  }

  return router.createUrlTree(['/checkout']);
};
