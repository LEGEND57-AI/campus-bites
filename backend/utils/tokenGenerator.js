import { supabase } from "../db.js";

export const generateDailyToken = async () => {

    // Aaj ki date
    const today = new Date()
        .toISOString()
        .split("T")[0];

    // 🔥 Atomic increment via Postgres function — no race condition possible
    const { data, error } = await supabase
        .rpc("get_next_token", { p_date: today });

    if (error) {
        throw error;
    }

    return {
        token_number: data,
        token_date: today
    };

};