import { Location } from "./location";
import { MarkerType } from "./marker-type";
import { Message } from "./message";
import { Note } from "./note";

export interface MarkerLocation {
    location: Location,
    messages: Message[],
    notes: Note[];
    type: MarkerType
}
