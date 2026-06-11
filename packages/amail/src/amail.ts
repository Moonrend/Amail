import { Emails } from './emails/emails.js';
import { Batch } from './batch/batch.js';
import type { ErrorResponse, Response } from './interfaces.js';

const defaultBaseUrl = 'http://localhost:3000';
const defaultUserAgent = 'amail/1.0.0';

export interface AmailOptions {
  baseUrl?: string;
  userAgent?: string;
  providerId?: string;
}

export class Amail {
  readonly baseUrl: string;
  readonly userAgent: string;
  readonly providerId?: string;
  private readonly headers: Headers;

  readonly emails: Emails;
  readonly batch: Batch;

  constructor(
    readonly key?: string,
    options?: AmailOptions,
  ) {
    if (!key) {
      if (typeof process !== 'undefined' && process.env) {
        this.key = process.env.AMAIL_API_KEY;
      }

      if (!this.key) {
        throw new Error(
          'Missing API key. Pass it to the constructor `new Amail("am_123")`',
        );
      }
    }

    this.baseUrl =
      options?.baseUrl ??
      (typeof process !== 'undefined' && process.env
        ? process.env.AMAIL_BASE_URL || defaultBaseUrl
        : defaultBaseUrl);
    this.userAgent =
      options?.userAgent ??
      (typeof process !== 'undefined' && process.env
        ? process.env.AMAIL_USER_AGENT || defaultUserAgent
        : defaultUserAgent);
    this.providerId =
      options?.providerId ??
      (typeof process !== 'undefined' && process.env
        ? process.env.AMAIL_PROVIDER_ID
        : undefined);

    this.headers = new Headers({
      Authorization: `Bearer ${this.key}`,
      'User-Agent': this.userAgent,
      'Content-Type': 'application/json',
    });

    this.emails = new Emails(this);
    this.batch = new Batch(this);
  }

  async fetchRequest<T>(path: string, options: RequestInit = {}): Promise<Response<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, options);

      if (!response.ok) {
        try {
          const rawError = await response.text();
          return {
            data: null,
            error: JSON.parse(rawError),
            headers: Object.fromEntries(response.headers.entries()),
          };
        } catch (err) {
          if (err instanceof SyntaxError) {
            return {
              data: null,
              error: {
                name: 'application_error',
                statusCode: response.status,
                message: 'Internal server error.',
              },
              headers: Object.fromEntries(response.headers.entries()),
            };
          }

          const error: ErrorResponse = {
            message: response.statusText,
            statusCode: response.status,
            name: 'application_error',
          };

          if (err instanceof Error) {
            return {
              data: null,
              error: { ...error, message: err.message },
              headers: Object.fromEntries(response.headers.entries()),
            };
          }

          return {
            data: null,
            error,
            headers: Object.fromEntries(response.headers.entries()),
          };
        }
      }

      const data = await response.json();
      return {
        data,
        error: null,
        headers: Object.fromEntries(response.headers.entries()),
      };
    } catch {
      return {
        data: null,
        error: {
          name: 'application_error',
          statusCode: null,
          message: 'Unable to fetch data. The request could not be resolved.',
        },
        headers: null,
      };
    }
  }

  async post<T>(
    path: string,
    entity?: unknown,
    options: { headers?: HeadersInit; idempotencyKey?: string } = {},
  ) {
    const headers = new Headers(this.headers);

    if (options.headers) {
      for (const [key, value] of new Headers(options.headers).entries()) {
        headers.set(key, value);
      }
    }
    if (options.idempotencyKey) {
      headers.set('Idempotency-Key', options.idempotencyKey);
    }

    return this.fetchRequest<T>(path, {
      method: 'POST',
      body: JSON.stringify(entity),
      headers,
    });
  }

  async get<T>(path: string, options: { headers?: HeadersInit } = {}) {
    const headers = new Headers(this.headers);
    if (options.headers) {
      for (const [key, value] of new Headers(options.headers).entries()) {
        headers.set(key, value);
      }
    }

    return this.fetchRequest<T>(path, {
      method: 'GET',
      headers,
    });
  }

  async delete<T>(path: string, options: { headers?: HeadersInit } = {}) {
    const headers = new Headers(this.headers);
    if (options.headers) {
      for (const [key, value] of new Headers(options.headers).entries()) {
        headers.set(key, value);
      }
    }

    return this.fetchRequest<T>(path, {
      method: 'DELETE',
      headers,
    });
  }
}
