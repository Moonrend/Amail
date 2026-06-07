import type { Response, Tag } from '../../interfaces.js';

export interface GetEmailResponseSuccess {
  id: string;
  from: string;
  to: string[];
  subject: string;
  html: string | null;
  text: string | null;
  cc: string[] | null;
  bcc: string[] | null;
  tags: Tag[] | null;
  headers: Record<string, string> | null;
  status: string;
  last_event: string;
  last_error: string | null;
  message_id: string | null;
  scheduled_at: string | null;
  created_at: string;
  sent_at: string | null;
}

export type GetEmailResponse = Response<GetEmailResponseSuccess>;
