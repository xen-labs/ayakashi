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
        public readonly error: ApiError
    ) {
        super(error.message);
        this.name = "ApiResponseError";
    }
}

// ── Core fetch wrapper ────────────────────────────────────────────

let refreshPromise: Promise<void> | null = null;

async function apiFetch<T>(
    path: string,
    init: RequestInit = {},
    _isRetry = false
): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        ...init,
        credentials: "include",
        headers: {
            ...(init.body ? { "Content-Type": "application/json" } : {}),
            ...(init.headers ?? {})
        }
    });

    if (res.ok) {
        if (res.status === 204) return {} as T;
        return res.json() as Promise<T>;
    }

    let errorBody: { error?: ApiError } | null = null;
    try {
        errorBody = await res.json();
    } catch {}

    const apiErr = errorBody?.error ?? {
        code: "unknown_error",
        message: `HTTP ${res.status}`
    };
    const isRecoverable = res.status === 401;

    if (isRecoverable && !_isRetry) {
        try {
            if (!refreshPromise) {
                refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
                    method: "POST",
                    credentials: "include"
                })
                    .then(refreshRes => {
                        if (!refreshRes.ok) throw new Error("Refresh failed");
                    })
                    .finally(() => {
                        refreshPromise = null;
                    });
            }

            await refreshPromise;

            return apiFetch<T>(path, init, true);
        } catch {
            // If the refresh token is truly expired, throw the session_expired error
            throw new ApiResponseError(401, {
                code: "session_expired",
                message: "Your session expired. Please log in again."
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
        body: JSON.stringify(body)
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
        body: JSON.stringify(body)
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
        `/auth/username-available?username=${encodeURIComponent(username)}`
    );

// ── Password reset ─────────────────────────────────────────────────
export interface ResetPasswordPayload {
    token: string;
    newPassword: string;
}
export const authResetPassword = (body: ResetPasswordPayload) =>
    apiFetch<{ ok: boolean }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(body)
    });

// ── Current user ───────────────────────────────────────────────────
export interface MeResponse {
    username: string;
    displayName: string;
    age: number;
    avatarUrl: string | null;
    frameId: string | null;
    frameUrl: string | null;
    frameIsAnimated: boolean;
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
    /** Human-readable label generated by the backend's describeTransaction() */
    description: string;
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
    transactions: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
        items: DashboardTransaction[];
    };
    pendingFriendRequests: {
        count: number;
        requests: DashboardFriendRequest[];
    };
}

export const getDashboard = (transactionsPage?: number) =>
    apiFetch<DashboardResponse>(
        transactionsPage && transactionsPage > 1
            ? `/dashboard?transactionsPage=${transactionsPage}`
            : "/dashboard"
    );

export interface ClaimDailyResponse {
    ok: boolean;
    remainingMs: number;
    ryo: number;
    kitsu: number;
    bonusRyo: number;
    bonusKitsu: number;
    streak: number;
    streakBroken: boolean;
    milestoneLabel: string | null;
}

export const claimDailyReward = () =>
    apiFetch<ClaimDailyResponse>("/dashboard/claim-daily", { method: "POST" });

// ── Shop ───────────────────────────────────────────────────────────
// GET /shop?section=items|rob_gear|defence_gear
// POST /shop/buy { itemId, currency?, quantity }

export type ShopSection =
    | "items"
    | "rob_gear"
    | "defence_gear"
    | "cosmetics"
    | "hunting"
    | "farming"
    | "cooking";
export type RobItemCategory =
    | "rob"
    | "bag"
    | "vault-breach"
    | "intel"
    | "defense";

export interface ShopListing {
    itemId: string;
    name: string;
    emoji: string;
    webappImage: string;
    flavor: string;
    section: ShopSection;
    robCategory?: RobItemCategory;
    rarity?: "common" | "uncommon" | "rare" | "epic" | "legendary";
    price: number;
    currency: "ryo" | "kitsu";
    durability?: "shatter-on-fail" | "single-use" | "charges" | "permanent";
    maxCharges?: number;
    priceIsPlaceholder?: true;
    noConversion?: true;
    minLevel?: number;
    kind?: "item" | "frame";
}

export interface ShopListingsResponse {
    listings: ShopListing[];
}

export const getShopListings = (section?: ShopSection) =>
    apiFetch<ShopListingsResponse>(
        section ? `/shop?section=${section}` : "/shop"
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
        body: JSON.stringify(body)
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
    | "cosmetic_pass"
    | "hunting_gear"
    | "farming_gear"
    | "cooking_gear"
    | "food"
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
    durability?: "shatter-on-fail" | "single-use" | "charges" | "permanent";
    maxCharges?: number;
    toolLevel?: number;
    nextLevelCost?: { materialQty: number; ryo: number } | null;
}

export interface OwnedFrameItem {
    frameId: string;
    name: string;
    frameUrl: string;
    isAnimated: boolean;
    isEquipped: boolean;
}

export interface InventoryCosmeticUpload {
    uploadId: string;
    slot: "avatar" | "banner" | "deckBackground";
    kind: "static" | "animated";
    url: string;
    createdAt: string;
    isEquipped: boolean;
}

export interface DeckBackgroundGroup {
    slotIndex: number;
    uploads: InventoryCosmeticUpload[];
}

export interface InventoryCosmetics {
    frames: OwnedFrameItem[];
    avatars: InventoryCosmeticUpload[];
    banners: InventoryCosmeticUpload[];
    deckBackgrounds: DeckBackgroundGroup[];
}

export interface InventoryResponse {
    items: InventoryItem[];
    ownedItemIds: string[];
    cosmetics: InventoryCosmetics;
}
export const getInventory = () => apiFetch<InventoryResponse>("/inventory");

// Note: /inventory/sell was removed backend-side — flat material selling
// paid out NaN (sellPrice never existed on ALL_MATERIALS) and has been
// superseded by dedicated per-material commands (.crack/.refine/etc.)
// in-bot. Do not reintroduce a sell button/route here.

// ── Inventory — cards ──────────────────────────────────────────────
// GET /inventory/cards?page=&rarity=&series=&listed=&sort=

export interface CardInstance {
    instanceId: string;
    issueNumber: number;
    listing: unknown | null;
    isLocked: boolean;
    pendingTradeId: string | null;
    activeLoanId: string | null;
    card: {
        _id: string;
        name: string;
        rarity: "C" | "R" | "SR" | "SSR" | "UR";
        seriesName: string;
        mediaUrl: string;
        fileExtension: CardFileExtension;
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
    q?: string;
    listed?: "true" | "false";
    sort?: "newest" | "rarity" | "name";
}) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.rarity) qs.set("rarity", params.rarity);
    if (params?.series) qs.set("series", params.series);
    if (params?.q) qs.set("q", params.q);
    if (params?.listed) qs.set("listed", params.listed);
    if (params?.sort) qs.set("sort", params.sort);
    const query = qs.toString();
    return apiFetch<InventoryCardsResponse>(
        `/inventory/cards${query ? `?${query}` : ""}`
    );
};

