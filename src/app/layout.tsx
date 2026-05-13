import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Household Portal",
  description: "Private household management portal",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Portal",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className={`${GeistSans.variable} font-sans`}>{children}</body>
    </html>
  );
}
