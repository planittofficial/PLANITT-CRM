import "../styles/globals.css";
import { BackendKeepAlive } from "@/components/providers/backend-keepalive";
import { CrmSearchProvider } from "@/components/providers/crm-search-provider";
import { SocketProvider } from "@/components/providers/socket-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { DEFAULT_CRM_THEME } from "@/lib/theme-storage";
import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
  adjustFontFallback: true,
});

/**
 * Google Search Console → “HTML tag” method: meta google-site-verification content.
 * Override with NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION in Vercel / .env.local if it changes.
 */
const googleSiteVerification =
  process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim() ||
  "Ne-fMOEmtMgJxAQvCiuW5j4qvvBA0wngrLVOnL0zfYM";

export const metadata: Metadata = {
  title: "Planitt CRM",
  description: "Internal CRM for sales, follow-ups, and team workflows.",
  ...(googleSiteVerification
    ? { verification: { google: googleSiteVerification } }
    : {}),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7ff" },
    { media: "(prefers-color-scheme: dark)", color: "#071120" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const themeBootstrapScript = `
    try {
      var key = 'crm-theme';
      var raw = window.localStorage.getItem(key);
      var theme = raw === 'dark' || raw === 'light' ? raw : 'light';
      document.documentElement.dataset.theme = theme;
      document.documentElement.classList.toggle('dark', theme === 'dark');
    } catch (_) {}
  `;

  return (
    <html lang="en" data-scroll-behavior="smooth" data-theme={DEFAULT_CRM_THEME} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className={`${manrope.variable} font-sans antialiased`}>
        <ThemeProvider>
          <BackendKeepAlive />
          <SocketProvider>
            <CrmSearchProvider>{children}</CrmSearchProvider>
          </SocketProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
