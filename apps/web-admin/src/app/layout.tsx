import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import { InstantLoadingController } from "@/components/loading";
import { getServerToken, getServerUser } from "@/app/actions/auth";
import { Providers } from "@/app/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tap2Go Admin Dashboard",
  description: "Admin dashboard for managing the Tap2Go platform",
  keywords: "admin dashboard, platform management, user management, Tap2Go",
  authors: [{ name: "Tap2Go Admin Team" }],
  robots: "noindex, nofollow",
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/logo.png", type: "image/png" }],
    apple: [{ url: "/logo.png" }],
  },
  openGraph: {
    title: "Tap2Go Admin Dashboard",
    description: "Admin dashboard for managing the Tap2Go platform.",
    type: "website",
  },
};

// Proper React 19 layout props type
type LayoutProps = {
  children: React.ReactNode;
};

export default async function RootLayout({ children }: LayoutProps) {
  const initialUser = await getServerUser();
  const initialToken = await getServerToken();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
          integrity="sha512-iecdLmaskl7CVkqkXNQ/ZH/XLlvWZOJyj7Yy7tcenmpD1ypASozpmT/E0iPtmFIB46ZmdtAc9eNBvH0H/ZpiBw=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Instant Loading Screen - Shows immediately on page load */}
        <div id="instant-loading-screen" className="facebook-loading-screen">
          <div className="facebook-loading-overlay">
            <div className="facebook-loading-content">
              {/* Company Logo Animation */}
              <div className="facebook-logo-container">
                <div className="facebook-logo">
                  {/* @ts-ignore -- Next.js Image component type issue with React 19 */}
                  <Image
                    src="/logo.png"
                    alt="Tap2Go Admin Logo"
                    width={48}
                    height={48}
                    className="facebook-logo-image"
                    priority
                    style={{ objectFit: 'contain' }}
                  />
                </div>

                {/* Pulsing Ring Animation */}
                <div className="facebook-pulse-ring"></div>
                <div className="facebook-pulse-ring facebook-pulse-ring-delay"></div>
              </div>

              {/* Loading Text */}
              <div className="facebook-loading-text">
                <h2>Tap2Go Admin</h2>
                <p>Loading your dashboard...</p>
              </div>

              {/* Progress Bar */}
              <div className="facebook-progress-container">
                <div className="facebook-progress-bar">
                  <div className="facebook-progress-fill" style={{ width: '30%' }}></div>
                </div>
                <div className="facebook-progress-dots">
                  <div className="facebook-dot facebook-dot-1"></div>
                  <div className="facebook-dot facebook-dot-2"></div>
                  <div className="facebook-dot facebook-dot-3"></div>
                </div>
              </div>
            </div>

            {/* Background Pattern */}
            <div className="facebook-bg-pattern">
              <div className="facebook-bg-circle facebook-bg-circle-1"></div>
              <div className="facebook-bg-circle facebook-bg-circle-2"></div>
              <div className="facebook-bg-circle facebook-bg-circle-3"></div>
            </div>
          </div>
        </div>

        <Providers initialUser={initialUser} initialToken={initialToken}>
          {/* Inside Providers so it can never throw "No QueryClient set" */}
          <InstantLoadingController />
          {children}
        </Providers>
      </body>
    </html>
  );
}
