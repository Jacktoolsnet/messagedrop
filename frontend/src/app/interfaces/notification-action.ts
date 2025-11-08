export interface NotificationAction {
    type: 'place' | 'contact' | string;
    id?: string; // z. B. Pluscode bei place
}
