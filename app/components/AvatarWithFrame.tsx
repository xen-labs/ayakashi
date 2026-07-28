"use client";

import Image from "next/image";

/**
 * AvatarWithFrame
 *
 * The inner circle is always exactly `innerSize` px — the avatar is
 * clipped to that circle (overflow hidden + rounded-full).
 * The frame PNG is a transparent-background overlay; its natural size
 * usually extends a bit beyond the inner circle. We let the frame
 * scale to `frameSize` (defaults to innerSize + 28) and center it
 * over the inner circle, so regardless of how thick or thin the frame
 * art is, it always sits right on the boundary.
 *
 * Usage:
 *   <AvatarWithFrame
 *     avatarSrc="/user-profile/user-profile/default-avatar.webp"
 *     frameSrc="/user-profile/user-profile/default-avatar-frame.webp"
 *     innerSize={112}   // px — the visible circle
 *   />
 */
export interface AvatarWithFrameProps {
  avatarSrc: string;
  frameSrc: string;
  /** Diameter of the inner avatar circle in px. Default 112. */
  innerSize?: number;
  /** Diameter of the frame image in px. Defaults to innerSize + 28. */
  frameSize?: number;
  alt?: string;
}

export function AvatarWithFrame({
  avatarSrc,
  frameSrc,
  innerSize = 112,
  frameSize,
  alt = "Player avatar",
}: AvatarWithFrameProps) {
  // The frame IS the size reference — avatar sits behind it at the same size.
  // The frame's transparent hole naturally reveals the avatar.
  // innerSize is ignored in favor of making both images the same size.
  const size = frameSize ?? innerSize;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      {/* Avatar — behind the frame, fills the full container */}
      <Image
        src={avatarSrc}
        alt={alt}
        width={size}
        height={size}
        className="absolute inset-0 h-full w-full rounded-full object-cover"
        unoptimized
      />

      {/* Frame — on top, same size, transparent hole reveals avatar */}
      <Image
        src={frameSrc}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className="relative z-10 h-full w-full object-contain"
        unoptimized
      />
    </div>
  );
}
