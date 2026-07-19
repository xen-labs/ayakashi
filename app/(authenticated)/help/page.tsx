import { HelpCircle, MessageCircle } from "lucide-react";

export default function Help() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
      <HelpCircle className="h-10 w-10 text-astral-gold" strokeWidth={1.5} />
      <h1 className="theme-heading text-xl font-bold uppercase tracking-widest">
        Help &amp; Support
      </h1>
      <p className="theme-body text-sm text-gray-400">
        A full help center is coming soon. For now, reach out on our WhatsApp
        channel and we&apos;ll help directly.
      </p>
      <a
        href="https://whatsapp.com/channel/0029VbCUyYDJUM2hhDyMld2w"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 flex h-11 items-center gap-2 border border-astral-gold px-5 text-xs font-bold uppercase tracking-widest text-astral-gold transition-colors hover:bg-astral-gold hover:text-black"
      >
        <MessageCircle className="h-4 w-4" />
        Message Us
      </a>
    </main>
  );
}
