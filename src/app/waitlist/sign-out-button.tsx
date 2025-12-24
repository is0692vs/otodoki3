"use client";

import { useFormStatus } from "react-dom";

export function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-6 py-2 text-sm text-gray-600 hover:text-gray-800 underline disabled:opacity-50"
    >
      {pending ? "処理中..." : "別のアカウントでログイン"}
    </button>
  );
}
