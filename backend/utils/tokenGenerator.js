import { supabase } from "../db.js";

export const generateDailyToken = async () => {

    // Aaj ki date
    const today = new Date()
        .toISOString()
        .split("T")[0];


    // Aaj ka sabse bada token find karo
    const { data, error } = await supabase
        .from("orders")
        .select("token_number")
        .eq("token_date", today)
        .order("token_number", {
            ascending: false
        })
        .limit(1);


    if (error) {
        throw error;
    }


    // Agar aaj koi order nahi hai
    if (!data || data.length === 0) {

        return {
            token_number: 1,
            token_date: today
        };

    }


    // Last token + 1
    return {

        token_number:
            data[0].token_number + 1,

        token_date: today

    };

};