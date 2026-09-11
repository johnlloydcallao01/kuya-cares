'use client'

import type { DefaultCellComponentProps } from 'payload'

type MediaRowData = {
  alt?: string | null
  cloudinaryURL?: string | null
  mimeType?: string | null
  url?: string | null
}

const MediaImageCell = ({ rowData }: DefaultCellComponentProps) => {
  const row = (rowData ?? {}) as MediaRowData
  const src = row.cloudinaryURL || row.url
  const isVideo = row.mimeType?.startsWith('video/')

  if (!src) {
    return <span>—</span>
  }

  return (
    <div style={{ width: '64px', height: '44px' }}>
      {isVideo ? (
        <video
          src={src}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          muted
          preload="metadata"
        />
      ) : (
        <img
          src={src}
          alt={row.alt ?? ''}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
    </div>
  )
}

export default MediaImageCell