// ── Upgrades ──────────────────────────────────────────────────────

export interface ToolStatus {
    tool: "gear_shovel" | "gear_fishing_rod" | "gear_pickaxe";
    name: string;
    emoji: string;
    webappImage?: string;
    level: 0 | 1 | 2 | 3;
    atMax: boolean;
    nextLevelCost: {
        ryo: number;
        materialQty: number;
        material: string;
        /** Resolved display name for `material` — was previously absent, forcing the frontend to render the raw itemId. */
        materialName: string;
        materialEmoji: string;
        materialWebappImage?: string;
        extra:
            | {
                  itemId: string;
                  qty: number;
                  name: string;
                  emoji: string;
                  webappImage?: string;
              }[]
            | null;
    } | null;
    craftRecipeId: string | null;
}

export interface UpgradeToolsResponse {
    hasCraftingTable: boolean;
    tools: ToolStatus[];
}

export const getUpgradeTools = () =>
    apiFetch<UpgradeToolsResponse>("/upgrade/tools");

export interface UpgradeBankResponse {
    tier: number;
    cap: number;
}
export const upgradeBank = () =>
    apiFetch<UpgradeBankResponse>("/upgrade/bank", { method: "POST" });

export interface UpgradeVaultResponse {
    tier: number;
    caps: { ryo: number; kitsu: number };
}
export const upgradeVault = () =>
    apiFetch<UpgradeVaultResponse>("/upgrade/vault", { method: "POST" });

export interface RepairVaultResponse {
    pointsRepaired: number;
}
export const repairVault = () =>
    apiFetch<RepairVaultResponse>("/upgrade/vault/repair", { method: "POST" });

export interface UpgradeToolResponse {
    tool: string;
    newLevel: number;
}
export const upgradeTool = (tool: string) =>
    apiFetch<UpgradeToolResponse>("/upgrade/tool", {
        method: "POST",
        body: JSON.stringify({ tool })
    });

// ── Leaderboard ───────────────────────────────────────────────────

export type LeaderboardMetric = "xp" | "ryo" | "kitsu" | "cards";

export interface LeaderboardRow {
    rank: number;
    jid: string;
    username: string | null;
    displayName: string;
    avatarUrl: string | null;
    frameUrl: string | null;
    frameIsAnimated: boolean;
    value: number;
    level?: number;
}

export interface LeaderboardResponse {
    metric: LeaderboardMetric;
    page: number;
    totalPages: number;
    total: number;
    items: LeaderboardRow[];
}

export const getLeaderboard = (metric: LeaderboardMetric, page = 1) =>
    apiFetch<LeaderboardResponse>(`/leaderboard?metric=${metric}&page=${page}`);

// ── Settings ──────────────────────────────────────────────────────
// GET  /settings/profile
// PATCH /settings/profile { displayName?, bio? }

export interface SettingsProfileResponse {
    displayName: string;
    bio: string | null;
    displayNameCooldown: {
        canChangeNow: boolean;
        daysRemaining: number;
        cooldownDays: number;
    };
    limits: {
        displayName: { min: number; max: number };
        bio: { max: number };
    };
}

export const getSettingsProfile = () =>
    apiFetch<SettingsProfileResponse>("/settings/profile");

export interface PatchSettingsPayload {
    displayName?: string;
    bio?: string;
}
export interface PatchSettingsResponse {
    displayName?: string;
    bio?: string;
}
export const patchSettingsProfile = (body: PatchSettingsPayload) =>
    apiFetch<PatchSettingsResponse>("/settings/profile", {
        method: "PATCH",
        body: JSON.stringify(body)
    });

// ── Profile ───────────────────────────────────────────────────────
// GET  /profile/:username?cardsPage=&cardsSort=
// POST /profile/:username/like

export type CardRarity = "C" | "R" | "SR" | "SSR" | "UR";
export type CardFileExtension =
    | "png"
    | "gif"
    | "webp"
    | "webm"
    | "jpg"
    | "jpeg";

export interface ProfileCardItem {
    instanceId: string;
    issueNumber: number;
    shortId: string;
    name: string;
    seriesName: string | null;
    rarity: CardRarity;
    isEvent: boolean;
    eventName: string | null;
    thumbUrl: string;
    mediaType: string;
    fileExtension: CardFileExtension;
    ownerCount: number;
    wishlistCount: number;
    totalIssued: number;
}

export type DeckSlotState = "active" | "empty" | "locked";

export interface DeckSlotCard {
    instanceId: string;
    name: string;
    rarity: string;
    thumbUrl: string;
    mediaType: string;
}

export interface DeckSlot {
    slotIndex: number;
    state: DeckSlotState;
    deckName?: string;
    backgroundUrl?: string | null;
    filledSlotCount?: number;
    slots?: (string | null)[];
    resolvedSlots?: (DeckSlotCard | null)[];
}

export type FriendStatus =
    | "none"
    | "friends"
    | "request_sent"
    | "request_received";

export interface ProfileResponse {
    identity: {
        username: string;
        displayName: string;
        age: number;
        bio: string | null;
        avatarUrl: string | null;
        bannerUrl: string | null;
        frameUrl: string | null;
        level: number;
        xp: number;
        joinedAt: string;
        likeCount: number;
        isLikedByViewer: boolean;
        friendStatus: FriendStatus;
        isOwnProfile: boolean;
        // Only present when isOwnProfile is true
        avatarPassCount?: number;
        bannerPassCount?: number;
        avatarBanked?: boolean;
        bannerBanked?: boolean;
    };
    deck: {
        slots: DeckSlot[];
        unlockedCount: number;
        maxDecks: number;
        deckSize: number;
        deckPassItemId?: "deck_pass";
    };
    cards:
        | { hidden: true }
        | {
              hidden: false;
              page: number;
              pageSize: number;
              totalPages: number;
              totalCount: number;
              results: ProfileCardItem[];
          };
    friends:
        | { hidden: true }
        | {
              hidden: false;
              // Real display objects — see profile.ts's resolvePendingRequesters,
              // reused here. Safe to link/render directly, no separate lookup needed.
              friends: {
                  username: string;
                  displayName: string;
                  avatarUrl: string | null;
              }[];
              // Only present on isOwnProfile.
              pendingReceived?: {
                  username: string;
                  displayName: string;
                  avatarUrl: string | null;
              }[];
          };
}

