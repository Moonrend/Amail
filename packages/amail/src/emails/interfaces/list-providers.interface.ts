import type { Response } from '../../interfaces.js';

export interface Provider {
  id: string;
  name: string;
  host: string;
  from_address: string | null;
}

export interface ListProvidersResponseSuccess {
  data: Provider[];
}

export type ListProvidersResponse = Response<ListProvidersResponseSuccess>;
