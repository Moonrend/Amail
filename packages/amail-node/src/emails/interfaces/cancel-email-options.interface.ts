import type { Response } from '../../interfaces.js';

export interface CancelEmailResponseSuccess {
  object: string;
  id: string;
  deleted: boolean;
}

export type CancelEmailResponse = Response<CancelEmailResponseSuccess>;