export const getProfile = (
    username: string,
    params?: {
        cardsPage?: number;
        cardsSort?: "newest" | "rarity" | "name";
        cardsQ?: string;
    }
) => {
    // NOTE: backend (routes/profile.ts) forwards req.query straight into
    // getOwnedCards() untouched, which expects OwnedCardsQuery's actual
    // field names — q/sort/page, NOT cardsQ/cardsSort/cardsPage. The
    // "cards"-prefixed param names here are this function's OWN external
    // API (kept prefixed so callers can tell at a glance these are
    // profile-cards-section params, not some other section's), remapped
    // to the real backend names right here at the request boundary. Do
    // not rename these query keys to match params 1:1 — sending cardsPage
    // literally as "cardsPage" is a no-op server-side (Fastify silently
    // ignores unknown query keys, getOwnedCards falls back to page 1) —
    // this was the actual pagination/search bug fixed here.
    const qs = new URLSearchParams();
    if (params?.cardsPage) qs.set("page", String(params.cardsPage));
    if (params?.cardsSort) qs.set("sort", params.cardsSort);
    if (params?.cardsQ) qs.set("q", params.cardsQ);
    const q = qs.toString();
    return apiFetch<ProfileResponse>(
        `/profile/${encodeURIComponent(username)}${q ? `?${q}` : ""}`
    );
};

export interface LikeProfileResponse {
    liked: boolean;
    likeCount: number;
}
export const likeProfile = (username: string) =>
    apiFetch<LikeProfileResponse>(
        `/profile/${encodeURIComponent(username)}/like`,
        {
            method: "POST"
        }
    );

export interface FriendActionResponse {
    status?: "pending" | "accepted";
    friendStatus: FriendStatus;
}
export const sendFriendRequest = (username: string) =>
    apiFetch<FriendActionResponse>(
        `/profile/${encodeURIComponent(username)}/friend-request`,
        {
            method: "POST"
        }
    );
export const acceptFriendRequest = (username: string) =>
    apiFetch<FriendActionResponse>(
        `/profile/${encodeURIComponent(username)}/friend-accept`,
        {
            method: "POST"
        }
    );
export const removeFriend = (username: string) =>
    apiFetch<{ removed: boolean; friendStatus: FriendStatus }>(
        `/profile/${encodeURIComponent(username)}/friend-remove`,
        {
            method: "POST"
        }
    );

// ── Craft ─────────────────────────────────────────────────────────
// GET  /craft/recipes
// POST /craft { recipeId }

export interface CraftInput {
    itemId: string;
    displayName: string;
    emoji: string;
    webappImage?: string;
    rarity?: "common" | "uncommon" | "rare" | "epic" | "legendary";
    qty: number;
    have: number;
}

export type CraftOutput =
    | { type: "item"; itemId: string; amount: number }
    | { type: "kitsu"; amount: number }
    | { type: "kitsu"; min: number; max: number; bulkBonusPerCore?: number };

export interface CraftRecipe {
    recipeId: string;
    name: string;
    emoji: string;
    /** Ritual-specific art (the 5 Kitsu rituals) — distinct from outputWebappImage, which is the output ITEM's art and only set for item-type outputs. */
    webappImage?: string;
    description: string;
    inputs: CraftInput[];
    output: CraftOutput;
    /** Display name for item-type outputs, absent for kitsu outputs */
    outputDisplayName?: string;
    outputEmoji?: string;
    outputWebappImage?: string;
    outputRarity?: "common" | "uncommon" | "rare" | "epic" | "legendary";
    successRate: number;
    ryoCost: number;
    alreadyOwnsTool: boolean;
    canAfford: boolean;
}

export interface CraftRecipesResponse {
    hasCraftingTable: boolean;
    recipes: CraftRecipe[];
}

export const getCraftRecipes = () =>
    apiFetch<CraftRecipesResponse>("/craft/recipes");

/** One recipe execution's outcome inside a bulk (`qty` > 1) craft. */
export interface CraftRoll {
    success: boolean;
    amount?: number;
}

export interface CraftResponse {
    recipeId: string;
    success: boolean;
    output?: {
        type: "item" | "kitsu";
        itemId?: string;
        displayName?: string;
        amount: number;
    };
    message?: string;
    /** Present only when the request specified qty > 1. */
    qty?: number;
    successCount?: number;
    failCount?: number;
    rolls?: CraftRoll[];
}

/**
 * Executes a craft recipe. `qty` (default 1, server-capped at 20) runs
 * the recipe that many times in one request — one materials pull, one
 * ryo charge, one independent success roll per unit. Omit `qty` (or pass
 * 1) for the original single-craft response shape.
 */
export const executeCraft = (recipeId: string, qty = 1) =>
    apiFetch<CraftResponse>("/craft", {
        method: "POST",
        body: JSON.stringify(qty > 1 ? { recipeId, qty } : { recipeId })
    });

// ── Bank & Vault ──────────────────────────────────────────────────
// GET /bank-vault?page=N — matches routes/bankVault.ts exactly.
// POST /bank/claim — claims interest previewed by bank.interestClaim
// below; see routes/bank.ts. Deposit/withdraw/open live in bank.ts too
// but aren't wired into the Bank & Vault page (not part of this pass).
export interface BankVaultTransaction {
    id: string;
    action: string;
    description: string;
    currency: "ryo" | "kitsu";
    location: string;
    amount: number;
    balanceAfter: number;
    itemId: string | null;
    meta: Record<string, unknown> | null;
    createdAt: string;
}

export interface BankVaultResponse {
    balances: {
        pocketRyo: number;
        pocketKitsu: number;
    };
    bank: {
        balance: number;
        cap: number;
        tier: number;
        maxTier: number;
        isMaxTier: boolean;
        nextTierCost: number | null;
        interestClaim: {
            available: boolean;
            remainingMs: number;
            ratePercent: number;
            projectedAmount: number;
        };
    };
    homeVault:
        | {
              owned: true;
              tier: number;
              maxTier: number;
              isMaxTier: boolean;
              nextTierCost: number | null;
              caps: { ryo: number; kitsu: number };
              balances: { ryo: number; kitsu: number };
              health: { current: number; max: number; maxAtTier: number };
              vulnerabilityBonusPercent: number;
              repair:
                  | {
                        needed: true;
                        pointsToRepair: number;
                        ryoCost: number;
                        material: {
                            itemId: string;
                            quantity: number;
                            displayName: string;
                            emoji: string;
                        };
                    }
                  | { needed: false };
          }
        | {
              owned: false;
              purchaseInfo: {
                  itemId: string;
                  price: number;
                  currency: "ryo" | "kitsu";
                  description: string;
              };
          };
    transactions: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
        items: BankVaultTransaction[];
    };
}

export const getBankVault = (page = 1) =>
    apiFetch<BankVaultResponse>(`/bank-vault?page=${page}`);

export interface OpenBankResponse {
    tier: number;
    tierName: string;
}
export const openBankAccount = () =>
    apiFetch<OpenBankResponse>("/bank/open", { method: "POST" });

export interface BankDepositResponse {
    tier: number;
    cap: number;
}
export const depositBank = (amount: number) =>
    apiFetch<BankDepositResponse>("/bank/deposit", {
        method: "POST",
        body: JSON.stringify({ amount })
    });

