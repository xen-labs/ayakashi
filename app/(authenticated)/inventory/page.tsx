import { Backpack } from "lucide-react";

export default function Inventory() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">

      {/* ── Brush-stroke header ── */}
      <div className="section-header">
        <span className="section-header-text">Inventory</span>
      </div>

      <Backpack className="h-12 w-12 text-[rgba(200,168,75,0.45)]" strokeWidth={1.2} />

      <p className="max-w-sm text-sm leading-7 text-[#a89880]">
        Your items and materials will show up here soon.
      </p>
    </main>
  );
}
