"use client";

import { PlayerSearch } from "../../components/PlayerSearch";

export default function PlayersPage() {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="section-header">
        <span className="section-header-text">Players</span>
      </div>
      <hr className="gold-rule" />
      <PlayerSearch placeholder="Search by username…" />
    </section>
  );
}
