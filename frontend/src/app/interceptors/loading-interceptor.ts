import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';
import { DisplayMessage } from '../components/utils/display-message/display-message.component';
import { NetworkService } from '../services/network.service';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
    const networkService = inject(NetworkService);
    const loadingDialogRef: MatDialogRef<DisplayMessage> | undefined = networkService.showLoadingDialog(req.url);
    if (!loadingDialogRef) {
        return next(req);
    } else {
        return next(req).pipe(
            finalize(() => {
                try {
                    loadingDialogRef.close();
                } catch (err) {
                    console.warn('Failed to close dialog:', err);
                }
            })
        );
    }
};