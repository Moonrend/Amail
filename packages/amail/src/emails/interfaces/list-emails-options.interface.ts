import type { Response } from '../../interfaces.js';

export interface ListEmailsOptions {
  limit?: number;
  after?: string;
  before?: string;
}

export interface ListEmailsResponseSuccess {
  data: Array<{
    id: string;
    from: string;
    to: string[];
    subject: string;
    status: string;
    created_at: string;
    sent_at: string | null;
  }>;
  has_more?: boolean;
}

export type ListEmailsResponse = Response<ListEmailsResponseSuccess>;
