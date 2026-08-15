/**
 * FireSpinner — kitsune-fire loading spinner.
 * Replaces the plain border-spin SVG circle used across auth-check /
 * loading states. A rotating ring with a pulsing ember core.
 *
 * Usage:
 *   <FireSpinner />                        // 32px gold, dark backgrounds
 *   <FireSpinner size={16} />              // inline, e.g. page loaders
 *   <FireSpinner size={14} variant="dark" />  // on gold brush-btn buttons
 *
 * Requires the CSS block in topbar-and-spinner-additions.css to be
 * added to globals.css (.fire-spinner-ring[-dark], .fire-spinner-core).
 */
interface FireSpinnerProps {
  size?: number;
  variant?: "gold" | "dark";
  className?: string;
}

export function FireSpinner({
  size = 32,
  variant = "gold",
  className = "",
}: FireSpinnerProps) {
  return (
    <div
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    >
      <div
        className={`absolute inset-0 ${
          variant === "dark" ? "fire-spinner-ring-dark" : "fire-spinner-ring"
        }`}
      />
      {variant === "gold" && (
        <div
          className="fire-spinner-core absolute"
          style={{
            inset: `${size * 0.28}px`,
          }}
        />
      )}
    </div>
  );
}
