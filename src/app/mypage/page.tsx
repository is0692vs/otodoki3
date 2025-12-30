import { createClient } from "@/lib/supabase/server";
import { Layout } from "@/components/Layout";
import { LogoutButton } from "./LogoutButton";
import { redirect } from "next/navigation";
import {
  User,
  Heart,
  XCircle,
  ListMusic,
  Settings,
  Info,
  ChevronRight,
} from "lucide-react";
import packageJson from "../../../package.json";

export default async function MyPage() {
  const supabase = await createClient();

  const authRes = await supabase.auth.getUser();
  const user = authRes.data?.user;
  const authError = authRes.error;

  if (authError || !user) {
    redirect("/login");
  }

  // Fetch stats in parallel (user-scoped)
  const [likesResult, dislikesResult, playlistsResult] = await Promise.all([
    supabase
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("dislikes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("playlists")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  // Log query errors for observability
  if (likesResult.error)
    console.error("Failed to fetch likes:", likesResult.error);
  if (dislikesResult.error)
    console.error("Failed to fetch dislikes:", dislikesResult.error);
  if (playlistsResult.error)
    console.error("Failed to fetch playlists:", playlistsResult.error);

  const likesCount = likesResult.count ?? 0;
  const dislikesCount = dislikesResult.count ?? 0;
  const playlistsCount = playlistsResult.count ?? 0;

  return (
    <Layout>
      <div className="p-6 pb-24 space-y-8">
        {/* Header */}
        <h1 className="text-2xl font-bold">マイページ</h1>

        {/* User Info */}
        <div className="flex items-center gap-4 p-4 glass rounded-2xl">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
            <User className="w-8 h-8 text-white/70" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white/50">ログイン中</p>
            <p className="font-medium truncate">{user?.email}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="glass p-4 rounded-2xl flex flex-col items-center justify-center gap-2">
            <Heart className="w-6 h-6 text-pink-400" />
            <span className="text-2xl font-bold">{likesCount || 0}</span>
            <span className="text-xs text-white/50">Likes</span>
          </div>
          <div className="glass p-4 rounded-2xl flex flex-col items-center justify-center gap-2">
            <XCircle className="w-6 h-6 text-blue-400" />
            <span className="text-2xl font-bold">{dislikesCount || 0}</span>
            <span className="text-xs text-white/50">Skips</span>
          </div>
          <div className="glass p-4 rounded-2xl flex flex-col items-center justify-center gap-2">
            <ListMusic className="w-6 h-6 text-purple-400" />
            <span className="text-2xl font-bold">{playlistsCount || 0}</span>
            <span className="text-xs text-white/50">Playlists</span>
          </div>
        </div>

        {/* Settings (Placeholder) */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold px-2">設定</h2>
          <div className="glass rounded-2xl overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b border-white/5 opacity-50">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5" />
                <span>一般設定</span>
              </div>
              <span className="text-xs bg-white/10 px-2 py-1 rounded">
                準備中
              </span>
            </div>
            <div className="p-4 flex items-center justify-between opacity-50">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full border border-white/30" />
                <span>テーマ切り替え</span>
              </div>
              <span className="text-xs bg-white/10 px-2 py-1 rounded">
                準備中
              </span>
            </div>
          </div>
        </div>

        {/* App Info */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold px-2">アプリ情報</h2>
          <div className="glass rounded-2xl overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-3">
                <Info className="w-5 h-5" />
                <span>バージョン</span>
              </div>
              <span className="text-white/50">{packageJson.version}</span>
            </div>
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-5" /> {/* Spacer for alignment */}
                <span>利用規約</span>
              </div>
              <ChevronRight className="w-5 h-5 text-white/30" />
            </div>
          </div>
        </div>

        <LogoutButton />
      </div>
    </Layout>
  );
}
