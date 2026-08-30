import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export type AppRole = 'CUSTOMER' | 'SELLER' | 'ADMIN';

export const roleGuard = (allowed: AppRole[]): CanActivateFn => async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready();
  if (!auth.user()) {
    const returnUrl = router.url || '/';
    return router.createUrlTree(['/login'], { queryParams: { returnUrl } });
  }
  if (allowed.includes(auth.getRole())) return true;
  const role = auth.getRole();
  return router.createUrlTree([role === 'ADMIN' ? '/admin' : role === 'SELLER' ? '/seller' : '/']);
};
