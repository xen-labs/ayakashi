import type { Metadata } from "next";
import { Inter, Kaisei_Decol } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const kaiseiDecol = Kaisei_Decol({
  variable: "--font-kaisei",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Ayakashi",
    template: "%s | Ayakashi",
  },
  description:
    "Enter the spirit realm. Claim anime cards, manage your inventory, grind RPG stats, and climb the leaderboards across the Ayakashi network.",
  keywords: [
    "WhatsApp bot",
    "anime cards",
    "RPG bot",
    "gacha",
    "Ayakashi",
    "leaderboard",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${kaiseiDecol.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
