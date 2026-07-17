import { Backpack } from "lucide-react";

export default function Inventory() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
      <Backpack className="h-10 w-10 text-astral-gold" strokeWidth={1.5} />
      <h1 className="theme-heading text-xl font-bold uppercase tracking-widest">
        Inventory
      </h1>
      <p className="theme-body text-sm text-gray-400">
        Your items and materials will show up here soon.
      </p>
    </main>
  );
}
