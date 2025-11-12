import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const config = await db.getHomepageConfig()
    const response = NextResponse.json(config)
    // 캐시 제어 헤더 추가
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
  } catch (error) {
    console.error('Failed to fetch homepage config:', error)
    const errorResponse = NextResponse.json(
      { error: 'Failed to fetch homepage config' },
      { status: 500 }
    )
    errorResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
    return errorResponse
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description } = body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      )
    }

    console.log('Updating homepage config:', { title, description })
    const config = await db.updateHomepageConfig({ title, description })
    console.log('Homepage config updated successfully:', config)
    const response = NextResponse.json(config)
    // 캐시 제어 헤더 추가
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
  } catch (error) {
    console.error('Failed to update homepage config:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorDetails = error instanceof Error ? error.stack : undefined
    console.error('Error details:', errorDetails)
    const errorResponse = NextResponse.json(
      { 
        error: 'Failed to update homepage config',
        details: errorMessage,
      },
      { status: 500 }
    )
    errorResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
    return errorResponse
  }
}

