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
 * [FIXED — this pass] avatarSrc can now be a video (MP4/WEBM/MOV) since
 * cosmeticUpload.ts started accepting video as an "animated" avatar
 * format alongside GIF — see that file's header. next/image can only
 * decode actual image formats; handed a video URL it silently rendered
 * nothing, which is why uploading an MP4 avatar showed up blank. We
 * detect video by file extension on the URL and render a real <video>
 * tag for those, keeping next/image for everything else (GIF included
 * — next/image DOES render animated GIF, it just can't touch video
 * containers). frameSrc is intentionally NOT covered by this — it's
 * always static frame art (never user-uploaded media), so it stays a
 * plain next/image unconditionally.
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

const VIDEO_EXT_RE = /\.(mp4|webm|mov)(\?|$)/i;

export function AvatarWithFrame({
  avatarSrc,
  frameSrc,
  innerSize = 112,
  frameSize,
  alt = "Player avatar",
}: AvatarWithFrameProps) {
  const avatarSize = innerSize;
  // Frame image has ~10% transparent padding on each side around the ring,
  // so render it larger than the avatar so the ring sits on the avatar edge.
  // frameSize prop overrides this if you need to fine-tune.
  const frame = frameSize ?? Math.round(avatarSize * 1.35);
  const isVideo = VIDEO_EXT_RE.test(avatarSrc);

  return (
    <div
      className="relative shrink-0 flex items-center justify-center"
      style={{ width: frame, height: frame }}
    >
      {/* Avatar — centered, clipped to circle */}
      <div
        className="absolute rounded-full overflow-hidden"
        style={{ width: avatarSize, height: avatarSize }}
      >
        {isVideo ? (
          <video
            src={avatarSrc}
            className="h-full w-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            // No poster attribute here on purpose — these are short (≤3s,
            // see cosmeticUpload.ts's MAX_ANIMATED_AVATAR_SECONDS) looping
            // clips that start playing essentially immediately, so a
            // poster frame would only flash briefly before autoplay takes
            // over and isn't worth the extra request.
          />
        ) : (
          <Image
            src={avatarSrc}
            alt={alt}
            width={avatarSize}
            height={avatarSize}
            className="h-full w-full object-cover"
            unoptimized
          />
        )}
      </div>

      {/* Frame — larger than avatar so the ring aligns with the avatar edge.
          Always static art, never user-uploaded media — no video branch
          needed here. */}
      <Image
        src={frameSrc}
        alt=""
        aria-hidden="true"
        width={frame}
        height={frame}
        className="relative z-10 h-full w-full object-contain pointer-events-none"
        unoptimized
      />
    </div>
  );
}
