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
  const frame = frameSize ?? innerSize + 28;

  return (
    // Outer wrapper is frame-sized so the frame never gets clipped
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: frame, height: frame }}
    >
      {/* Inner circle — avatar is clipped here */}
      <div
        className="overflow-hidden rounded-full"
        style={{ width: innerSize, height: innerSize }}
      >
        <Image
          src={avatarSrc}
          alt={alt}
          width={innerSize}
          height={innerSize}
          className="h-full w-full object-cover"
          unoptimized
        />
      </div>

      {/* Frame overlay — fills the outer wrapper, sits on top */}
      <Image
        src={frameSrc}
        alt=""
        aria-hidden="true"
        width={frame}
        height={frame}
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        unoptimized
      />
    </div>
  );
}
