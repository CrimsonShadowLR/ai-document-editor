import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
});

/** Shape of FastAPI error bodies (`HTTPException(detail=...)`). */
export interface HttpErrorResponse {
  detail?: string | { msg: string; loc: (string | number)[] }[];
}

/** Best-effort human message from an axios/FastAPI error. */
export function errorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (axios.isAxiosError<HttpErrorResponse>(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length > 0) return detail[0].msg;
  }
  return fallback;
}

export type QueryParams = Record<string, string | number | boolean | undefined>;

export async function get<T>(url: string, params?: QueryParams): Promise<T> {
  const { data } = await client.get<T>(url, { params });
  return data;
}

/** `signal` lets the caller abort the request (e.g. the user cancels). */
export async function post<T, B = unknown>(url: string, body: B, signal?: AbortSignal): Promise<T> {
  const { data } = await client.post<T>(url, body, { signal });
  return data;
}
