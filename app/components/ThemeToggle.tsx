"use client";

import { useTheme } from "./ThemeProvider";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="
        fixed right-4 top-4 z-50
        flex h-10 w-10 items-center justify-center
        rounded-full border
        transition-all duration-300
        dark:border-white/20 dark:bg-black/40 dark:text-astral-gold dark:hover:border-astral-gold dark:hover:bg-astral-gold/10
        light:border-black/20 light:bg-white/60 light:text-amber-700 light:hover:border-amber-600 light:hover:bg-amber-50
        backdrop-blur-sm shadow-md
      "
    >
      {theme === "dark" ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  );
}
