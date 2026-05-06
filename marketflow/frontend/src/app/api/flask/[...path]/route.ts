import { NextRequest, NextResponse } from 'next/server'
import { backendApiUrl } from '@/lib/backendApi'

async function proxy(req: NextRequest, params: Promise<{ path: string[] }>) {
  const { path } = await params
  const pathStr = path.join('/')
  const url = `${backendApiUrl(pathStr)}${req.nextUrl.search}`

  const contentType = req.headers.get('Content-Type') || 'application/json'
  const body =
    req.method !== 'GET' && req.method !== 'HEAD'
      ? await req.arrayBuffer()
      : undefined

  const resp = await fetch(url, {
    method: req.method,
    headers: { 'Content-Type': contentType },
    body: body ? Buffer.from(body) : undefined,
    cache: 'no-store',
  })

  const data = await resp.arrayBuffer()
  return new NextResponse(data, {
    status: resp.status,
    headers: {
      'Content-Type': resp.headers.get('Content-Type') || 'application/json',
    },
  })
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx.params)
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx.params)
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx.params)
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx.params)
}
