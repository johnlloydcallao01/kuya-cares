import { NextRequest } from 'next/server';
import { proxySellerTransactions } from '@/lib/sellerTransactionsProxy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return proxySellerTransactions(request);
}
