import { createClient} from "@supabase/supabase-js";

const supabaseUrl =  process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonkey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if( !supabaseUrl || supabaseAnonkey) {
    throw new Error("Missing supabase environment variables.");
}

export const supabase = createClient(
    supabaseUrl,
    supabaseAnonkey
);