import { createClient} from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonkey = import.meta.env.VITE_SUPABASE_ANON_URL;

if( !supabaseUrl || supabaseAnonkey) {
    throw new Error("Missing supabase environment variables.");
}

export const supabase = createClient(
    supabaseUrl,
    supabaseAnonkey
);