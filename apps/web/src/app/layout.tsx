import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getServerToken, getServerUser } from "@/app/actions/auth";
import { Providers } from "@/app/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Kuya Cares",
  description: "Food delivery from Laguna",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/favicon.png" }],
  },
};

type LayoutProps = {
  children: React.ReactNode;
};

export default async function RootLayout({ children }: LayoutProps) {
  const initialUser = await getServerUser();
  const initialToken = await getServerToken();
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers initialUser={initialUser} initialToken={initialToken}>
          {children}
        </Providers>
      </body>
    </html>
  );
}