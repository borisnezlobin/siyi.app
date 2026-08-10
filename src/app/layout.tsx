import type { Metadata, Viewport } from "next";
import { Manrope, Newsreader } from "next/font/google";
import { brand } from "@/config/brand";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: brand.name,
    template: `%s · ${brand.name}`,
  },
  description: brand.description,
  applicationName: brand.name,
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: brand.name,
    title: brand.name,
    description: brand.description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: brand.name,
    description: brand.description,
  },
  // No `icon` entries here on purpose. Listing the 192 and 512 PNGs as rel=icon
  // leaves a crawler to choose between three icons and shrink whichever it
  // picks. favicon.ico is the one drawn at 16, 32 and 48, so it is the only
  // rel=icon; the PWA icons stay in the manifest, which is where an installer
  // looks anyway.
  icons: {
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: brand.shortName,
  },
};

export const viewport: Viewport = {
  themeColor: "#f4f7f4",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Without this the on-screen keyboard slides over the page rather than
  // shrinking it, so a sheet sized in dvh stays full height and the field
  // being typed in ends up underneath the keys.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${manrope.variable} ${newsreader.variable} ${manrope.className} antialiased`}
      >
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
