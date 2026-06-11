import type { Response, Tag, Attachment } from '../../interfaces.js';

export interface CreateEmailOptions {
  /** Sender email address. Use `"Name <sender@domain.com>"` format for a friendly name. */
  from: string;
  /** Recipient email address. Max 50. */
  to: string | string[];
  /** Email subject. */
  subject: string;
  /** The HTML version of the message. */
  html?: string;
  /** The plain text version of the message. */
  text?: string;
  /** Carbon copy recipient email address. */
  cc?: string | string[];
  /** Blind carbon copy recipient email address. */
  bcc?: string | string[];
  /** Reply-to email address. */
  replyTo?: string | string[];
  /** Custom headers to add to the email. */
  headers?: Record<string, string>;
  /** Email tags. */
  tags?: Tag[];
  /** Filename and content of attachments. */
  attachments?: Attachment[];
  /** Schedule email to be sent later. ISO 8601 format. */
  scheduledAt?: string;
  /** SMTP provider ID to use for sending. */
  providerId: string;
  /** @deprecated Use `providerId` instead. */
  provider?: string;
}

export interface CreateEmailRequestOptions {
  headers?: HeadersInit;
  idempotencyKey?: string;
}

export interface CreateEmailResponseSuccess {
  id: string;
}

export type CreateEmailResponse = Response<CreateEmailResponseSuccess>;
