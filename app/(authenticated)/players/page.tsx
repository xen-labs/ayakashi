"use client";

import { Users } from "lucide-react";
import { PlayerSearch } from "../../components/PlayerSearch";

export default function PlayersPage() {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center gap-2 [animation:shop-card-in_0.3s_ease-out_backwards]">
        <div className="section-header">
          <span className="section-header-text">Players</span>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-[rgba(200,168,75,0.45)]">
          <Users className="h-3.5 w-3.5" />
          Find anyone by their username
        </p>
      </div>
      <hr className="gold-rule [animation:shop-card-in_0.3s_ease-out_0.05s_backwards]" />
      <div className="[animation:shop-card-in_0.3s_ease-out_0.1s_backwards]">
        <PlayerSearch placeholder="Search by username…" />
      </div>
    </section>
  );
}
