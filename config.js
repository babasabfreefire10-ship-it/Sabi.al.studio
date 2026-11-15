// =========================================================================
// Mjegulla AI Studio - Skedari i Konfigurimit (config.js)
// Vendosni çelësat tuaj këtu një herë të vetme dhe ata lidhen automatikisht
// me index.html pa pasur nevojë t'i shkruani në faqen web.
// =========================================================================

window.MJEGULLA_CONFIG = {
    // 1. Çelësi API i AI (Merrni një çelës falas në: https://aistudio.google.com/apikey)
    AI_PROVIDER: "gemini", // Mund të jetë "gemini" ose "openai"
    AI_API_KEY: "",        // P.sh. "AIzaSyD..." (Nëse lihet bosh, punon me Demo)

    // 2. Databaza Online Supabase (Merrni falas në: https://supabase.com/)
    SUPABASE_URL: "",      // P.sh. "https://xyzproject.supabase.co"
    SUPABASE_ANON_KEY: "", // P.sh. "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

    // 3. Cilësimet e Administratorit Kryesor
    ADMIN_EMAIL: "admin@sabi",
    ADMIN_PASS: "sabi007",
    DEFAULT_FREE_CREDITS: 20
};