export interface BankWithdrawResponse {
    withdrawn: number;
}
export const withdrawBank = (amount: number) =>
    apiFetch<BankWithdrawResponse>("/bank/withdraw", {
        method: "POST",
        body: JSON.stringify({ amount })
    });

export interface ClaimBankInterestResponse {
    tier: number;
    amount: number;
    newBalance: number;
}
export const claimBankInterest = () =>
    apiFetch<ClaimBankInterestResponse>("/bank/claim", { method: "POST" });

// ── Decks ─────────────────────────────────────────────────────────
// GET    /decks
// POST   /decks/:slotIndex              { deckName? }
// POST   /decks/:slotIndex/cards        { position, cardInstanceId }
// DELETE /decks/:slotIndex
// DELETE /decks/:slotIndex/cards/:position

export interface DeckManageSlot {
    slotIndex: number;
    state: "active" | "empty" | "locked";
    deckName?: string;
    backgroundUrl?: string | null;
    slots?: (string | null)[];
}

export interface DecksResponse {
    slots: DeckManageSlot[];
    unlockedCount: number;
    maxDecks: number;
    deckSize: number;
}

export const getDecks = () => apiFetch<DecksResponse>("/decks");

export const upsertDeck = (slotIndex: number, body: { deckName?: string }) =>
    apiFetch<DeckManageSlot>(`/decks/${slotIndex}`, {
        method: "POST",
        body: JSON.stringify(body)
    });

export const assignCardToDeck = (
    slotIndex: number,
    body: { position: number; instanceId: string }
) =>
    apiFetch<DeckManageSlot>(`/decks/${slotIndex}/cards`, {
        method: "POST",
        body: JSON.stringify(body)
    });

export const removeCardFromDeck = (slotIndex: number, position: number) =>
    apiFetch<DeckManageSlot>(`/decks/${slotIndex}/cards/${position}`, {
        method: "DELETE"
    });

// ── Notifications ─────────────────────────────────────────────────

export type NotificationType =
    | "marketplace_sale"
    | "friend_request"
    | "trade_offer"
    | "auction_outbid"
    | "auction_won"
    | "auction_sold";

export interface MarketplaceSaleNotificationData {
    instanceId: string;
    cardId: string;
    cardName: string;
    price: number;
    buyerAvatarUrl: string | null;
    buyerId: string;
    buyerName: string;
}

export interface AuctionOutbidNotificationData {
    cardInstanceId: string;
    newHighBid: number;
    newBidderName: string;
}

export interface AuctionWonNotificationData {
    cardInstanceId: string;
    cardName: string;
    finalPrice: number;
}

export interface AuctionSoldNotificationData {
    cardInstanceId: string;
    cardName: string;
    buyerName: string;
    finalPrice: number;
    failed?: boolean;
}

export interface AppNotification {
    id: string;
    type: NotificationType;
    read: boolean;
    data:
        | MarketplaceSaleNotificationData
        | AuctionOutbidNotificationData
        | AuctionWonNotificationData
        | AuctionSoldNotificationData
        | Record<string, unknown>;
    createdAt: string;
}

export interface NotificationsResponse {
    page: number;
    totalPages: number;
    total: number;
    unreadCount: number;
    items: AppNotification[];
}

export const getNotifications = (page?: number) =>
    apiFetch<NotificationsResponse>(
        page && page > 1 ? `/notifications?page=${page}` : "/notifications"
    );

export const markAllNotificationsRead = () =>
    apiFetch<{ ok: boolean }>("/notifications/read-all", { method: "POST" });

export const markNotificationRead = (id: string) =>
    apiFetch<{ ok: boolean }>(`/notifications/${id}/read`, { method: "POST" });

export type TradeCurrency = "ryo" | "kitsu";
export type TradeStatus =
    | "pending"
    | "countered"
    | "accepted"
    | "declined"
    | "cancelled"
    | "expired";

// The request-side shape — what you SEND when proposing/countering.
// Materials here are just {itemId, quantity}; the server doesn't need
// (and shouldn't trust) display fields the client might send.
export interface TradeOffer {
    cardInstanceIds: string[];
    materials: { itemId: string; quantity: number }[];
    currency: { type: TradeCurrency; amount: number } | null;
}

// The response-side shape — what a trade's terms look like once
// serializeTrade (trade.ts) resolves cards against CardInstance/Card and
// materials against itemRegistry. Real card art/name/rarity and material
// name/emoji/webappImage let OfferSummary render actual thumbnails
// instead of a bare "N cards" count or itemId string.
export interface TradeOfferCard {
    instanceId: string;
    issueNumber: number;
    card: {
        name: string;
        rarity: "C" | "R" | "SR" | "SSR" | "UR";
        seriesName: string | null;
        mediaUrl: string;
        fileExtension: CardFileExtension;
    } | null;
}

export interface TradeOfferDisplay {
    cards: TradeOfferCard[];
    materials: {
        itemId: string;
        quantity: number;
        name: string;
        emoji: string;
        webappImage: string;
    }[];
    currency: { type: TradeCurrency; amount: number } | null;
}

export interface TradeSide {
    jid: string;
    username: string | null;
    displayName: string;
    avatarUrl: string | null;
    offer: TradeOfferDisplay;
}

export interface Trade {
    _id: string;
    status: TradeStatus;
    // Who set the CURRENTLY-standing terms — "initiator" or "recipient".
    // That side implicitly already agrees to them; only the OTHER side
    // has an actionable Accept right now. Drives trade_page.tsx's
    // "your turn" vs "waiting on them" UI.
    proposedBy: "initiator" | "recipient";
    initiator: TradeSide;
    recipient: TradeSide;
    createdAt: string;
    updatedAt: string;
    expiresAt?: string;
}

export interface TradeListResponse {
    trades: Trade[];
    total: number;
}

export const getTrades = (status?: TradeStatus) =>
    apiFetch<TradeListResponse>(status ? `/trade?status=${status}` : "/trade");

export const getTradeById = (id: string) => apiFetch<Trade>(`/trade/${id}`);

export interface ProposeTradePayload {
    recipientUsername: string;
    initiatorOffer: Partial<TradeOffer>;
    recipientOffer?: Partial<TradeOffer>;
}
export const proposeTrade = (body: ProposeTradePayload) =>
    apiFetch<Trade>("/trade", { method: "POST", body: JSON.stringify(body) });

export const counterTrade = (
    id: string,
    body: {
        initiatorOffer?: Partial<TradeOffer>;
        recipientOffer?: Partial<TradeOffer>;
    }
) =>
    apiFetch<Trade>(`/trade/${id}/counter`, {
        method: "POST",
        body: JSON.stringify(body)
    });

export const acceptTrade = (id: string) =>
    apiFetch<Trade>(`/trade/${id}/accept`, { method: "POST" });

export const declineTrade = (id: string) =>
    apiFetch<Trade>(`/trade/${id}/decline`, { method: "POST" });

