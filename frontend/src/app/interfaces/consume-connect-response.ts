import { Connect } from './connect';

export interface ConsumeConnectResponse {
  status: number;
  connect: Connect;
  contactId: string;
  reciprocalContactId?: string;
}
