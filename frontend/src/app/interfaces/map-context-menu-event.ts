import { Location } from './location';

export interface MapContextMenuEvent {
  location: Location;
  clientX: number;
  clientY: number;
}
