import { PayloadRequest, PayloadHandler } from 'payload'
import { Order, Customer, OrderItem } from '../payload-types'

export const sendOrderHelp: PayloadHandler = async (req: PayloadRequest): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const { user, payload } = req
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  try {
    const json = typeof req.json === 'function' ? await req.json() : {}
    const { orderId, concern, screenshot, screenshots, customerEmail: bodyEmail, customerName: bodyName } = (json || {}) as { 
      orderId: string, 
      concern: string, 
      screenshot?: string, // Legacy support
      screenshots?: string[], // New support
      customerEmail?: string,
      customerName?: string
    }

    if (!orderId || !concern) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 })
    }

    // Fetch the order to verify ownership and get details
    // We cast to Order to ensure we have the correct type
    const order = await payload.findByID({
      collection: 'orders',
      id: orderId,
    }) as unknown as Order

    if (!order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404 })
    }

    // Verify ownership
    // Order has `customer` field which links to Customer collection
    // Customer has `user` field which links to User collection
    
    let customerId: number
    if (typeof order.customer === 'object' && order.customer !== null) {
      customerId = (order.customer as Customer).id
    } else {
      customerId = order.customer as number
    }

    // Fetch customer to check user link
    const customer = await payload.findByID({
        collection: 'customers',
        id: customerId,
    }) as unknown as Customer

    if (!customer) {
        return new Response(JSON.stringify({ error: 'Customer record not found' }), { status: 404 })
    }

    const customerUserId = typeof customer.user === 'object' && customer.user !== null 
        ? (customer.user as any).id 
        : customer.user

    const isOwner = customerUserId === user.id
    const isAdmin = user.role === 'admin' || user.role === 'service'

    if (!isOwner && !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    }

    let customerName = bodyName || 'Unknown'
    let customerEmail = bodyEmail || user.email

    if (!bodyName && (user.firstName || user.lastName)) {
      customerName = `${user.firstName || ''} ${user.lastName || ''}`.trim()
    }

    // Fetch order items
    const itemsResult = await payload.find({
        collection: 'order-items',
        where: {
            order: {
                equals: orderId
            }
        },
        pagination: false,
        depth: 0
    })

    const orderItems = itemsResult.docs as unknown as OrderItem[]
    let productDetails = ''

    if (orderItems.length > 0) {
        const itemLines = orderItems.map(item => {
            const name = item.product_name_snapshot || 'Product'
            const qty = item.quantity || 1
            return `${qty}x ${name}`
        })
        productDetails = itemLines.join(', ')
    } else {
        productDetails = 'No items found'
    }

    const apiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'support@kuyacares.com'
    const fromName = process.env.EMAIL_FROM_NAME || 'Kuya Cares Support'
    const replyTo = process.env.EMAIL_REPLY_TO || fromEmail
    const toEmail = 'johnlloydcallao@gmail.com'

    if (!apiKey) {
      console.error('RESEND_API_KEY is missing')
      return new Response(JSON.stringify({ error: 'Email service not configured' }), { status: 500 })
    }

    const attachments: { content: string; filename: string }[] = []

    // Handle legacy single screenshot
    if (screenshot) {
      let filename = 'screenshot.jpg'
      if (screenshot.startsWith('data:image/png')) filename = 'screenshot.png'
      else if (screenshot.startsWith('data:image/jpeg')) filename = 'screenshot.jpg'
      else if (screenshot.startsWith('data:image/webp')) filename = 'screenshot.webp'
      else if (screenshot.startsWith('data:image/gif')) filename = 'screenshot.gif'

      const content = screenshot.includes('base64,') ? screenshot.split('base64,')[1] : screenshot

      attachments.push({
        content,
        filename,
      })
    }

    // Handle multiple screenshots
    if (screenshots && Array.isArray(screenshots)) {
      screenshots.forEach((shot, index) => {
        let filename = `screenshot-${index + 1}.jpg`
        if (shot.startsWith('data:image/png')) filename = `screenshot-${index + 1}.png`
        else if (shot.startsWith('data:image/jpeg')) filename = `screenshot-${index + 1}.jpg`
        else if (shot.startsWith('data:image/webp')) filename = `screenshot-${index + 1}.webp`
        else if (shot.startsWith('data:image/gif')) filename = `screenshot-${index + 1}.gif`

        const content = shot.includes('base64,') ? shot.split('base64,')[1] : shot

        attachments.push({
          content,
          filename,
        })
      })
    }

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: toEmail,
        reply_to: customerEmail,
        subject: `Help Request for Order #${orderId}`,
        html: `
          <h2>Help Request for Order #${orderId}</h2>
          <p><strong>Customer:</strong> ${customerName} (${customerEmail})</p>
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p><strong>Products:</strong> ${productDetails}</p>
          <hr />
          <h3>Concern:</h3>
          <p style="white-space: pre-wrap;">${concern}</p>
          <hr />
          <p><i>This email was sent from the Kuya Cares Help Center.</i></p>
        `,
        attachments: attachments.length > 0 ? attachments : undefined
      }),
    })

    if (!emailRes.ok) {
      const err = await emailRes.text()
      console.error('Resend Error:', err)
      return new Response(JSON.stringify({ error: 'Failed to send email' }), { status: 500 })
    }

    return new Response(JSON.stringify({ success: true, message: 'Help request sent' }), { status: 200 })

  } catch (error) {
    console.error('Error in sendOrderHelp:', error)
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 })
  }
}