export const cancelTrade = (id: string) =>
    apiFetch<Trade>(`/trade/${id}/cancel`, { method: "POST" });

// ── Loadout ───────────────────────────────────────────────────────
// GET    /loadout
// POST   /loadout  { tier, slotNumber, toolIds, label? }
// DELETE /loadout  { tier, slotNumber }

export type LoadoutTier = "pocket" | "vault";
export type VaultPath = "stealth" | "aggressive";

export interface LoadoutTool {
    itemId: string;
    name: string;
    emoji: string;
    // [NEW] Real webp art path — see routes/loadout.ts's annotateTool.
    // Empty string means no registry entry exists for this item; the UI
    // should fall back to the emoji in that case rather than rendering a
    // broken image.
    webappImage: string;
    rarity?: "common" | "uncommon" | "rare" | "epic" | "legendary";
    owned: boolean;
    ownedQuantity: number;
}

export interface PocketKit {
    slotNumber: number;
    label: string;
    weapon: LoadoutTool | null;
}

export interface VaultKit {
    slotNumber: number;
    label: string;
    path: VaultPath;
    entryTool: LoadoutTool | null;
    breachTool: LoadoutTool | null;
    escapeTool: LoadoutTool | null;
    bag: LoadoutTool | null;
}

export interface LoadoutResponse {
    maxKitsPerTier: number;
    pocketWeaponIds: string[];
    // [NEW] weaponId -> dedicated counter itemId, from the pocket-rob
    // tactical rework's weapon↔counter matrix. Lets the kit-builder show
    // "this weapon's hard counter is X" while a player picks a weapon,
    // without a second lookup table hardcoded in the frontend.
    weaponCounters: Record<string, string>;
    vaultEntryStealthIds: string[];
    vaultEntryAggressiveIds: string[];
    vaultBreachIds: string[];
    vaultEscapeIds: string[];
    vaultBagIds: string[];
    loadouts: {
        pocket: PocketKit[];
        vault: VaultKit[];
    };
}

export const getLoadout = () => apiFetch<LoadoutResponse>("/loadout");

export interface SavePocketLoadoutPayload {
    tier: "pocket";
    slotNumber: number;
    weaponId: string;
    /** Omit to leave an existing kit's label unchanged; "" or null to clear it */
    label?: string | null;
}
export interface SaveVaultLoadoutPayload {
    tier: "vault";
    slotNumber: number;
    path: VaultPath;
    entryToolId: string;
    breachToolId?: string | null;
    escapeToolId?: string | null;
    bagId?: string | null;
    label?: string | null;
}
export type SaveLoadoutPayload =
    | SavePocketLoadoutPayload
    | SaveVaultLoadoutPayload;

export interface SavePocketResponse {
    tier: "pocket";
    slotNumber: number;
    label: string;
    weapon: LoadoutTool | null;
}
export interface SaveVaultResponse {
    tier: "vault";
    slotNumber: number;
    label: string;
    path: VaultPath;
    entryTool: LoadoutTool | null;
    breachTool: LoadoutTool | null;
    escapeTool: LoadoutTool | null;
    bag: LoadoutTool | null;
}

export const saveLoadout = (body: SaveLoadoutPayload) =>
    apiFetch<SavePocketResponse | SaveVaultResponse>("/loadout", {
        method: "POST",
        body: JSON.stringify(body)
    });

export const deleteLoadout = (tier: LoadoutTier, slotNumber: number) =>
    apiFetch<{ tier: LoadoutTier; slotNumber: number; deleted: boolean }>(
        "/loadout",
        {
            method: "DELETE",
            body: JSON.stringify({ tier, slotNumber })
        }
    );

// ── Rob Log ───────────────────────────────────────────────────────
// GET /roblog?view=robber|victim&page=&pageSize=
//
// [NEW] Paginated rob-history feed backing the loadout page's roblog
// section (see routes/roblog.ts on the backend). "robber" view is the
// player's own attempts against others; "victim" view is attempts made
// against them. robberName/targetName are pre-resolved display-name
// SNAPSHOTS from the moment of the rob — never render robberId/targetId
// directly in the UI, always use the *Name fields, and never treat these
// as mentionable/taggable identities on the website (this is a read-only
// history view, not a place to @ someone).

export type RobTargetTier = "pocket" | "vault";
export type RobPathKind = "stealth" | "aggressive";
export type RobOutcomeReason =
    | "success"
    | "failed_roll"
    | "caught"
    | "police_intercepted"
    | "vault_entry_failed"
    | "vault_no_stash";

export interface RobLogEntry {
    id: string;
    createdAt: string;
    robberId: string;
    robberName: string;
    targetId: string;
    targetName: string;
    targetTier: RobTargetTier;
    path: RobPathKind | null;
    succeeded: boolean;
    caught: boolean;
    outcomeReason: RobOutcomeReason;
    stolenRyo: number;
    stolenKitsu: number;
    weaponId: string | null;
    toolIds: string[];
    targetHadAnyDefense: boolean | null;
    counterItemId: string | null;
    targetHadCounter: boolean | null;
    successRate: number | null;
    jailChance: number | null;
}

export interface RobLogResponse {
    view: "robber" | "victim";
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    pageSummary: {
        successCount: number;
        totalRyo: number;
        entryCount: number;
    };
    entries: RobLogEntry[];
}

export const getRobLog = (
    view: "robber" | "victim" = "robber",
    page = 1,
    pageSize = 15
) => {
    const qs = new URLSearchParams({
        view,
        page: String(page),
        pageSize: String(pageSize)
    });
    return apiFetch<RobLogResponse>(`/roblog?${qs.toString()}`);
};

// ── Cosmetics ─────────────────────────────────────────────────────
// POST   /cosmetics/upload            (multipart/form-data)
// GET    /cosmetics/uploads?slot=&slotIndex=
// POST   /cosmetics/equip             { slot, uploadId?, slotIndex?, frameId? }
// DELETE /cosmetics/upload/:id

export type CosmeticSlot = "avatar" | "banner" | "deckBackground";
export type EquipSlot = "avatar" | "banner" | "deckBackground" | "frame";

export interface CosmeticUpload {
    id: string;
    kind: "static" | "animated";
    url: string;
    createdAt: string;
    isEquipped: boolean;
}

export interface CosmeticsUploadsResponse {
    uploads: CosmeticUpload[];
}

export const getCosmeticUploads = (slot: CosmeticSlot, slotIndex?: number) => {
    const qs = new URLSearchParams({ slot });
    if (slot === "deckBackground" && slotIndex !== undefined)
        qs.set("slotIndex", String(slotIndex));
    return apiFetch<CosmeticsUploadsResponse>(`/cosmetics/uploads?${qs}`);
};

