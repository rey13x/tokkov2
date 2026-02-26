import type { Metadata } from "next";
import { Sora, Space_Mono } from "next/font/google";
import SiteFooter from "@/components/layout/SiteFooter";
import { AuthSessionProvider } from "@/components/providers/SessionProvider";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tokk'o Ramadhan",
  description: "Tokk'o Ramadhan",
  icons: {
    icon: "/assets/logo.png",
    shortcut: "/assets/logo.png",
    apple: "/assets/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${sora.variable} ${spaceMono.variable}`}>
        <AuthSessionProvider>
          {children}
          <SiteFooter />
        </AuthSessionProvider>
      </body>
    </html>
  );
}
