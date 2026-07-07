"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface TosModalProps {
  open: boolean;
  onClose: () => void;
}

export function TosModal({ open, onClose }: TosModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Sync open state with native <dialog>
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      el.showModal();
    } else {
      el.close();
    }
  }, [open]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose();
  };

  // Close on Escape (native dialog handles it, we just sync state)
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handler = () => onClose();
    el.addEventListener("cancel", handler);
    return () => el.removeEventListener("cancel", handler);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="
        m-auto max-h-[90dvh] w-full max-w-2xl rounded-sm border
        border-white/10 bg-[#0d0d1a] p-0 text-white
        backdrop:bg-black/70 backdrop:backdrop-blur-sm
        open:flex open:flex-col
        outline-none
      "
      aria-labelledby="tos-title"
      aria-modal="true"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-4">
        <h2
          id="tos-title"
          className="text-lg font-bold uppercase tracking-widest text-astral-gold"
          style={{ fontFamily: "serif" }}
        >
          Terms of Service &amp; Privacy Policy
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-gray-400 transition-colors hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="overflow-y-auto px-6 py-6 text-sm leading-7 text-gray-300 space-y-6">

        <p className="text-xs text-gray-500">Last updated: July 2026</p>

        <section>
          <h3 className="mb-2 text-base font-semibold uppercase tracking-wider text-astral-gold">
            1. Acceptance of Terms
          </h3>
          <p>
            By creating an account on Astral Legacy (&ldquo;the Platform&rdquo;), you agree to
            be bound by these Terms of Service and our Privacy Policy. If you do not agree,
            do not register or use the Platform.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-base font-semibold uppercase tracking-wider text-astral-gold">
            2. Eligibility
          </h3>
          <p>
            You must be at least 13 years of age to use the Platform. By registering, you
            represent that you meet this requirement. Users under 18 must have parental or
            guardian consent.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-base font-semibold uppercase tracking-wider text-astral-gold">
            3. Account Responsibilities
          </h3>
          <p>
            You are responsible for maintaining the confidentiality of your credentials and
            for all activity under your account. Notify us immediately of any unauthorised
            access. We are not liable for losses resulting from compromised credentials.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-base font-semibold uppercase tracking-wider text-astral-gold">
            4. WhatsApp Integration
          </h3>
          <p>
            Astral Legacy operates via a WhatsApp bot. By providing your WhatsApp number you
            consent to receive automated messages from our bot account. You may opt out at
            any time by messaging <span className="text-astral-gold">STOP</span> to the bot.
            Standard carrier messaging rates may apply.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-base font-semibold uppercase tracking-wider text-astral-gold">
            5. Virtual Items &amp; Auctions
          </h3>
          <p>
            Cards, items, and any in-game assets are virtual and have no real-world monetary
            value unless explicitly stated. Auction results are final. We reserve the right
            to revoke items obtained through exploits or violations of these terms.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-base font-semibold uppercase tracking-wider text-astral-gold">
            6. Prohibited Conduct
          </h3>
          <ul className="ml-4 list-disc space-y-1">
            <li>Cheating, botting, or using unauthorised automation</li>
            <li>Harassing, threatening, or impersonating other users</li>
            <li>Exploiting bugs without reporting them</li>
            <li>Attempting to reverse-engineer or scrape the Platform</li>
            <li>Selling accounts or virtual items for real money outside approved channels</li>
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-base font-semibold uppercase tracking-wider text-astral-gold">
            7. Intellectual Property
          </h3>
          <p>
            All content, artwork, and branding on the Platform are the property of Astral
            Legacy or its licensors. You may not reproduce or distribute them without written
            permission.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-base font-semibold uppercase tracking-wider text-astral-gold">
            8. Privacy Policy
          </h3>
          <p>
            We collect your player name, email address, WhatsApp number, age, and guild
            preference solely to operate the Platform. We do not sell your data to third
            parties. Data is stored securely and retained only as long as your account is
            active or as required by law.
          </p>
          <p className="mt-2">
            You may request deletion of your data at any time by contacting us via the
            WhatsApp bot or support email.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-base font-semibold uppercase tracking-wider text-astral-gold">
            9. Termination
          </h3>
          <p>
            We reserve the right to suspend or terminate accounts that violate these terms,
            with or without prior notice. You may delete your account at any time.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-base font-semibold uppercase tracking-wider text-astral-gold">
            10. Limitation of Liability
          </h3>
          <p>
            The Platform is provided &ldquo;as is&rdquo; without warranties of any kind. To the
            maximum extent permitted by law, Astral Legacy shall not be liable for any
            indirect, incidental, or consequential damages arising from your use of the
            Platform.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-base font-semibold uppercase tracking-wider text-astral-gold">
            11. Changes to Terms
          </h3>
          <p>
            We may update these Terms at any time. Continued use of the Platform after
            changes are posted constitutes your acceptance of the revised Terms.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-base font-semibold uppercase tracking-wider text-astral-gold">
            12. Contact
          </h3>
          <p>
            For questions about these Terms, reach us via the Astral Legacy WhatsApp bot or
            your guild support channel.
          </p>
        </section>

      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-white/10 px-6 py-4 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="h-10 border border-astral-gold bg-astral-gold px-6 text-sm font-bold uppercase tracking-wider text-black transition-all hover:bg-white"
        >
          I Understand
        </button>
      </div>
    </dialog>
  );
}