export const uploadCosmetic = async (
    slot: CosmeticSlot,
    file: File,
    slotIndex?: number
): Promise<{
    uploadId: string | null;
    url: string;
    kind: "static" | "animated";
    slot: string;
    slotIndex: number | null;
    banked: boolean;
}> => {
    const form = new FormData();
    // Text fields MUST come before the file so @fastify/multipart's req.file()
    // has them in data.fields when it resolves the stream.
    form.append("slot", slot);
    if (slot === "deckBackground" && slotIndex !== undefined)
        form.append("slotIndex", String(slotIndex));
    // File last — backend reads non-file fields from the stream before the file.
    form.append("file", file);

    let res: Response;
    try {
        res = await fetch(`${API_BASE}/cosmetics/upload`, {
            method: "POST",
            credentials: "include",
            // Do NOT set Content-Type — the browser must set it with the boundary.
            body: form
        });
    } catch (networkErr) {
        throw new ApiResponseError(0, {
            code: "network_error",
            message:
                "Could not reach the server. Check your connection and try again."
        });
    }

    if (res.ok) return res.json();

    // Try to parse server error body
    let errorBody: { error?: ApiError } = {};
    try {
        errorBody = await res.json();
    } catch {
        /* ignore parse failure */
    }

    throw new ApiResponseError(
        res.status,
        errorBody?.error ?? {
            code: "upload_failed",
            message: `Upload failed (HTTP ${res.status})`
        }
    );
};

export interface EquipCosmeticPayload {
    slot: EquipSlot;
    uploadId?: string;
    slotIndex?: number;
    frameId?: string | null;
}
export const equipCosmetic = (body: EquipCosmeticPayload) =>
    apiFetch<{ slot: string; url?: string; frameId?: string | null }>(
        "/cosmetics/equip",
        {
            method: "POST",
            body: JSON.stringify(body)
        }
    );

export const deleteCosmeticUpload = (id: string) =>
    apiFetch<{ removed: boolean }>(`/cosmetics/upload/${id}`, {
        method: "DELETE"
    });

// ── Card Catalog ──────────────────────────────────────────────────
// GET /cards                       — browse/search/filter/sort
// GET /cards/events                — distinct event names for filter
// GET /cards/:shortId               — detail view
// GET /cards/:shortId/price-history — price graph data
// GET /cards/instance/:instanceId   — one copy's ownership chain
//
// Distinct from InventoryCardsResponse / getInventoryCards above —
// that's the player's own collection view. This is the full public
// catalog: every approved card, searchable and filterable, matching
// routes/cards.ts exactly.

export type CatalogCardRarity = "C" | "R" | "SR" | "SSR" | "UR";
export type CatalogSort =
    | "newest"
    | "owners_desc"
    | "owners_asc"
    | "wishlist_desc"
    | "issued_desc";

export interface CatalogCard {
    shortId: string;
    name: string;
    seriesName: string;
    rarity: CatalogCardRarity;
    isEvent: boolean;
    eventName: string | null;
    thumbUrl: string;
    mediaType: string;
    fileExtension: CardFileExtension;
    ownerCount: number;
    wishlistCount: number;
    totalIssued: number;
}

export interface CatalogResponse {
    results: CatalogCard[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
}

export interface CatalogQuery {
    q?: string;
    /** comma-separated, e.g. "SR,SSR,UR" */
    rarity?: string;
    isEvent?: boolean;
    eventName?: string;
    sort?: CatalogSort;
    page?: number;
    pageSize?: number;
}

function buildCatalogQuery(params?: CatalogQuery): string {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.rarity) qs.set("rarity", params.rarity);
    if (params?.isEvent) qs.set("isEvent", "true");
    if (params?.eventName) qs.set("eventName", params.eventName);
    if (params?.sort) qs.set("sort", params.sort);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    return qs.toString();
}

export const getCards = (params?: CatalogQuery) => {
    const query = buildCatalogQuery(params);
    return apiFetch<CatalogResponse>(`/cards${query ? `?${query}` : ""}`);
};

export interface CatalogEventsResponse {
    events: string[];
}
export const getCardEvents = () =>
    apiFetch<CatalogEventsResponse>("/cards/events");

export interface CardOwner {
    issueNumber: number;
    condition: string;
    acquiredAt: string;
    player: {
        username: string | null;
        displayName: string;
        avatarUrl: string | null;
    };
}

export interface CardWishlister {
    wishlistedAt: string;
    player: {
        username: string | null;
        displayName: string;
        avatarUrl: string | null;
    };
}

export interface CardSeriesSibling {
    shortId: string;
    name: string;
    rarity: CatalogCardRarity;
    thumbUrl: string;
}

export interface CardDetailResponse {
    card: {
        shortId: string;
        name: string;
        seriesName: string;
        tier: number;
        rarity: CatalogCardRarity;
        source: string;
        isEvent: boolean;
        eventName: string | null;
        mediaUrl: string;
        mediaType: string;
        fileExtension: CardFileExtension;
        totalIssued: number;
        totalInCirculation: number;
        ownerCount: number;
        basePrice: number;
        currentPrice: number;
        wishlistCount: number;
        isCustom: boolean;
        creatorCredit: string | null;
    };
    owners: CardOwner[];
    wishlistedBy: CardWishlister[];
    seriesSiblings: CardSeriesSibling[];
}

export const getCardDetail = (shortId: string) =>
    apiFetch<CardDetailResponse>(`/cards/${encodeURIComponent(shortId)}`);

export interface CardPricePoint {
    price: number;
    reason: string;
    recordedAt: string;
}
export interface CardPriceHistoryResponse {
    points: CardPricePoint[];
}
export const getCardPriceHistory = (shortId: string, days = 90) =>
    apiFetch<CardPriceHistoryResponse>(
        `/cards/${encodeURIComponent(shortId)}/price-history?days=${days}`
    );

export interface CardInstanceHistoryEvent {
    ownerId: string;
    ownerName: string;
    ownerAvatarUrl: string | null;
    method: string;
    fromOwnerId: string | null;
    fromOwnerName: string | null;
    price: number | null;
    acquiredAt: string;
}
export interface CardInstanceHistoryResponse {
    instanceId: string;
    issueNumber: number;
    condition: string;
    currentOwnerId: string;
    card: {
        shortId: string;
        name: string;
        rarity: CatalogCardRarity;
        seriesName: string;
        thumbUrl: string;
    };
    history: CardInstanceHistoryEvent[];
}
export const getCardInstanceHistory = (instanceId: string) =>
    apiFetch<CardInstanceHistoryResponse>(`/cards/instance/${instanceId}`);

// NOTE: no backend route exists for this yet — cards.ts has zero
// wishlist mutation endpoints, only the bare Wishlist model. This is
// written to match this codebase's existing POST-toggle convention
// (see likeProfile) so it's a one-file backend addition, not a
// frontend contract mismatch, once POST /cards/:shortId/wishlist
// exists. Calling this today will 404.
export interface ToggleWishlistResponse {
    wishlisted: boolean;
    wishlistCount: number;
}
export const toggleCardWishlist = (shortId: string) =>
    apiFetch<ToggleWishlistResponse>(
        `/cards/${encodeURIComponent(shortId)}/wishlist`,
        {
            method: "POST"
        }
    );

