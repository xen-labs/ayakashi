import Image from "next/image";

export default function Profile() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">

      {/* ── Brush-stroke header ── */}
      <div className="section-header">
        <span className="section-header-text">Profile</span>
      </div>

      {/* ── Avatar with frame ── */}
      <div className="relative h-28 w-28">
        {/* avatar */}
        <Image
          src="/user-profile/user-profile/default-avatar.webp"
          alt="Player avatar"
          width={112}
          height={112}
          className="h-full w-full rounded-full object-cover"
          unoptimized
        />
        {/* frame overlay */}
        <Image
          src="/user-profile/user-profile/default-avatar-frame.webp"
          alt=""
          aria-hidden="true"
          fill
          className="pointer-events-none object-contain"
          unoptimized
        />
      </div>

      <p className="max-w-sm text-sm leading-7 text-[#a89880]">
        Profile customization is coming soon.
      </p>
    </main>
  );
}
