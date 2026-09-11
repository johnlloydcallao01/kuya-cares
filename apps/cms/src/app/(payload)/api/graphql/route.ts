/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import config from '@payload-config'
import { GRAPHQL_POST } from '@payloadcms/next/routes'
import type { NextRequest } from 'next/server'

export const POST = GRAPHQL_POST(config)

export const OPTIONS = async (_req: NextRequest) => {
  return new Response(null, { status: 204 })
}
