import { NextRequest, NextResponse } from 'next/server'
const CMS_BASE=(process.env.NEXT_PUBLIC_API_URL||'https://cms.tap2goph.com/api').replace(/\/+$/,'')
const AUTH_COOKIE='tap2go-merchant-token'
export async function GET(request: NextRequest){
  const token=request.cookies.get(AUTH_COOKIE)?.value
  if(!token) return NextResponse.json({error:'Unauthorized'},{status:401})
  const {searchParams}=new URL(request.url)
  try{
    const meRes=await fetch(`${CMS_BASE}/users/me?depth=2`,{headers:{Authorization:`JWT ${token}`}, cache:'no-store'})
    if(!meRes.ok) return NextResponse.json({error:'Unauthorized'},{status:401})
    const me=await meRes.json()
    const user=me?.user
    if(!user || user.role!=='vendor') return NextResponse.json({error:'Vendor access required'},{status:403})
    const forward=new URLSearchParams(searchParams.toString())
    forward.set('userId', String(user.id))
    if(!forward.get('range')) forward.set('range','30d')
    const res=await fetch(`${CMS_BASE}/vendor/reports?${forward.toString()}`,{headers:{Authorization:`JWT ${token}`}, cache:'no-store'})
    if(!res.ok) return NextResponse.json({error:'Failed to load vendor reports'},{status:res.status})
    const data=await res.json()
    const headers=new Headers({'Content-Type':'application/json'})
    const cacheStatus=res.headers.get('X-VendorReports-Cache')
    if(cacheStatus) headers.set('X-VendorReports-Cache',cacheStatus)
    return NextResponse.json(data,{headers})
  }catch{
    return NextResponse.json({error:'Failed to reach CMS'},{status:502})
  }
}
