import type { Response } from '../../interfaces.js';
import type { CreateEmailOptions } from '../../emails/interfaces/create-email-options.interface.js';

export type CreateBatchOptions = CreateEmailOptions[];

export interface CreateBatchRequestOptions {
  headers?: HeadersInit;
  batchValidation?: 'strict' | 'permissive';
}

export interface CreateBatchSuccessResponse {
  data: Array<{ id: string }>;
}

export type CreateBatchResponse = Response<CreateBatchSuccessResponse>;
