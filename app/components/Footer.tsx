import Image from "next/image";

// ── Config ────────────────────────────────────────────────────────
// All community links are env-driven placeholders — fill these in
// on Vercel (or .env.local) once the actual invite links are ready.
const LINKS = {
  channel: process.env.NEXT_PUBLIC_WA_CHANNEL_URL ?? "#",
  hub: process.env.NEXT_PUBLIC_WA_HUB_URL ?? "#",
  otakuAlliance: process.env.NEXT_PUBLIC_WA_OTAKU_URL ?? "#",
  gamblingOne: process.env.NEXT_PUBLIC_WA_GAMBLING_1_URL ?? "#",
  gamblingTwo: process.env.NEXT_PUBLIC_WA_GAMBLING_2_URL ?? "#",
};

const COMMUNITY_LINKS = [
  { label: "WhatsApp Channel", href: LINKS.channel },
  { label: "Ayakashi Hub", href: LINKS.hub },
  { label: "Otaku Alliance", href: LINKS.otakuAlliance },
  { label: "Gambling Games I", href: LINKS.gamblingOne },
  { label: "Gambling Games II", href: LINKS.gamblingTwo },
];

/**
 * Home-page footer. Replaces the old GithubCredits component:
 * community/support links get real billing, credits are reduced to
 * a single quiet line. Only ever rendered on the logged-out home page.
 */
export function Footer() {
  return (
    <footer className="relative z-10 border-t border-[rgba(200,168,75,0.12)] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        {/* ── Brand + community ── */}
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
            <Image
              src="/brand/logo.png?v=transparent-1"
              alt="Ayakashi"
              width={36}
              height={36}
              className="logo-filter h-9 w-9"
              unoptimized
            />
            <p className="font-ui max-w-xs text-xs leading-6 text-[rgba(200,168,75,0.45)]">
              The web companion for the Ayakashi WhatsApp network. Cards,
              currency, and community — all synced to your number.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 sm:items-end">
            <span className="font-ui text-[10px] font-bold uppercase tracking-[0.2em] text-[rgba(200,168,75,0.55)]">
              Community
            </span>
            <ul className="flex flex-col items-center gap-2 sm:items-end">
              {COMMUNITY_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-ui text-xs text-[#a89880] transition-colors hover:text-[#c8a84b]"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Credits ── */}
        <div className="flex flex-col items-center gap-1 border-t border-[rgba(200,168,75,0.08)] pt-6 text-center">
          <p className="font-ui text-[10px] uppercase tracking-[0.15em] text-[rgba(200,168,75,0.3)]">
            Built by Xen Labs
          </p>
        </div>
      </div>
    </footer>
  );
}
