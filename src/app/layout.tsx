import type { Metadata } from "next";
import { Sora, Space_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import PageTransition from "@/components/layout/PageTransition";
import SiteFooter from "@/components/layout/SiteFooter";
import GlobalScrollSmoother from "@/components/layout/GlobalScrollSmoother";
import MaintenanceModal from "@/components/maintenance/MaintenanceModal";
import { AuthSessionProvider } from "@/components/providers/SessionProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import ClientProviders from "@/components/providers/ClientProviders";
import AdPopup from "@/components/popup/AdPopup";
import { getPublicStoreData } from "@/server/public-store-data";
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
  manifest: "/site.webmanifest",
  themeColor: "#111319",
  icons: {
    icon: "/assets/maintenancelogo.jpg",
    shortcut: "/assets/maintenancelogo.jpg",
    apple: "/assets/maintenancelogo.jpg",
  },
};

export const viewport = {
  themeColor: "#111319",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialStoreData = await getPublicStoreData();

  return (
    <html lang="en">
      <body className={`${sora.variable} ${spaceMono.variable}`}>
        <ThemeProvider>
          <AuthSessionProvider>
            <ClientProviders initialStoreData={initialStoreData}>
              <div id="smooth-wrapper">
                <div id="smooth-content">
                  <PageTransition>{children}</PageTransition>
                  <SiteFooter />
                </div>
              </div>
              <GlobalScrollSmoother />
              <MaintenanceModal />
              <AdPopup />
              <SpeedInsights />
            </ClientProviders>
          </AuthSessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
