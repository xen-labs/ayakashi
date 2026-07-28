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
// - On 401 invalid_token / unauthenticated, refreshes once and retries
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
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (res.ok) {
    if (res.status === 204) return {} as T;
    return res.json() as Promise<T>;
  }

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

  const isRecoverable =
    res.status === 401 &&
    (apiErr.code === "invalid_token" || apiErr.code === "unauthenticated");

  if (isRecoverable && !_isRetry) {
    try {
      await apiFetch("/auth/refresh", { method: "POST" }, true);
      return apiFetch<T>(path, init, true);
    } catch {
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

// ── Dashboard ──────────────────────────────────────────────────────
// Matches the actual /dashboard response shape from ayakashi-core:
//   identity, currency, vault (nullable), progression, dailyClaim,
//   cardsOwned, recentTransactions, pendingFriendRequests

export interface DashboardVault {
  tier: number;
  ryo: number;
  kitsu: number;
  ryoCap: number;
  kitsuCap: number;
  health: number;
  maxHealth: number;
  repairCost: {
    pointsToRepair: number;
    ryo: number;
    material: string;
    materialQty: number;
  } | null;
}

export interface DashboardTransaction {
  currency: "ryo" | "kitsu";
  location: string;
  amount: number;
  balanceAfter: number;
  reason: string;
  createdAt: string;
}

export interface DashboardFriendRequest {
  jid: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
}

export interface DashboardResponse {
  identity: {
    username: string;
    displayName: string;
    memberSince: string;
  };
  currency: {
    ryo: number;
    kitsu: number;
    bank: number;
    bankCap: number;
    bankVaultTier: number;
  };
  vault: DashboardVault | null;
  progression: {
    xp: number;
    level: number;
  };
  dailyClaim: {
    available: boolean;
    remainingMs: number;
    currentStreak: number;
    streakWillContinueIfClaimedNow: boolean;
  };
  cardsOwned: number;
  recentTransactions: DashboardTransaction[];
  pendingFriendRequests: {
    count: number;
    requests: DashboardFriendRequest[];
  };
}

export const getDashboard = () => apiFetch<DashboardResponse>("/dashboard");

// ── Shop ───────────────────────────────────────────────────────────
// GET /shop?section=items|rob_gear|defence_gear
// POST /shop/buy { itemId, currency?, quantity }

export type ShopSection = "items" | "rob_gear" | "defence_gear";
export type RobItemCategory = "rob" | "bag" | "vault-breach" | "intel" | "defense";

export interface ShopListing {
  itemId: string;
  name: string;
  emoji: string;
  webappImage: string;
  flavor: string;
  section: ShopSection;
  robCategory?: RobItemCategory;
  price: number;
  currency: "ryo" | "kitsu";
  durability?: "shatter-on-fail" | "single-use" | "charges" | "permanent";
  maxCharges?: number;
  priceIsPlaceholder?: true;
}

export interface ShopListingsResponse {
  listings: ShopListing[];
}

export const getShopListings = (section?: ShopSection) =>
  apiFetch<ShopListingsResponse>(
    section ? `/shop?section=${section}` : "/shop",
  );

export interface BuyItemPayload {
  itemId: string;
  currency?: "ryo" | "kitsu";
  quantity?: number;
}
export interface BuyItemResponse {
  itemId: string;
  quantity: number;
  spent: number;
  currency: "ryo" | "kitsu";
}
export const buyItem = (body: BuyItemPayload) =>
  apiFetch<BuyItemResponse>("/shop/buy", {
    method: "POST",
    body: JSON.stringify(body),
  });

// ── Inventory ─────────────────────────────────────────────────────
// GET /inventory — non-card inventory items
// POST /inventory/sell { itemId, quantity }

export type ItemCategory =
  | "tool"
  | "material"
  | "consumable"
  | "rob_gear"
  | "vault_upgrade"
  | "misc";

export interface InventoryItem {
  itemId: string;
  quantity: number;
  category: ItemCategory;
  name: string;
  emoji: string;
  rarity?: "common" | "uncommon" | "rare" | "epic" | "legendary";
  webappImage: string;
  flavor: string;
  sellPrice?: number;       // materials only
  durability?: "shatter-on-fail" | "single-use" | "charges" | "permanent";
  maxCharges?: number;
  toolLevel?: number;
  nextLevelCost?: { materialQty: number; ryo: number } | null;
}

export interface InventoryResponse {
  items: InventoryItem[];
  ownedItemIds: string[];
}
export const getInventory = () => apiFetch<InventoryResponse>("/inventory");

export interface SellItemPayload {
  itemId: string;
  quantity: number;
}
export interface SellItemResponse {
  itemId: string;
  quantitySold: number;
  ryoEarned: number;
}
export const sellItem = (body: SellItemPayload) =>
  apiFetch<SellItemResponse>("/inventory/sell", {
    method: "POST",
    body: JSON.stringify(body),
  });

// ── Inventory — cards ──────────────────────────────────────────────
// GET /inventory/cards?page=&rarity=&series=&listed=&sort=

export interface CardInstance {
  instanceId: string;
  issueNumber: number;
  listing: unknown | null;
  isLocked: boolean;
  card: {
    _id: string;
    name: string;
    rarity: "C" | "R" | "SR" | "SSR" | "UR";
    seriesName: string;
    mediaUrl: string;
  } | null;
}

export interface InventoryCardsResponse {
  page: number;
  totalPages: number;
  total: number;
  items: CardInstance[];
}

export const getInventoryCards = (params?: {
  page?: number;
  rarity?: string;
  series?: string;
  listed?: "true" | "false";
  sort?: "newest" | "rarity" | "name";
}) => {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.rarity) qs.set("rarity", params.rarity);
  if (params?.series) qs.set("series", params.series);
  if (params?.listed) qs.set("listed", params.listed);
  if (params?.sort) qs.set("sort", params.sort);
  const query = qs.toString();
  return apiFetch<InventoryCardsResponse>(
    `/inventory/cards${query ? `?${query}` : ""}`,
  );
};
