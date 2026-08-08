import { Signal } from '@angular/core';

export interface DisplayMessageConfig {
    showAlways: boolean,
    title: string,
    image: string,
    icon: string,
    message: string,
    button: string,
    secondaryButton?: string,
    delay: number,
    showSpinner: boolean,
    progress?: Signal<number>,
    progressText?: Signal<string>,
    primaryAction?: () => void,
    autoclose: boolean,
    layout?: 'dialog' | 'toast'
}
