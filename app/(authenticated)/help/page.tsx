import { MessageCircle } from "lucide-react";

export default function Help() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">

      {/* ── Brush-stroke header ── */}
      <div className="section-header">
        <span className="section-header-text">Help</span>
      </div>

      <p className="max-w-sm text-sm leading-7 text-[#a89880]">
        A full help center is coming soon. For now, reach out on our WhatsApp
        channel and we&apos;ll help directly.
      </p>

      <a
        href="https://whatsapp.com/channel/0029VbCUyYDJUM2hhDyMld2w"
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-11 items-center gap-2 border border-[#c8a84b] px-6 text-xs font-bold uppercase tracking-[0.16em] text-[#c8a84b] transition-colors hover:bg-[#c8a84b] hover:text-black"
      >
        <MessageCircle className="h-4 w-4" />
        Message Us
      </a>
    </main>
  );
}
