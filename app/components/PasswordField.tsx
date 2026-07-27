"use client";

import { useState, useId } from "react";
import { Eye, EyeOff } from "lucide-react";

// ── Strength calculation ───────────────────────────────────────────
type StrengthLevel = 0 | 1 | 2 | 3 | 4;

function calcStrength(pw: string): StrengthLevel {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(4, score) as StrengthLevel;
}

const STRENGTH_LABELS: Record<StrengthLevel, string> = {
  0: "",
  1: "Weak",
  2: "Fair",
  3: "Good",
  4: "Strong",
};

const STRENGTH_COLORS: Record<StrengthLevel, string> = {
  0: "transparent",
  1: "#ef4444",   // red-500
  2: "#f97316",   // orange-500
  3: "#eab308",   // yellow-500
  4: "#22c55e",   // green-500
};

const STRENGTH_WIDTHS: Record<StrengthLevel, string> = {
  0: "0%",
  1: "25%",
  2: "50%",
  3: "75%",
  4: "100%",
};

// ── Props ──────────────────────────────────────────────────────────
interface PasswordFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  /** If true, show the strength meter */
  showStrength?: boolean;
  /** Optional: compare against another value to show match hint */
  matchValue?: string;
}

export function PasswordField({
  label,
  name,
  value,
  onChange,
  placeholder = "••••••••",
  required,
  showStrength,
  matchValue,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const strength = showStrength ? calcStrength(value) : 0;

  const showMatch = matchValue !== undefined && value.length > 0;
  const matches = matchValue === value;

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-semibold uppercase tracking-widest text-astral-gold">
        {label}
      </label>

      {/* Input row */}
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoComplete={name === "password" ? "new-password" : "new-password"}
          className="form-input h-12 w-full border px-4 pr-12 outline-none transition-colors placeholder:text-gray-500 focus:border-astral-gold"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-astral-gold transition-colors"
        >
          {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>

      {/* Strength meter */}
      {showStrength && value.length > 0 && (
        <div className="grid gap-1">
          <div className="strength-bar-track">
            <div
              className="strength-bar-fill"
              style={{
                width: STRENGTH_WIDTHS[strength],
                backgroundColor: STRENGTH_COLORS[strength],
              }}
            />
          </div>
          <p
            className="text-xs font-medium"
            style={{ color: STRENGTH_COLORS[strength] }}
          >
            {STRENGTH_LABELS[strength]}
          </p>
        </div>
      )}

      {/* Match hint for confirm field */}
      {showMatch && (
        <p className={`text-xs font-medium ${matches ? "text-green-500" : "text-red-400"}`}>
          {matches ? "Passwords match ✓" : "Passwords do not match"}
        </p>
      )}
    </div>
  );
}
