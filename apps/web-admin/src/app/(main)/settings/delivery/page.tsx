import { redirect } from 'next/navigation'
export default function DeliveryRedirect() {
  redirect('/settings/configuration?tab=delivery')
}
