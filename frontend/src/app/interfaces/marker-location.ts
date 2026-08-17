import { LocalDocument } from "./local-document";
import { LocalImage } from "./local-image";
import { Location } from "./location";
import { MarkerType } from "./marker-type";
import { Message } from "./message";
import { Note } from "./note";
import { SecretDrop } from "./secret-drop";
import { ExperienceResult, ViatorDestinationLookup } from "./viator";
import { WikipediaArticle } from "./wikipedia";
import { TripGoStop } from "./tripgo";
import { GeodataPoi } from "./geodata";

export interface MarkerLocation {
    location: Location,
    messages: Message[],
    notes: Note[];
    images: LocalImage[];
    documents: LocalDocument[];
    experiences?: ViatorDestinationLookup[];
    myExperiences?: ExperienceResult[];
    secretDrops?: SecretDrop[];
    wikipediaArticles?: WikipediaArticle[];
    publicTransportStop?: TripGoStop;
    geodataPoi?: GeodataPoi;
    geodataPois?: GeodataPoi[];
    geodataGrouped?: boolean;
    type: MarkerType
}
