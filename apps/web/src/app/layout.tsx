'use client';

import { Inter } from 'next/font/google';
import { AuthProvider } from '@/contexts/AuthContext';
import { AuthErrorBoundary } from '@/components/auth/AuthErrorBoundary';
import { LoadingScreenWrapper } from '@/components/loading/LoadingScreenWrapper';
import { ToasterProvider } from '@/components/toast/ToasterProvider';
import { CartProvider } from '@/contexts/CartContext';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthErrorBoundary>
          <AuthProvider>
            <CartProvider>
              <LoadingScreenWrapper>
                {children}
              </LoadingScreenWrapper>
            </CartProvider>
          </AuthProvider>
          <ToasterProvider />
        </AuthErrorBoundary>
      </body>
    </html>
  );
}