// ── Player Search ─────────────────────────────────────────────────
// GET /players/search?q=&page=

export interface PlayerSearchResult {
    username: string;
    displayName: string;
    avatarUrl: string | null;
}

export interface PlayerSearchResponse {
    query: string;
    page: number;
    totalPages: number;
    total: number;
    results: PlayerSearchResult[];
}

export const searchPlayers = (q: string, page = 1) =>
    apiFetch<PlayerSearchResponse>(
        `/players/search?q=${encodeURIComponent(q)}&page=${page}`
    );

// ── Lottery ───────────────────────────────────────────────────────
// GET /lottery/recent-winners

export interface LotteryWinner {
    placement: number;
    amount: number;
    displayName: string;
    username: string | null;
}

export interface LotteryPool {
    resolvedAt: string;
    prizePool: number;
    winners: LotteryWinner[];
}

export interface LotteryRecentWinnersResponse {
    pools: LotteryPool[];
}

export const getLotteryRecentWinners = () =>
    apiFetch<LotteryRecentWinnersResponse>("/lottery/recent-winners");

// ── Home stats ────────────────────────────────────────────────────
// GET /home/stats  (public, no auth required)

export interface HomeStatsResponse {
    totalPlayers: number;
    totalCardsClaimed: number;
    totalCardsInCatalog: number;
}

export const getHomeStats = () => apiFetch<HomeStatsResponse>("/home/stats");
// ── Marketplace ──────────────────────────────────────────────────
// GET  /marketplace                    — browse/search/filter/sort listings
// GET  /marketplace/card/:instanceId   — one listing's full detail
// POST /marketplace/list               — list an owned card at a Kitsu price
// POST /marketplace/buy/:instanceId    — buy a listed card at its listed price
// POST /marketplace/cancel/:instanceId — pull an unsold listing back
//
// Kitsu-only — see routes/marketplace.ts's header for why (Ryo already
// flows freely elsewhere; Kitsu is the marketplace's "real value" currency).

export type MarketplaceSort = "price_asc" | "price_desc" | "newest" | "rarity";

export interface MarketplaceListingCard {
    name: string;
    rarity: CatalogCardRarity;
    seriesName: string;
    mediaUrl: string;
    mediaType: string;
    currentPrice: number;
}

export interface MarketplaceListing {
    instanceId: string;
    issueNumber: number;
    sellerId: string;
    price: number;
    listedAt: string;
    card: MarketplaceListingCard | null;
}

export interface MarketplaceBrowseResponse {
    page: number;
    totalPages: number;
    total: number;
    listings: MarketplaceListing[];
}

export interface MarketplaceBrowseQuery {
    page?: number;
    sort?: MarketplaceSort;
    /** comma-separated, e.g. "SR,SSR,UR" */
    rarity?: string;
    seriesName?: string;
    minPrice?: number;
    maxPrice?: number;
    q?: string;
    /** Scope results to the caller's own active listings */
    mine?: boolean;
}

function buildMarketplaceQuery(params?: MarketplaceBrowseQuery): string {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.sort) qs.set("sort", params.sort);
    if (params?.rarity) qs.set("rarity", params.rarity);
    if (params?.seriesName) qs.set("seriesName", params.seriesName);
    if (params?.minPrice !== undefined)
        qs.set("minPrice", String(params.minPrice));
    if (params?.maxPrice !== undefined)
        qs.set("maxPrice", String(params.maxPrice));
    if (params?.q) qs.set("q", params.q);
    if (params?.mine) qs.set("mine", "true");
    return qs.toString();
}

export const getMarketplaceListings = (params?: MarketplaceBrowseQuery) => {
    const query = buildMarketplaceQuery(params);
    return apiFetch<MarketplaceBrowseResponse>(
        `/marketplace${query ? `?${query}` : ""}`
    );
};

export interface MarketplaceCardDetail {
    card: {
        shortId: string;
        name: string;
        seriesName: string;
        tier: number;
        rarity: CatalogCardRarity;
        source: string;
        isEvent: boolean;
        eventName: string | null;
        mediaUrl: string;
        mediaType: string;
        fileExtension: CardFileExtension;
        totalIssued: number;
        totalInCirculation: number;
        ownerCount: number;
        basePrice: number;
        currentPrice: number;
        wishlistCount: number;
        isCustom: boolean;
        creatorCredit: string | null;
    } | null;
    currentOwnerId: string;
    issueNumber: number;
    condition: string;
    listing: { type: "market"; price: number; listedAt: string } | null;
    wishlistCount: number;
    history: {
        ownerId: string;
        ownerName: string;
        ownerAvatarUrl: string | null;
        method: string;
        fromOwnerId: string | null;
        fromOwnerName: string | null;
        price: number | null;
        acquiredAt: string;
    }[];
    wishlisters: {
        playerId: string;
        name: string;
        avatarUrl: string | null;
    }[];
    priceHistory: {
        price: number;
        reason: "sale" | "daily_recalc";
        recordedAt: string;
    }[];
}

export const getMarketplaceCardDetail = (instanceId: string) =>
    apiFetch<MarketplaceCardDetail>(
        `/marketplace/card/${encodeURIComponent(instanceId)}`
    );

export interface ListCardResponse {
    instanceId: string;
    price: number;
    listedAt: string;
}
export const listCardOnMarketplace = (instanceId: string, price: number) =>
    apiFetch<ListCardResponse>("/marketplace/list", {
        method: "POST",
        body: JSON.stringify({ instanceId, price })
    });

export interface BuyListingResponse {
    instanceId: string;
    cardId: string;
    price: number;
}
export const buyMarketplaceListing = (instanceId: string) =>
    apiFetch<BuyListingResponse>(
        `/marketplace/buy/${encodeURIComponent(instanceId)}`,
        { method: "POST" }
    );

export interface CancelListingResponse {
    instanceId: string;
}
export const cancelMarketplaceListing = (instanceId: string) =>
    apiFetch<CancelListingResponse>(
        `/marketplace/cancel/${encodeURIComponent(instanceId)}`,
        { method: "POST" }
    );

export interface OwnedCard {
    instanceId: string;
    issueNumber: number;
    shortId: string;
    name: string;
    seriesName: string;
    rarity: CatalogCardRarity;
    isEvent: boolean;
    eventName: string | null;
    thumbUrl: string;
    mediaType: string;
    fileExtension: string;
    ownerCount: number;
    wishlistCount: number;
    totalIssued: number;
}

