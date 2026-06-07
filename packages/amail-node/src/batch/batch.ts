import type { Amail } from '../amail.js';
import type {
  CreateBatchOptions,
  CreateBatchRequestOptions,
  CreateBatchResponse,
  CreateBatchSuccessResponse,
} from './interfaces/create-batch-options.interface.js';

function parseEmailToApiOptions(email: any) {
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
    attachments: email.attachments?.map((a: any) => ({
      content: a.content,
      filename: a.filename,
      path: a.path,
      content_type: a.contentType,
      content_id: a.contentId,
    })),
    scheduled_at: email.scheduledAt,
    provider: email.provider,
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
    const emails = payload.map(parseEmailToApiOptions);

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
