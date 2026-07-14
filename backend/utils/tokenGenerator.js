import { supabase } from "../db.js";

export const generateDailyToken = async () => {

    const { data, error } = await supabase.rpc("generate_daily_token");

    if (error) {
        throw error;
    }

    return {
        token_number: data[0].token_number,
        token_date: data[0].token_date,
    };

};