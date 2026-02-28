import type { Metadata } from "next";
import { Inter, Sora, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

const sora = Sora({ 
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "Mission Control - OpenClaw",
  description: "Your OpenClaw agent dashboard",
  manifest: "/manifest.json",
  themeColor: "#1a1a2e",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Service worker disabled: it was caching old JS bundles and causing users to see stale/crashy UIs after deploys. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
  const IGNORE = [
    'THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.',
    'THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated.',
  ];
  const origWarn = console.warn.bind(console);
  console.warn = (...args) => {
    const msg = String(args?.[0] ?? '');
    if (IGNORE.some((s) => msg.includes(s))) return;
    origWarn(...args);
  };
})()`,
          }}
        />
      </head>
      <body 
        className={`${inter.variable} ${sora.variable} ${jetbrainsMono.variable} font-sans`}
        style={{ 
          backgroundColor: 'var(--background)', 
          color: 'var(--foreground)',
          fontFamily: 'var(--font-body)'
        }}
      >
        {children}
      </body>
    </html>
  );
}
