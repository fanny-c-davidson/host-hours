import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { IosInstallBanner } from "@/components/ios-install-banner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
});

export const metadata: Metadata = {
  title: "Host Hours — Track STR hosting hours",
  description:
    "A meticulous time-tracker for short-term-rental hosts. Log hours, organize by property, and export reports.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Host Hours",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#4A148C",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegister />
        <IosInstallBanner />
      </body>
    </html>
  );
}
