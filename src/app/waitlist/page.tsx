import { redirect } from "next/navigation";
import { Music } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";

export default async function WaitlistPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    console.error("Error getting user:", error);
    redirect("/login");
  }

  const user = data.user;

  const handleSignOut = async () => {
    "use server";
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Sign out error:", error);
    }
    redirect("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full text-center bg-white p-8 rounded-xl shadow-lg">
        <div className="mb-4 flex justify-center">
          <Music className="h-16 w-16 text-blue-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">ウェイトリスト</h1>
        <p className="text-gray-600 mb-6">
          otodoki3 は現在クローズドベータ中です。
          <br />
          招待をお待ちください！
        </p>
        {user?.email && (
          <p className="text-sm text-gray-500 mb-4">
            現在は {user.email}{" "}
            でログインしています。招待が届くまで少々お待ちください。
          </p>
        )}
        <form action={handleSignOut}>
          <SignOutButton />
        </form>
      </div>
    </div>
  );
}
