import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCached, setCached } from '@encreasl/cache'

function getNum(v: unknown, fb = 0): number { if (typeof v === 'number' && Number.isFinite(v)) return v; if (typeof v === 'string') return parseFloat(v) || fb; return fb }
function getStr(v: unknown, fb = ''): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    if ('outletName' in o) return String(o.outletName ?? fb)
    if ('businessName' in o) return String(o.businessName ?? fb)
    if ('name' in o) return String(o.name ?? fb)
  }
  return fb
}
function resolveId(v: unknown): string { if (v==null) return ''; if (typeof v==='string'||typeof v==='number') return String(v); if (typeof v==='object'&&v!==null&&'id' in (v as any)) return String((v as any).id); return '' }
function parseRange(sp: URLSearchParams){ const r=(sp.get('range')||'30d').toLowerCase(); if(r==='7d')return{days:7,label:'7d'}; if(r==='30d')return{days:30,label:'30d'}; if(r==='90d')return{days:90,label:'90d'}; if(r==='1y'||r==='365d')return{days:365,label:'1y'}; if(r==='all')return{days:0,label:'all'}; const p=parseInt(r,10); if(!isNaN(p)&&p>0)return{days:p,label:`${p}d`}; return{days:30,label:'30d'} }

export async function GET(request: NextRequest){
  try{
    const payload=await getPayload({config:configPromise})
    const {searchParams}=new URL(request.url)
    const userId=searchParams.get('userId')
    if(!userId) return NextResponse.json({error:'userId required'},{status:400})

    const cacheQuery = Array.from(searchParams.entries())
      .filter(([key]) => key !== '_t')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&') || 'range=30d'
    const cacheKey = `vendor:reports:${userId}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-VendorReports-Cache': 'HIT' } })

    const {days,label}=parseRange(searchParams)
    const now=new Date()
    const periodStart=days===0?null:new Date(now.getTime()-days*24*60*60*1000)

    const vendorsRes=await payload.find({collection:'vendors', where:{user:{equals:userId}}, limit:1, depth:0, overrideAccess:true})
    const vendor=vendorsRes.docs[0] as unknown as Record<string,unknown>|undefined
    if(!vendor) return NextResponse.json({error:'Vendor not found'},{status:404})
    const vendorId=String(vendor.id)
    const vendorName=getStr(vendor.businessName,'Vendor')

    const merchantsRes=await payload.find({collection:'merchants', where:{vendor:{equals:vendorId}}, limit:1000, depth:1, overrideAccess:true})
    const merchantsDocs=merchantsRes.docs as unknown as Record<string,unknown>[]
    const merchantMap=new Map<string,Record<string,unknown>>()
    merchantsDocs.forEach((m:any)=>merchantMap.set(String(m.id),m as Record<string,unknown>))
    const merchantIds=new Set(merchantsDocs.map((m)=>String(m.id)))
    if(merchantIds.size===0){
      const emptyBody = {
        meta:{range:label, days, generatedAt: now.toISOString(), vendorId, vendorName, periodStart: periodStart?periodStart.toISOString():null, periodEnd: now.toISOString()},
        summary:{totalRevenue:0,totalRefunded:0,netRevenue:0,totalOrders:0,avgOrder:0, paidCount:0, refundedCount:0, failedCount:0, totalOutlets:0},
        financialReconciliation:{rows:[], totals:{gross:0,platformFees:0,deliveryFees:0}, count:0},
        outletPayouts:{rows:[], count:0},
        orderVolume:{daily:[], totalOrders:0, totalRevenue:0},
        refundsFailures:{rows:[], count:0},
        productPerformance:{rows:[], count:0},
        deliveryLogistics:{totalBookings:0, byStatus:[], sampleRows:[]},
      }
      await setCached(cacheKey, emptyBody, 20)
      return NextResponse.json(emptyBody, { headers: { 'X-VendorReports-Cache': 'MISS' } })
    }
    const ordersRes=await payload.find({collection:'orders', where:{merchant:{in:Array.from(merchantIds)}}, limit:3000, sort:'-createdAt', depth:1, overrideAccess:true})
    const ordersDocs=ordersRes.docs as unknown as Record<string,unknown>[]
    const orderMap=new Map<string,Record<string,unknown>>()
    ordersDocs.forEach((o:any)=>orderMap.set(String(o.id),o as Record<string,unknown>))
    const orderIds=Array.from(new Set(ordersDocs.map(o=>String(o.id))))
    const transactionsRes= orderIds.length? await payload.find({collection:'transactions', where:{order:{in:orderIds}}, limit:3000, depth:0, overrideAccess:true}):{docs:[] as unknown[]}
    const transactionsDocs=transactionsRes.docs as unknown as Record<string,unknown>[]
    const orderItemsRes= orderIds.length? await payload.find({collection:'order-items', where:{order:{in:orderIds}}, limit:5000, depth:0, overrideAccess:true}):{docs:[] as unknown[]}
    const orderItemsDocs=orderItemsRes.docs as unknown as Record<string,unknown>[]
    const deliveryBookingsRes= orderIds.length? await payload.find({collection:'delivery-bookings', where:{order:{in:orderIds}}, limit:1000, depth:0, overrideAccess:true}):{docs:[] as unknown[]}
    const deliveryBookingsDocs=deliveryBookingsRes.docs as unknown as Record<string,unknown>[]

    function isInPeriod(doc:Record<string,unknown>, field:string):boolean{
      if(!periodStart) return true
      const raw=String(doc[field]??doc.createdAt??'')
      const d=new Date(raw)
      return !isNaN(d.getTime()) && d>=periodStart && d<=now
    }
    const ordersPeriod=ordersDocs.filter(o=>isInPeriod(o as Record<string,unknown>,'createdAt'))
    const paidTxPeriod=transactionsDocs.filter(t=>String(t.status)==='paid' && isInPeriod(t as Record<string,unknown>,'paid_at'))
    const refundedTxPeriod=transactionsDocs.filter(t=>String(t.status)==='refunded' && isInPeriod(t as Record<string,unknown>,'createdAt'))
    const failedTxPeriod=transactionsDocs.filter(t=>String(t.status)==='failed' && isInPeriod(t as Record<string,unknown>,'createdAt'))

    const totalRevenue=paidTxPeriod.reduce((s,t)=>s+getNum(t.amount),0)
    const totalRefunded=refundedTxPeriod.reduce((s,t)=>s+getNum(t.amount),0)
    const netRevenue=totalRevenue-totalRefunded
    const totalOrders=ordersPeriod.length
    const avgOrder=totalOrders? totalRevenue/totalOrders:0

    const financialRows=paidTxPeriod.slice(0,200).map(t=>{
      const oid=resolveId(t.order)
      const order=oid?orderMap.get(oid):null
      const merchantRaw=order?(order.merchant as unknown):null
      const mObj=merchantRaw&&typeof merchantRaw==='object'?merchantRaw as Record<string,unknown>:null
      const mid=mObj?String(mObj.id??''):String(merchantRaw??'')
      const merchant=mid?merchantMap.get(mid):mObj
      const outName=merchant?getStr(merchant.outletName,`Outlet #${mid}`):'N/A'
      return { transactionId:String(t.id), orderId:oid||'—', date:String(t.paid_at??t.createdAt??''), outlet: outName, amount:getNum(t.amount), platformFee: order?getNum((order as any).platform_fee):0, deliveryFee: order?getNum((order as any).delivery_fee):0, status:String(t.status), paymentMethod:getStr(t.payment_method,'unknown'), gross: order?getNum((order as any).total):getNum(t.amount)}
    })

    // Outlet payouts (per outlet net)
    const outletAgg=new Map<string,{outletName:string; orders:number; gross:number; platformFees:number; deliveryFees:number; net:number}>()
    paidTxPeriod.forEach(t=>{
      const oid=resolveId(t.order)
      const order=oid?orderMap.get(oid):null
      if(!order) return
      const merchantRaw=order.merchant as unknown
      const mObj=merchantRaw&&typeof merchantRaw==='object'?merchantRaw as Record<string,unknown>:null
      const mid=mObj?String(mObj.id??''):String(merchantRaw??'')
      if(!mid) return
      const outlet=mid?merchantMap.get(mid):null
      const name=outlet?getStr(outlet.outletName, mid):getStr(mObj?.outletName, mid)
      const agg=outletAgg.get(mid)||{outletName:name, orders:0,gross:0,platformFees:0,deliveryFees:0,net:0}
      const amt=getNum(t.amount)
      agg.orders+=1; agg.gross+=amt; agg.platformFees+=getNum((order as any).platform_fee); agg.deliveryFees+=getNum((order as any).delivery_fee); agg.net+=Math.max(0, amt-getNum((order as any).platform_fee)-getNum((order as any).delivery_fee))
      outletAgg.set(mid,agg)
    })
    const outletPayouts=Array.from(outletAgg.entries()).map(([outletId,v])=>({outletId, ...v})).sort((a,b)=>b.gross-a.gross)

    const dailyMap=new Map<string,{date:string;orders:number;revenue:number}>()
    ordersPeriod.forEach(o=>{const d=new Date(String(o.createdAt??'')).toISOString().split('T')[0]; const e=dailyMap.get(d)||{date:d,orders:0,revenue:0}; e.orders+=1; dailyMap.set(d,e)})
    paidTxPeriod.forEach(t=>{const d=new Date(String(t.paid_at??t.createdAt??'')).toISOString().split('T')[0]; const e=dailyMap.get(d)||{date:d,orders:0,revenue:0}; e.revenue+=getNum(t.amount); dailyMap.set(d,e)})
    const orderVolumeDaily=Array.from(dailyMap.values()).sort((a,b)=>a.date.localeCompare(b.date))

    const paidOrderIds=new Set(paidTxPeriod.map(t=>resolveId(t.order)).filter(Boolean))
    const productAgg=new Map<string,{name:string;quantity:number;revenue:number;orders:number}>()
    orderItemsDocs.forEach(oi=>{const oid=resolveId(oi.order); if(!paidOrderIds.has(oid)) return; const name=getStr(oi.product_name_snapshot,'Unknown'); const key=String(oi.product??name); const e=productAgg.get(key)||{name,quantity:0,revenue:0,orders:0}; e.quantity+=getNum(oi.quantity); e.revenue+=getNum(oi.total_price); e.orders+=1; productAgg.set(key,e)})
    const productPerformance=Array.from(productAgg.entries()).map(([id,v])=>({id,...v})).sort((a,b)=>b.revenue-a.revenue).slice(0,20)

    const refundsRows=[...refundedTxPeriod,...failedTxPeriod].slice(0,100).map(t=>({transactionId:String(t.id), orderId:resolveId(t.order)||'—', date:String(t.createdAt??''), amount:getNum(t.amount), status:String(t.status), paymentMethod:getStr(t.payment_method,'unknown')}))

    const bookingsPeriod=deliveryBookingsDocs.filter(b=>{const oid=resolveId(b.order); const order=oid?orderMap.get(oid):null; return order? isInPeriod(order,'createdAt'):false})
    const deliveryByStatus=new Map<string,number>()
    bookingsPeriod.forEach(b=>{const s=getStr(b.status,'unknown'); deliveryByStatus.set(s,(deliveryByStatus.get(s)||0)+1)})

    const responseBody = {
      meta:{range:label, days, generatedAt: now.toISOString(), vendorId, vendorName, periodStart: periodStart?periodStart.toISOString():null, periodEnd: now.toISOString(), totalOrders: ordersDocs.length},
      summary:{totalRevenue,totalRefunded,netRevenue,totalOrders,avgOrder, paidCount:paidTxPeriod.length, refundedCount:refundedTxPeriod.length, failedCount:failedTxPeriod.length, totalOutlets: merchantsDocs.length},
      financialReconciliation:{rows:financialRows, totals:{gross:totalRevenue, platformFees: financialRows.reduce((s,r)=>s+r.platformFee,0), deliveryFees: financialRows.reduce((s,r)=>s+r.deliveryFee,0)}, count: financialRows.length, totalCount: paidTxPeriod.length},
      outletPayouts:{rows:outletPayouts, count: outletPayouts.length},
      orderVolume:{daily:orderVolumeDaily, totalOrders, totalRevenue},
      refundsFailures:{rows:refundsRows, count: refundsRows.length},
      productPerformance:{rows:productPerformance, count: productPerformance.length},
      deliveryLogistics:{totalBookings: bookingsPeriod.length, byStatus: Array.from(deliveryByStatus.entries()).map(([status,count])=>({status,count})), sampleRows: bookingsPeriod.slice(0,20).map((b:any)=>({orderId:resolveId(b.order), status:getStr(b.status), deliveryFee:getNum(b.delivery_fee), serviceType:getStr(b.service_type,'MOTORCYCLE'), driverName:getStr(b.driver_name,'—')}))},
    }
    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-VendorReports-Cache': 'MISS' } })
  }catch(e){
    console.error('Vendor reports error:',e)
    return NextResponse.json({error:'Failed to load vendor reports'},{status:500})
  }
}
