import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist_Mono, Instrument_Sans } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import { LOCALE_COOKIE, getDirection, isLocale } from "@/lib/locale";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Miluli",
  description: "הופכים הודעות קוליות ארוכות לטקסט.",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.png", sizes: "1024x1024", type: "image/png" },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Miluli",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const localeValue = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(localeValue) ? localeValue : "en";

  return (
    <html
      dir={getDirection(locale)}
      lang={locale}
      className={`${instrumentSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
