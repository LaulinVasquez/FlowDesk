import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
    return await updateSession(request);

}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|auth/google|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
