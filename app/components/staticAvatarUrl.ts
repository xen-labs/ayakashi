// src/app/components/staticAvatarUrl.ts
//
// Client-side port of imageHost.ts's getStaticThumbnailUrl — duplicated
// here rather than imported because the frontend and backend are
// separate apps on separate platforms with no shared package (nothing
// wired up to import server code into the Next.js app). This is a pure
// string rewrite with no secrets and no server logic, so duplicating
// ~15 lines is the pragmatic call over standing up a shared package or
// an API round-trip just to rewrite a URL.
//
// KEEP THIS IN SYNC with imageHost.ts's getStaticThumbnailUrl /
// getPosterFrameUrl / THUMBNAIL_PRESETS if those ever change — there is
// no build-time link between the two copies to catch drift.
//
// WHERE THIS IS USED: everywhere EXCEPT the leaderboard. Product
// decision — leaderboard avatars keep playing their real animated
// upload (few rows, high-attention context, a game-y "showing off"
// spot), while every denser/more-incidental context (friends list,
// pending requests, search results, card owner/wishlist lists, trade
// panels) forces a static poster frame instead — both for the
// performance/battery cost of N simultaneous autoplaying videos in a
// list, and because a small avatar deep in a dense list isn't a context
// where the animation actually gets appreciated. See leaderboard's
// page.tsx / RowAvatar, which intentionally does NOT use this — it
// keeps passing the raw avatarUrl straight to AvatarWithFrame.

const VIDEO_EXT_RE = /\.(mp4|webm|mov)(\?|$)/i;

export type StaticAvatarPreset = "friendsList" | "cardPreview" | "profile";

const THUMBNAIL_PRESETS: Record<StaticAvatarPreset, string> = {
  friendsList: "w_48,h_48,c_thumb,g_face,r_max",
  cardPreview: "w_160,h_160,c_fill,g_auto",
  profile: "w_256,h_256,c_fill,g_face",
};

/**
 * Rewrites a Cloudinary avatar/banner URL to a static (non-animated)
 * poster frame at a fixed preset size. Safe to call on an already-
 * static URL (png/jpeg/webp/static-gif) — it's a no-op in effect since
 * pg_1/frame-extraction on a single-frame asset just returns that same
 * frame. Falls back to returning the URL unchanged if it isn't a
 * Cloudinary URL at all (default-avatar assets under /user-profile/,
 * or any legacy non-Cloudinary URL still on old records).
 */
export function getStaticAvatarUrl(
  url: string,
  preset: StaticAvatarPreset,
): string {
  if (!url.includes("res.cloudinary.com")) return url;

  const isVideo = url.includes("/video/upload/") || VIDEO_EXT_RE.test(url);
  if (isVideo) {
    return url
      .replace(
        "/video/upload/",
        `/video/upload/${THUMBNAIL_PRESETS[preset]},f_auto,q_auto/`,
      )
      .replace(VIDEO_EXT_RE, ".jpg");
  }
  const params = `pg_1,${THUMBNAIL_PRESETS[preset]},f_auto,q_auto`;
  return url.replace("/upload/", `/upload/${params}/`);
}
