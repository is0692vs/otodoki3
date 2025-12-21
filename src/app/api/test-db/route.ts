// src/app/api/test-db/route.ts
import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        // RPC経由で現在時刻を取得（テーブル不要）
        // Supabase の型定義は登録済みの RPC 名（例: 'trim_track_pool'）に限定しているため、
        // テスト用に存在しない汎用的な 'now' を呼ぶために型を一旦無効化します。
        const { data, error } = await supabase.rpc('now' as unknown as never).maybeSingle()

        if (error) {
            console.error('Supabase error:', error)
            // rpcが無くてもエラーコードで接続確認
            if (error.code === 'PGRST202') {
                // function not found = 接続自体はOK
                return NextResponse.json({
                    status: 'connected',
                    message: 'Supabase connection OK (no RPC defined)',
                })
            }
            throw error
        }

        return NextResponse.json({
            status: 'connected',
            message: 'Supabase connection successful',
            serverTime: data,
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