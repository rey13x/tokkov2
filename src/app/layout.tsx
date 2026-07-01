import type { Metadata } from "next";
import { Sora, Space_Mono } from "next/font/google";
import PageTransition from "@/components/layout/PageTransition";
import SiteFooter from "@/components/layout/SiteFooter";
import MaintenanceModal from "@/components/maintenance/MaintenanceModal";
import { AuthSessionProvider } from "@/components/providers/SessionProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import ClientProviders from "@/components/providers/ClientProviders";
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
  title: "Tokko Marketplace",
  description: "Tokko Marketplace",
  icons: {
    icon: "/assets/maintenancelogo.jpg",
    shortcut: "/assets/maintenancelogo.jpg",
    apple: "/assets/maintenancelogo.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sora.variable} ${spaceMono.variable}`}>
        <ThemeProvider>
          <AuthSessionProvider>
            <ClientProviders>
              <PageTransition>{children}</PageTransition>
              <MaintenanceModal />
              <SiteFooter />
            </ClientProviders>
          </AuthSessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
