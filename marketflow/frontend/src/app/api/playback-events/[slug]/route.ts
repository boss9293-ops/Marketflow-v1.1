import { NextResponse } from 'next/server'
import { resolveBackendBaseUrl } from '@/lib/backendApi'

type Params = {
  params: {
    slug: string
  }
}

export async function GET(_request: Request, { params }: Params) {
  const slug = params.slug
  if (!/^[a-z0-9-]+$/i.test(slug)) {
    return NextResponse.json({ error: 'invalid slug' }, { status: 400 })
  }

  try {
    const BACKEND_URL = resolveBackendBaseUrl()
    const res = await fetch(`${BACKEND_URL}/api/playback-events/${slug}`, {
      cache: 'no-store',
    })
    
    if (!res.ok) {
      return NextResponse.json({ error: 'not found' }, { status: res.status })
    }
    
    const markdown = await res.text()
    return new NextResponse(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return NextResponse.json({ error: 'failed to fetch playback event' }, { status: 500 })
  }
}
