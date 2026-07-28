import Image from "next/image";

/**
 * CurrencyIcon — always uses the uploaded logo images, never emoji.
 *
 * Usage:
 *   <CurrencyIcon type="ryo"   size={20} />
 *   <CurrencyIcon type="kitsu" size={24} />
 *   <CurrencyIcon type="bank"  size={20} />
 */

const CURRENCY_SRCS: Record<"ryo" | "kitsu" | "bank", string> = {
  ryo:   "/currency/ryo.webp",
  kitsu: "/currency/kitsu.webp",
  bank:  "/currency/bank.webp",
};

interface CurrencyIconProps {
  type: "ryo" | "kitsu" | "bank";
  size?: number;
  className?: string;
}

export function CurrencyIcon({ type, size = 20, className = "" }: CurrencyIconProps) {
  return (
    <Image
      src={CURRENCY_SRCS[type]}
      alt={type}
      width={size}
      height={size}
      className={`object-contain shrink-0 ${className}`}
      unoptimized
    />
  );
}
