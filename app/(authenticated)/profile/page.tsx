import { CircleUserRound } from "lucide-react";

export default function Profile() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">

      {/* ── Brush-stroke header ── */}
      <div className="section-header">
        <span className="section-header-text">Profile</span>
      </div>

      <CircleUserRound className="h-12 w-12 text-[rgba(200,168,75,0.45)]" strokeWidth={1.2} />

      <p className="max-w-sm text-sm leading-7 text-[#a89880]">
        Profile customization is coming soon.
      </p>
    </main>
  );
}
