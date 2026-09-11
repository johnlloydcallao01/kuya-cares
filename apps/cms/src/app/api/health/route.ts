export const dynamic = 'force-static'

export const GET = async () => {
  return Response.json(
    {
      status: 'ok',
      service: '@encreasl/cms',
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  )
}
