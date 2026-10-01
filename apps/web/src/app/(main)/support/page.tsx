import { redirect } from 'next/navigation';
import { getServerUser } from '@/app/actions/auth';
import { fetchSupportTickets } from './actions';
import SupportPageClient from './SupportPageClient';

export default async function SupportPage() {
  const user = await getServerUser();

  if (!user) {
    redirect('/signin');
  }

  const initialTickets = await fetchSupportTickets();
  return <SupportPageClient initialTickets={initialTickets} />;
}
