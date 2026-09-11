import { redirect } from 'next/navigation'
export default function PaymentsRedirect() {
  redirect('/settings/configuration?tab=payments')
}
