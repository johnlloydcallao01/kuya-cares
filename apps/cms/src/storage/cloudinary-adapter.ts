import type { Adapter, GeneratedAdapter } from '@payloadcms/plugin-cloud-storage/types'
import { v2 as cloudinary } from 'cloudinary'
import type { UploadApiResponse } from 'cloudinary'

export interface CloudinaryAdapterArgs {
  cloudName: string
  apiKey: string
  apiSecret: string
  folder?: string
}

export const cloudinaryAdapter = ({
  cloudName,
  apiKey,
  apiSecret,
  folder = 'uploads',
}: CloudinaryAdapterArgs): Adapter => {
  return ({ collection: _collection, prefix }) => {
    // Resolve at request time, not just at module init: the adapter args are
    // captured when payload.config is evaluated, but the Cloud Run runtime var
    // is the source of truth. Never fall back to a NEXT_PUBLIC_* value (it is
    // inlined at `next build` time and can be a stale `build-placeholder`).
    const resolveCloudName = () =>
      process.env.CLOUDINARY_CLOUD_NAME || cloudName || ''
    const resolveApiKey = () => process.env.CLOUDINARY_API_KEY || apiKey || ''
    const resolveApiSecret = () =>
      process.env.CLOUDINARY_API_SECRET || apiSecret || ''

    const assertConfigured = () => {
      const name = resolveCloudName()
      if (!name || name === 'build-placeholder') {
        throw new Error(
          'Cloudinary is not configured: set the CLOUDINARY_CLOUD_NAME ' +
            'runtime env var on Cloud Run (server-only; no rebuild needed). ' +
            `Got ${JSON.stringify(name)}. ` +
            'Do NOT use NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME — it is inlined at build time.',
        )
      }
      if (!resolveApiKey() || !resolveApiSecret()) {
        throw new Error(
          'Cloudinary is not configured: missing CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET.',
        )
      }
      return name
    }

    // Configure Cloudinary
    cloudinary.config({
      cloud_name: resolveCloudName() || cloudName,
      api_key: resolveApiKey() || apiKey,
      api_secret: resolveApiSecret() || apiSecret,
    })

    const adapter: GeneratedAdapter = {
      name: 'cloudinary',
    // Handle file upload to Cloudinary
    handleUpload: async ({ file, data }) => {
      const effectiveCloudName = assertConfigured()
      // Re-apply live runtime credentials (module-init values may predate them).
      cloudinary.config({
        cloud_name: effectiveCloudName,
        api_key: resolveApiKey(),
        api_secret: resolveApiSecret(),
      })
      console.log('=== CLOUDINARY UPLOAD START ===')
      console.log('Environment:', process.env.NODE_ENV)
      console.log('File info:', {
        filename: file.filename,
        size: file.buffer?.length,
        mimeType: file.mimeType,
      })
      console.log('Cloudinary config:', {
        cloudName: effectiveCloudName,
        apiKeyPresent: !!apiKey,
        apiSecretPresent: !!apiSecret,
        folder: folder,
        prefix: prefix,
      })

      try {
        const uploadOptions = {
          folder: prefix ? `${folder}/${prefix}` : folder,
          public_id: file.filename.replace(/\.[^/.]+$/, ''), // Remove file extension
          use_filename: true,
          unique_filename: false,
          overwrite: false,
          resource_type: 'auto' as const,
        }

        console.log('Upload options:', uploadOptions)

        const result: UploadApiResponse = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
              if (error) {
                console.error('Cloudinary stream error:', error)
                reject(error)
              } else {
                console.log('Cloudinary upload success:', {
                  public_id: result!.public_id,
                  secure_url: result!.secure_url,
                  bytes: result!.bytes,
                })
                resolve(result!)
              }
            }
          )

          uploadStream.end(file.buffer)
        })

        // Update the data object with Cloudinary information
        data.cloudinaryPublicId = result.public_id
        data.cloudinaryURL = result.secure_url
        data.url = result.secure_url
        data.filename = result.public_id
        data.filesize = result.bytes
        data.width = result.width
        data.height = result.height
        data.mimeType = `${result.resource_type}/${result.format}`

        console.log('=== CLOUDINARY UPLOAD SUCCESS ===')
      } catch (error) {
        console.error('=== CLOUDINARY UPLOAD ERROR ===')
        console.error('Error type:', typeof error)
        console.error('Error message:', error instanceof Error ? error.message : String(error))
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
        console.error('Full error object:', error)
        console.error('=== END CLOUDINARY ERROR ===')
        throw error
      }
    },

    // Handle file deletion from Cloudinary
    handleDelete: async ({ doc, filename }) => {
      try {
        const docWithCloudinary = doc as { cloudinaryPublicId?: string }
        const publicId = docWithCloudinary.cloudinaryPublicId || filename
        await cloudinary.uploader.destroy(publicId)
      } catch (error) {
        console.error('Cloudinary delete error:', error)
        throw error
      }
    },

    // Generate URL for file
    generateURL: ({ filename }) => {
      return cloudinary.url(filename, {
        secure: true,
        fetch_format: 'auto',
        quality: 'auto',
      })
    },

    // Handle static file requests (redirect to Cloudinary CDN)
    staticHandler: async (req, { params }) => {
      const { filename } = params
      const cloudinaryURL = cloudinary.url(filename, {
        secure: true,
        fetch_format: 'auto',
        quality: 'auto',
      })

      return Response.redirect(cloudinaryURL, 302)
    },

    // Additional fields to store Cloudinary metadata
    fields: [
      {
        name: 'cloudinaryPublicId',
        type: 'text',
        admin: {
          readOnly: true,
        },
      },
      {
        name: 'cloudinaryURL',
        type: 'text',
        admin: {
          readOnly: true,
        },
      },
    ],
  }

  return adapter
  }
}
