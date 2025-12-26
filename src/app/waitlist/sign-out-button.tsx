"use client";

import { useFormStatus } from "react-dom";

export function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-6 py-2 text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 bg-gray-200 hover:bg-gray-300 text-gray-800 disabled:opacity-50"
    >
      {pending ? "処理中..." : "別のアカウントでログイン"}
    </button>
  );
}
