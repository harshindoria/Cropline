import { isAxiosError } from "axios";

// What the backend sends in an error response.
export type ApiErrorBody = { message?: string; error?: string; code?: string; [key: string]: unknown };

export const apiErrorBody = (err: unknown): ApiErrorBody =>
  (isAxiosError<ApiErrorBody>(err) && err.response?.data) || {};

export const apiErrorStatus = (err: unknown): number | undefined =>
  isAxiosError(err) ? err.response?.status : undefined;

// The backend's message for a failed request, or the fallback if there is none.
export const apiErrorMessage = (err: unknown, fallback: string): string => {
  const body = apiErrorBody(err);
  return body.message || body.error || fallback;
};
