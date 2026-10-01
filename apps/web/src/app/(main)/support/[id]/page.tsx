import { notFound, redirect } from 'next/navigation';
import { getServerUser } from '@/app/actions/auth';
import { fetchSupportThread } from '../actions';
import TicketDetailPageClient from './TicketDetailPageClient';

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function TicketDetailPage({ params }: PageProps) {
  const user = await getServerUser();

  if (!user) {
    redirect('/signin');
  }

  const { id } = await params;
  const initialThread = await fetchSupportThread(id);

  if (!initialThread) {
    notFound();
  }

  return <TicketDetailPageClient initialThread={initialThread} />;
}
