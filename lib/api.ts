// ── Base URL ───────────────────────────────────────────────────────
// In dev, proxy to localhost:4000. In prod, set NEXT_PUBLIC_API_URL in your
// Vercel env vars to your Railway URL (e.g. https://astral-api-production.up.railway.app)
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ── Error shape returned by the API ───────────────────────────────
export interface ApiError {
  code: string;
  message: string;
  issues?: { path: string[]; message: string }[]; // validation_error only
}

export class ApiResponseError extends Error {
  constructor(
    public readonly status: number,
    public readonly error: ApiError,
  ) {
    super(error.message);
    this.name = "ApiResponseError";
  }
}

// ── Core fetch wrapper ────────────────────────────────────────────
// - Always sends credentials (httpOnly cookie auth)
// - Parses the standard { error: { code, message } } error shape
// - On 401 invalid_token, refreshes once and retries the original request
// - If refresh also fails, throws so callers can redirect to /login
async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  _isRetry = false,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (res.ok) {
    // 204 No Content → return empty object
    if (res.status === 204) return {} as T;
    return res.json() as Promise<T>;
  }

  // Parse error body
  let errorBody: { error: ApiError };
  try {
    errorBody = await res.json();
  } catch {
    throw new ApiResponseError(res.status, {
      code: "network_error",
      message: `HTTP ${res.status}`,
    });
  }

  const apiErr = errorBody?.error ?? {
    code: "unknown_error",
    message: "Something went wrong.",
  };

  // Token refresh — one retry only, no loop
  if (res.status === 401 && apiErr.code === "invalid_token" && !_isRetry) {
    try {
      await apiFetch("/auth/refresh", { method: "POST" }, true);
      return apiFetch<T>(path, init, true);
    } catch {
      // Refresh failed → caller should redirect to /login
      throw new ApiResponseError(401, {
        code: "session_expired",
        message: "Your session expired. Please log in again.",
      });
    }
  }

  throw new ApiResponseError(res.status, apiErr);
}

// ── Auth endpoints ─────────────────────────────────────────────────

export interface RegisterPayload {
  token: string;
  username: string;
  password: string;
  age: number;
  deviceFingerprint?: string;
}
export interface RegisterResponse {
  username: string;
  displayName: string;
  age: number;
}
export const authRegister = (body: RegisterPayload) =>
  apiFetch<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });

export interface LoginPayload {
  username: string;
  password: string;
  rememberMe: boolean;
}
export interface LoginResponse {
  username: string;
  displayName: string;
}
export const authLogin = (body: LoginPayload) =>
  apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });

// ── Username availability ──────────────────────────────────────────
export interface UsernameAvailableResponse {
  available: true;
}
export interface UsernameTakenResponse {
  available: false;
  suggestions: string[];
}
export type UsernameCheckResponse =
  | UsernameAvailableResponse
  | UsernameTakenResponse;

export const checkUsernameAvailable = (username: string) =>
  apiFetch<UsernameCheckResponse>(
    `/auth/username-available?username=${encodeURIComponent(username)}`,
  );

// ── Password reset ─────────────────────────────────────────────────

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}
export const authResetPassword = (body: ResetPasswordPayload) =>
  apiFetch<{ ok: boolean }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(body),
  });

// ── Current user ───────────────────────────────────────────────────

export interface MeResponse {
  username: string;
  displayName: string;
  age: number;
}
export const getMe = () => apiFetch<MeResponse>("/me");

export const authLogout = () =>
  apiFetch<void>("/auth/logout", { method: "POST" });

export interface DashboardResponse {
  username: string;
  displayName: string;
  ryo: number;
  kitsu: number;
  bank: number;
  homeVaultRyo: number;
  homeVaultKitsu: number;
  pocketTier: number;
  bankVaultTier: number;
  dailyStreak: number;
  memberSince: string;
}
export const getDashboard = () => apiFetch<DashboardResponse>("/dashboard");
