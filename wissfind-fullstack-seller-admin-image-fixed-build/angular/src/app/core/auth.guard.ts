import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Wait for Supabase to restore the existing session before deciding.
  // Without this, a logged-in user can briefly look unauthenticated and
  // get redirected to /login when clicking Cart immediately after startup.
  await auth.ready();

  if (auth.user()) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: router.url || '/cart' }
  });
};
