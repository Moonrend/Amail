import type { Amail } from '../amail.js';
import type {
  CreateEmailOptions,
  CreateEmailRequestOptions,
  CreateEmailResponse,
  CreateEmailResponseSuccess,
} from './interfaces/create-email-options.interface.js';
import type {
  GetEmailResponse,
  GetEmailResponseSuccess,
} from './interfaces/get-email-options.interface.js';
import type {
  ListEmailsOptions,
  ListEmailsResponse,
  ListEmailsResponseSuccess,
} from './interfaces/list-emails-options.interface.js';
import type {
  CancelEmailResponse,
  CancelEmailResponseSuccess,
} from './interfaces/cancel-email-options.interface.js';
import type {
  ListProvidersResponse,
  ListProvidersResponseSuccess,
} from './interfaces/list-providers.interface.js';

function parseEmailToApiOptions(email: CreateEmailOptions, defaultProviderId?: string) {
  const providerId = email.providerId ?? email.provider ?? defaultProviderId;
  if (!providerId) {
    throw new Error(
      'Missing providerId. Set `providerId` in payload or pass default `providerId` to `new Amail(...)`.',
    );
  }
  return {
    from: email.from,
    to: email.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
    cc: email.cc,
    bcc: email.bcc,
    reply_to: email.replyTo,
    headers: email.headers,
    tags: email.tags,
    attachments: email.attachments?.map((a) => ({
      content: a.content,
      filename: a.filename,
      path: a.path,
      content_type: a.contentType,
      content_id: a.contentId,
    })),
    scheduled_at: email.scheduledAt,
    provider_id: providerId,
  };
}

function buildPaginationQuery(options: ListEmailsOptions): string {
  const params = new URLSearchParams();
  if (options.limit !== undefined) params.set('limit', options.limit.toString());
  if (options.after !== undefined) params.set('after', options.after);
  if (options.before !== undefined) params.set('before', options.before);
  return params.toString();
}

export class Emails {
  constructor(private readonly amail: Amail) {}

  /**
   * Send an email (alias for `create`).
   */
  async send(
    payload: CreateEmailOptions,
    options: CreateEmailRequestOptions = {},
  ): Promise<CreateEmailResponse> {
    return this.create(payload, options);
  }

  /**
   * Send a single email.
   */
  async create(
    payload: CreateEmailOptions,
    options: CreateEmailRequestOptions = {},
  ): Promise<CreateEmailResponse> {
    const data = await this.amail.post<CreateEmailResponseSuccess>(
      '/emails',
      parseEmailToApiOptions(payload, this.amail.providerId),
      options,
    );
    return data;
  }

  /**
   * Get an email by ID.
   */
  async get(id: string): Promise<GetEmailResponse> {
    const data = await this.amail.get<GetEmailResponseSuccess>(
      `/emails/${id}`,
    );
    return data;
  }

  /**
   * List emails with cursor-based pagination.
   */
  async list(options: ListEmailsOptions = {}): Promise<ListEmailsResponse> {
    const queryString = buildPaginationQuery(options);
    const url = queryString ? `/emails?${queryString}` : '/emails';
    const data = await this.amail.get<ListEmailsResponseSuccess>(url);
    return data;
  }

  /**
   * Cancel a queued or scheduled email.
   */
  async cancel(id: string): Promise<CancelEmailResponse> {
    const data = await this.amail.post<CancelEmailResponseSuccess>(
      `/emails/${id}/cancel`,
    );
    return data;
  }

  /**
   * List available SMTP providers.
   */
  async providers(): Promise<ListProvidersResponse> {
    const data = await this.amail.get<ListProvidersResponseSuccess>(
      '/emails/providers',
    );
    return data;
  }
}
