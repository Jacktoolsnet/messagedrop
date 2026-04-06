export interface PublicMessageRow {
  id: number;
  parentId?: number | null;
  uuid: string;
  parentUuid: string | null;
  typ: string;
  createDateTime: number | null;
  latitude: number | null;
  longitude: number | null;
  plusCode: string;
  message: string;
  translatedMessage?: string;
  markerType: string;
  style: string;
  hashtags?: string | string[] | null;
  views: number;
  likes: number;
  dislikes: number;
  commentsNumber: number;
  status: string;
  userId: string;
  multimedia: string;
}
