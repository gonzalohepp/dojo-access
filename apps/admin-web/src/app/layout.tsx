import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: {
    default: "Beleza Dojo | Jiu Jitsu, MMA y Grappling en Quilmes",
    template: "%s | Beleza Dojo",
  },
  description:
    "Academia de Jiu Jitsu, MMA y preparación física en Quilmes. Entrená para mejorar tu rendimiento y alcanzar tu mejor versión.",
  icons: {
    icon: [
      { url: "/logo.png" },
      { url: "/logo.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/logo.png",
    apple: [{ url: "/logo.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.json",
  metadataBase: new URL("https://belezadojo.com.ar"),
}

import { Providers } from "./providers"

// ... imports

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning={true}>
      <head>
        {/* ... script ... */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
               (function() {
                 try {
                   var theme = localStorage.getItem('theme');
                   var supportDark = window.matchMedia('(prefers-color-scheme: dark)').matches === true;
                   if (theme === 'dark' || (!theme && supportDark)) {
                     document.documentElement.classList.add('dark');
                   }
                 } catch (e) {}
               })();
             `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased selection:bg-blue-500/30`}
        suppressHydrationWarning
      >
        <Providers>
          <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  )
}
