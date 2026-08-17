"use client";

// src/app/components/StaticAvatar.tsx
//
// Same rendering as AvatarWithFrame, but forces avatarSrc through
// getStaticAvatarUrl first — every avatar EXCEPT the leaderboard's
// should go through this instead of AvatarWithFrame directly, so a
// player's animated MP4/WEBM/GIF avatar never autoplays in a dense list
// (friends list, pending requests, search results, card owner/wishlist
// rows, trade panels). See staticAvatarUrl.ts's header for the full
// reasoning and the leaderboard carve-out.
//
// Drop-in replacement: same props as AvatarWithFrame, just swap the
// import and component name at call sites that should be static.

import { AvatarWithFrame, type AvatarWithFrameProps } from "./AvatarWithFrame";
import { getStaticAvatarUrl, type StaticAvatarPreset } from "./staticAvatarUrl";

export interface StaticAvatarProps extends AvatarWithFrameProps {
  /** Which Cloudinary thumbnail preset to request. Defaults to
   *  "friendsList" (48px) — the most common size for the dense-list
   *  contexts this component is meant for. Use "profile" (256px) for a
   *  larger single-avatar context that still shouldn't autoplay. */
  preset?: StaticAvatarPreset;
}

export function StaticAvatar({
  avatarSrc,
  preset = "friendsList",
  ...rest
}: StaticAvatarProps) {
  return (
    <AvatarWithFrame
      avatarSrc={getStaticAvatarUrl(avatarSrc, preset)}
      {...rest}
    />
  );
}
