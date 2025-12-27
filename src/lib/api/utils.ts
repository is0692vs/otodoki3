/**
 * API レスポンスの Content-Type を検証し、JSON をパースする共通ユーティリティ
 * テスト環境でのモック対応のため optional chaining を使用
 */
export async function parseJsonResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers?.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Expected JSON but received:", text.substring(0, 100));
        throw new Error(
            "サーバーから予期しないレスポンス（HTML）が返されました。ログイン状態を確認してください。"
        );
    }
    return response.json();
}
