import Image from "next/image";

export default function Profile() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">

      {/* ── Brush-stroke header ── */}
      <div className="section-header">
        <span className="section-header-text">Profile</span>
      </div>

      {/* ── Avatar with frame ──
           Outer div is the frame size (140px).
           Avatar sits centered inside at 112px (rounded-full).
           Frame image is absolutely positioned to fill the outer div,
           so it naturally wraps around the avatar border.
      ── */}
      <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
        {/* avatar — inset by ~14px so frame has room to overlap the edge */}
        <Image
          src="/user-profile/user-profile/default-avatar.webp"
          alt="Player avatar"
          width={112}
          height={112}
          className="rounded-full object-cover"
          style={{ width: 112, height: 112 }}
          unoptimized
        />
        {/* frame — same size as the outer container, sits on top */}
        <Image
          src="/user-profile/user-profile/default-avatar-frame.webp"
          alt=""
          aria-hidden="true"
          width={140}
          height={140}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          unoptimized
        />
      </div>

      <p className="max-w-sm text-sm leading-7 text-[#a89880]">
        Profile customization is coming soon.
      </p>
    </main>
  );
}
