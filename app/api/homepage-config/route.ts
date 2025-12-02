import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const timestamp = new Date().toISOString()
    console.log(`[API] GET /api/homepage-config - ${timestamp}`)
    console.log('[API] Request URL:', request.url)
    console.log('[API] Request headers:', Object.fromEntries(request.headers.entries()))
    
    const config = await db.getHomepageConfig()
    console.log('[API] ✅ Config fetched from Supabase:', JSON.stringify(config, null, 2))
    console.log('[API] Title:', config.title)
    console.log('[API] Description:', config.description)
    
    // 응답 데이터 검증
    if (!config || typeof config !== 'object' || !('title' in config) || !('description' in config)) {
      console.error('[API] ❌ Invalid config format:', config)
      throw new Error('Invalid config format received from database')
    }
    
    // 응답에 ETag 추가하여 캐시 무효화 강화
    const etag = `"${Date.now()}-${Math.random()}"`
    
    const response = NextResponse.json(config, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, private',
        'Pragma': 'no-cache',
        'Expires': '0',
        'ETag': etag,
        'X-Content-Type-Options': 'nosniff',
        'Content-Type': 'application/json; charset=utf-8',
        'Last-Modified': new Date().toUTCString(),
        'X-Timestamp': new Date().getTime().toString(),
        'X-Config-Title': config.title, // 디버깅용 헤더
        'X-Config-Description-Length': config.description.length.toString(), // 디버깅용 헤더
      },
    })
    
    console.log('[API] ✅ Response created with config:', {
      title: config.title,
      descriptionLength: config.description.length,
      descriptionPreview: config.description.substring(0, 50) + '...'
    })
    return response
  } catch (error) {
    console.error('[API] GET /api/homepage-config - Error:', error)
    if (error instanceof Error) {
      console.error('[API] Error message:', error.message)
      console.error('[API] Error stack:', error.stack)
    }
    
    // 에러 발생 시에도 기본값 반환 (500 에러 대신)
    const defaultConfig = {
      title: '퇴원환자 친절도 설문',
      description: '환자 만족도 조사를 위한 설문 시스템입니다. 참여를 통해 더 나은 서비스를 만들어주세요.',
    }
    
    console.log('[API] Returning default config due to error:', JSON.stringify(defaultConfig, null, 2))
    
    const errorResponse = NextResponse.json(defaultConfig, {
      status: 200, // 에러가 있어도 200으로 반환하여 클라이언트가 기본값을 사용할 수 있도록
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Error': 'true',
      },
    })
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

    console.log('[API] PUT /api/homepage-config - Updating config:', { title, description })
    
    // 입력값 정규화
    const normalizedTitle = title.trim()
    const normalizedDescription = description.trim()
    
    console.log('[API] PUT /api/homepage-config - Normalized values:', { 
      title: normalizedTitle, 
      description: normalizedDescription 
    })
    
    const config = await db.updateHomepageConfig({ 
      title: normalizedTitle, 
      description: normalizedDescription 
    })
    
    console.log('[API] PUT /api/homepage-config - Config updated successfully:', JSON.stringify(config, null, 2))
    
    // 응답 데이터 검증
    if (!config || typeof config !== 'object' || !config.title || !config.description) {
      console.error('[API] PUT /api/homepage-config - Invalid config returned from DB:', config)
      throw new Error('Invalid config returned from database')
    }
    
    const response = NextResponse.json(config, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, private',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Content-Type': 'application/json; charset=utf-8',
        'Last-Modified': new Date().toUTCString(),
      },
    })
    
    console.log('[API] PUT /api/homepage-config - Response created:', JSON.stringify(config, null, 2))
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

