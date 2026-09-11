import { redirect } from 'next/navigation'
export default function GeneralRedirect() {
  redirect('/settings/configuration?tab=general')
}
