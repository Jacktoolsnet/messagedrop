import { Location } from './location';

export interface NotificationAction {
    type: 'place' | 'contact' | 'message' | string;
    id?: string; // z. B. Pluscode bei place
    contactUserId?: string;
    messageId?: string;
    placeId?: string;
    location?: Location;
}