export interface OwnedCardsResponse {
    results: OwnedCard[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
}

export interface OwnedCardsQuery {
    q?: string;
    rarity?: string;
    page?: number;
    pageSize?: number;
}

export const getOwnedCards = (params?: OwnedCardsQuery) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.rarity) qs.set("rarity", params.rarity);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    const query = qs.toString();
    return apiFetch<OwnedCardsResponse>(
        `/cards/owned${query ? `?${query}` : ""}`
    );
};

// ══════════════════════════════════════════════════════════════════
// ── Auctions ──────────────────────────────────────────────────────
// GET  /auctions                       — browse active auctions
// GET  /auctions/:instanceId           — single auction detail + bids
// POST /auctions/list                  — list an owned card
// POST /auctions/:instanceId/bid       — place a bid
// POST /auctions/:instanceId/cancel    — cancel a no-bids-yet auction
// GET  /auctions/:instanceId/stream    — SSE live feed
// POST /auctions/:instanceId/chat      — post a chat message
// GET  /auctions/terms                 — per-rarity increment/duration
//
// Mirrors the Marketplace section immediately above it — same
// CatalogCardRarity reuse, same ApiResponseError handling contract.
// ══════════════════════════════════════════════════════════════════

export type AuctionSort = "ending_soon" | "price_asc" | "price_desc" | "newest";

export interface AuctionListingCard {
    name: string;
    rarity: CatalogCardRarity;
    seriesName: string;
    mediaUrl: string;
    mediaType: string;
}

export interface AuctionListing {
    instanceId: string;
    card: AuctionListingCard | null;
    currentBid: number;
    buyNowPrice: number | null;
    bidCount: number;
    expiresAt: string;
    highestBidderId: string | null;
}

export interface AuctionBrowseResponse {
    page: number;
    totalPages: number;
    total: number;
    items: AuctionListing[];
}

export interface AuctionBrowseQuery {
    page?: number;
    sort?: AuctionSort;
    /** comma-separated, e.g. "SR,SSR,UR" */
    rarity?: string;
}

export const getAuctions = (params?: AuctionBrowseQuery) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.sort) qs.set("sort", params.sort);
    if (params?.rarity) qs.set("rarity", params.rarity);
    const query = qs.toString();
    return apiFetch<AuctionBrowseResponse>(
        `/auctions${query ? `?${query}` : ""}`
    );
};

export interface AuctionBidHistoryEntry {
    bidderJid: string;
    bidderName: string;
    amount: number;
    won: boolean;
    createdAt: string;
}

export interface AuctionDetail {
    instanceId: string;
    card: {
        shortId?: string;
        name: string;
        rarity: CatalogCardRarity;
        seriesName: string;
        mediaUrl: string;
        mediaType: string;
    } | null;
    sellerId: string;
    sellerName: string;
    currentBid: number;
    buyNowPrice: number | null;
    bidIncrement: number;
    bidCount: number;
    expiresAt: string;
    highestBidderId: string | null;
    highestBidderName: string | null;
    bids: AuctionBidHistoryEntry[];
    isMine?: boolean;
    isHighestBidder?: boolean;
}

export const getAuctionDetail = (instanceId: string) =>
    apiFetch<AuctionDetail>(`/auctions/${encodeURIComponent(instanceId)}`);

export interface ListAuctionResponse {
    instanceId: string;
    startingBid: number;
    buyNowPrice: number | null;
    expiresAt: string;
    feeCharged: number;
}

export const listCardForAuction = (
    instanceId: string,
    buyNowPrice: number | null,
    durationHours?: number
) =>
    apiFetch<ListAuctionResponse>("/auctions/list", {
        method: "POST",
        body: JSON.stringify({
            instanceId,
            buyNowPrice: buyNowPrice ?? undefined,
            durationHours
        })
    });

export interface PlaceAuctionBidResponse {
    instanceId: string;
    amount: number;
    isNowHighestBidder: true;
    wonByBuyNow: boolean;
}

export const placeAuctionBid = (instanceId: string, amount: number) =>
    apiFetch<PlaceAuctionBidResponse>(
        `/auctions/${encodeURIComponent(instanceId)}/bid`,
        { method: "POST", body: JSON.stringify({ amount }) }
    );

export const cancelAuction = (instanceId: string) =>
    apiFetch<{ instanceId: string; cancelled: true }>(
        `/auctions/${encodeURIComponent(instanceId)}/cancel`,
        { method: "POST" }
    );

export const sendAuctionChat = (instanceId: string, text: string) =>
    apiFetch<{ ok: boolean }>(
        `/auctions/${encodeURIComponent(instanceId)}/chat`,
        {
            method: "POST",
            body: JSON.stringify({ text })
        }
    );

export interface AuctionTerm {
    bidIncrement: number;
    durationMs: number; // default duration for that rarity
}

export interface AuctionTermsResponse {
    terms: Record<CatalogCardRarity, AuctionTerm>;
    baseListingFee: Record<CatalogCardRarity, number>;
    maxDurationMs: number; // 72h — same ceiling for every rarity
    maxDurationFee: Record<CatalogCardRarity, number>; // fee if extended all the way to maxDurationMs
}

export const getAuctionTerms = () =>
    apiFetch<AuctionTermsResponse>("/auctions/terms");

// The SSE stream itself is NOT fetched through apiFetch — EventSource
// needs a plain URL it opens itself (with credentials via
// withCredentials), not a fetch() call. This just centralizes the URL
// build so call sites don't hardcode API_BASE.
export const auctionStreamUrl = (instanceId: string) =>
    `${API_BASE}/auctions/${encodeURIComponent(instanceId)}/stream`;

export type FusionPipTier = "pip1" | "pip2" | "pip3" | "R" | "SR" | "SSR";

export interface FusionStep {
    from: FusionPipTier;
    to: FusionPipTier;
    count: number;
}

export interface FusionStepsResponse {
    order: FusionPipTier[];
    steps: Partial<Record<FusionPipTier, FusionStep>>;
}

export interface FusionEligibleCard {
    instanceId: string;
    cardName: string;
    mediaUrl: string;
    mediaType: "image" | "video";
}

export interface FusionEligibleResponse {
    eligible: Partial<Record<FusionPipTier, FusionEligibleCard[]>>;
}

export interface FusionResult {
    outputCard: {
        _id: string;
        shortId: string;
        name: string;
        seriesName: string | null;
        rarity: "C" | "R" | "SR" | "SSR" | "UR";
        source: string;
        tier: string;
        mediaUrl: string;
        mediaType: "image" | "video";
        fileExtension: string;
    };
    outputInstanceId: string;
    issueNumber: number;
    consumedCount: number;
}

export const getFusionSteps = () =>
    apiFetch<FusionStepsResponse>("/fusion/steps");

export const getFusionEligible = () =>
    apiFetch<FusionEligibleResponse>("/fusion/eligible");

export const performFusion = (fromTier: FusionPipTier, instanceIds: string[]) =>
    apiFetch<FusionResult>("/fusion", {
        method: "POST",
        body: JSON.stringify({ fromTier, instanceIds })
    });
