"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({ collapsed = false }: { collapsed?: boolean }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function signOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <button className="sign-out" onClick={signOut} disabled={loading} title="Sign out">
      <LogOut />{!collapsed && <span>{loading ? "Signing out…" : "Sign out"}</span>}
    </button>
  );
}
