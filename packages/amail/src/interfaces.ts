export type AMAIL_ERROR_CODE =
  | 'validation_error'
  | 'missing_api_key'
  | 'invalid_api_key'
  | 'not_found'
  | 'method_not_allowed'
  | 'invalid_from_address'
  | 'invalid_parameter'
  | 'missing_required_field'
  | 'rate_limit_exceeded'
  | 'application_error'
  | 'internal_server_error';

export type Response<T> = (
  | { data: T; error: null }
  | { error: ErrorResponse; data: null }
) & {
  headers: Record<string, string> | null;
};

export type ErrorResponse = {
  message: string;
  statusCode: number | null;
  name: AMAIL_ERROR_CODE;
};

export type Tag = { name: string; value: string };

export interface Attachment {
  content?: string | Buffer;
  filename?: string;
  path?: string;
  contentType?: string;
  contentId?: string;
}
