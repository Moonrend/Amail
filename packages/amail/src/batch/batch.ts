import type { Amail } from '../amail.js';
import type {
  CreateBatchOptions,
  CreateBatchRequestOptions,
  CreateBatchResponse,
  CreateBatchSuccessResponse,
} from './interfaces/create-batch-options.interface.js';
import type { CreateEmailOptions } from '../emails/interfaces/create-email-options.interface.js';

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

export class Batch {
  constructor(private readonly amail: Amail) {}

  /**
   * Send batch emails (alias for `create`).
   */
  async send(
    payload: CreateBatchOptions,
    options: CreateBatchRequestOptions = {},
  ): Promise<CreateBatchResponse> {
    return this.create(payload, options);
  }

  /**
   * Send multiple emails in a single request.
   */
  async create(
    payload: CreateBatchOptions,
    options: CreateBatchRequestOptions = {},
  ): Promise<CreateBatchResponse> {
    const emails = payload.map((email) => parseEmailToApiOptions(email, this.amail.providerId));

    const data = await this.amail.post<CreateBatchSuccessResponse>(
      '/emails/batch',
      emails,
      {
        headers: {
          'x-batch-validation': options.batchValidation ?? 'strict',
          ...options.headers,
        },
      },
    );

    return data;
  }
}
