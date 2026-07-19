// ── Base URL ──────────────────────────────────────
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

  // Token refresh — one retry only, no loop.
  // Both codes mean "no usable access token right now, but a valid
  // refresh token might still fix it": invalid_token fires when a
  // present-but-expired/corrupt token fails verification; unauthenticated
  // fires when the access cookie is simply gone (the common case, since
  // its own Max-Age is just 15 minutes — it's usually deleted by the
  // browser long before the refresh token is). Previously only
  // invalid_token triggered a refresh attempt, so unauthenticated always
  // fell straight through to a redirect-to-login, even with a fully valid
  // refresh token still active for up to a day.
  const isRecoverable =
    res.status === 401 &&
    (apiErr.code === "invalid_token" || apiErr.code === "unauthenticated");

  if (isRecoverable && !_isRetry) {
    try {
      await apiFetch("/auth/refresh", { method: "POST" }, true);
      return apiFetch<T>(path, init, true);
    } catch (refreshErr) {
      // TEMP DEBUG — remove once the 10-15min logout cause is confirmed.
      // eslint-disable-next-line no-console
      console.error("[apiFetch] refresh attempt failed:", refreshErr);
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
  welcomeBonus: { ryo: number; kitsu: number } | null;
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

// ── Material Shop ──────────────────────────────────────────────────
export interface MaterialShopItem {
  materialId: string;
  name: string;
  emoji: string;
  sellPrice: number;
  buyPriceRyo: number;
  buyPriceKitsu: number;
  remaining: number;
  globalDailyStock: number;
  perPlayerDailyCap: number;
}
export interface MaterialShopResponse {
  day: string;
  items: MaterialShopItem[];
}
export const getMaterialShop = () =>
  apiFetch<MaterialShopResponse>("/shop/materials");

export interface MyMaterialPurchasesResponse {
  day: string;
  purchases: Record<string, number>;
}
export const getMyMaterialPurchases = () =>
  apiFetch<MyMaterialPurchasesResponse>("/shop/materials/my-purchases");

export interface BuyMaterialPayload {
  materialId: string;
  quantity: number;
  currency: "ryo" | "kitsu";
}
export interface BuyMaterialResponse {
  materialId: string;
  quantity: number;
  currency: "ryo" | "kitsu";
  totalCost: number;
  newBalance: number;
}
export const buyMaterial = (body: BuyMaterialPayload) =>
  apiFetch<BuyMaterialResponse>("/shop/materials/buy", {
    method: "POST",
    body: JSON.stringify(body),
  });

// ── Rob Item Shop ──────────────────────────────────────────────────
export interface RobShopItem {
  itemId: string;
  name: string;
  emoji: string;
  category: string;
  price: number;
  currency: "ryo" | "kitsu";
  durability: "permanent" | "charges" | "consumable" | string;
  maxCharges?: number;
  description: string;
}
export interface RobShopResponse {
  items: RobShopItem[];
}
export const getRobItemShop = () =>
  apiFetch<RobShopResponse>("/shop/rob-items");

export interface BuyRobItemPayload {
  itemId: string;
  quantity: number;
}
export interface BuyRobItemResponse {
  itemId: string;
  quantity: number;
  unitsCredited: number;
  currency: "ryo" | "kitsu";
  totalCost: number;
  newBalance: number;
}
export const buyRobItem = (body: BuyRobItemPayload) =>
  apiFetch<BuyRobItemResponse>("/shop/rob-items/buy", {
    method: "POST",
    body: JSON.stringify(body),
  });

// ── Inventory ─────────────────────────────────────────────────────
export interface InventoryItem {
  itemId: string;
  quantity: number;
  kind: "material" | "rob-item" | "unknown";
  name: string;
  emoji: string;
  durability?: string;
}
export interface InventoryResponse {
  items: InventoryItem[];
  ownedItemIds: string[];
}
export const getInventory = () => apiFetch<InventoryResponse>("/inventory");
