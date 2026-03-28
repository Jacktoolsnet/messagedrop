import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { hasAllowedRole } from '../../utils/admin-role-access';

export const authGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.hasValidSession()) {
    return router.createUrlTree(['/login']);
  }

  const allowedRoles = route.data?.['allowedRoles'];
  if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !hasAllowedRole(auth.role(), allowedRoles)) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};
