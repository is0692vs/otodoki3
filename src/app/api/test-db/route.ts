// src/app/api/test-db/route.ts
import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        // 接続確認のため、track_pool テーブルから1件取得を試みる
        const { error } = await supabase
            .from('track_pool')
            .select('track_id')
            .limit(1)
            .maybeSingle()

        if (error) {
            console.error('Supabase error:', error)
            throw error
        }

        return NextResponse.json({
            status: 'connected',
            message: 'Supabase connection successful',
        })
    } catch (err) {
        console.error('Catch error:', err)
        return NextResponse.json(
            {
                status: 'error',
                message: err instanceof Error ? err.message : 'An internal server error occurred.',
            },
            { status: 500 }
        )
    }
}