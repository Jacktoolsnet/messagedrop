import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { UserService } from '../services/user.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const userService = inject(UserService);

    if (req.url.includes('tenor')) {
        return next(req);
    }

    if (userService.isReady()) {
        const authReq = req.clone({
            setHeaders: {
                Authorization: `Bearer ${userService.getUser().jwt}`
            }
        });
        return next(authReq);
    }

    return next(req);
};