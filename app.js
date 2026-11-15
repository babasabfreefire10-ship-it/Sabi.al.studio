/**
 * Sabi AI Studio - Sistemi i Menaxhimit të Krediteve, Klientëve dhe API-së (app.js)
 * Lidhet me index.html përmes: <script src="app.js"></script>
 */

const SABI_CONFIG = {
    adminEmail: "admin@sabi",
    adminPass: "sabi007",
    defaultFreeCredits: 20,
    storageKeyUsers: "sabi_studio_users_v1",
    storageKeySession: "sabi_studio_session_v1",
    storageKeyApi: "sabi_studio_api_v1"
};

class SabiPlatformEngine {
    constructor() {
        this.users = this.loadUsers();
        this.currentUser = this.loadSession();
        this.apiSettings = this.loadApiSettings();
        this.initAutoSync();
    }

    // Ngarkon listën e klientëve nga memoria (ose krijon bazën fillestare)
    loadUsers() {
        const saved = localStorage.getItem(SABI_CONFIG.storageKeyUsers);
        if (saved) {
            return JSON.parse(saved);
        }
        const initialUsers = {
            "sabi": { username: "sabi", credits: 20, role: "client", createdAt: new Date().toISOString() }
        };
        localStorage.setItem(SABI_CONFIG.storageKeyUsers, JSON.stringify(initialUsers));
        return initialUsers;
    }

    saveUsers() {
        localStorage.setItem(SABI_CONFIG.storageKeyUsers, JSON.stringify(this.users));
        window.dispatchEvent(new Event("sabi_data_updated"));
    }

    loadSession() {
        const session = localStorage.getItem(SABI_CONFIG.storageKeySession);
        return session ? JSON.parse(session) : null;
    }

    saveSession(userObj) {
        this.currentUser = userObj;
        if (userObj) {
            localStorage.setItem(SABI_CONFIG.storageKeySession, JSON.stringify(userObj));
        } else {
            localStorage.removeItem(SABI_CONFIG.storageKeySession);
        }
    }

    loadApiSettings() {
        const saved = localStorage.getItem(SABI_CONFIG.storageKeyApi);
        return saved ? JSON.parse(saved) : { provider: "live-free", apiKey: "", firebaseUrl: "" };
    }

    saveApiSettings(provider, apiKey, firebaseUrl = "") {
        this.apiSettings = { provider, apiKey, firebaseUrl };
        localStorage.setItem(SABI_CONFIG.storageKeyApi, JSON.stringify(this.apiSettings));
    }

    // Hyrja e Administratorit (admin@sabi / sabi007)
    loginAdmin(email, password) {
        if (email.trim().toLowerCase() === SABI_CONFIG.adminEmail && password === SABI_CONFIG.adminPass) {
            const adminSession = { username: "Admin Sabi", email: email, role: "admin", credits: Infinity };
            this.saveSession(adminSession);
            return { success: true, user: adminSession };
        }
        return { success: false, message: "Të dhënat e administratorit janë të gabuara." };
    }

    // Hyrja ose regjistrimi automatik i klientit me emër (p.sh. "sabi")
    loginClient(username) {
        const cleanName = username.trim().toLowerCase();
        if (!cleanName) {
            return { success: false, message: "Ju lutem shkruani emrin e përdoruesit." };
        }
        if (!this.users[cleanName]) {
            this.users[cleanName] = {
                username: cleanName,
                credits: SABI_CONFIG.defaultFreeCredits,
                role: "client",
                createdAt: new Date().toISOString()
            };
            this.saveUsers();
        }
        const clientSession = { ...this.users[cleanName] };
        this.saveSession(clientSession);
        return { success: true, user: clientSession };
    }

    logout() {
        this.saveSession(null);
    }

    // Kontrollon dhe zbret 1 kredit kur klienti gjeneron një aplikacion
    consumeCredit() {
        if (!this.currentUser) {
            return { allowed: false, reason: "Duhet të hyni si klient (p.sh. sabi) për të vazhduar." };
        }
        if (this.currentUser.role === "admin") {
            return { allowed: true, remaining: "∞" };
        }
        const uname = this.currentUser.username;
        const freshUser = this.users[uname];
        if (!freshUser || freshUser.credits <= 0) {
            return {
                allowed: false,
                remaining: 0,
                reason: "Kreditet tuaja kanë mbaruar (0). Hyni me emrin tuaj dhe kontaktoni adminin për rimbushje (+20, +50, +100)."
            };
        }
        freshUser.credits -= 1;
        this.users[uname] = freshUser;
        this.currentUser.credits = freshUser.credits;
        this.saveUsers();
        this.saveSession(this.currentUser);
        return { allowed: true, remaining: freshUser.credits };
    }

    // Funksioni i Adminit për t'i dërguar +20, +50 ose +100 kredite çdo klienti
    adminAddCredits(targetUsername, amount) {
        if (!this.currentUser || this.currentUser.role !== "admin") {
            return { success: false, message: "Vetëm administratori mund të shtojë kredite." };
        }
        const cleanName = targetUsername.trim().toLowerCase();
        if (!this.users[cleanName]) {
            this.users[cleanName] = {
                username: cleanName,
                credits: 0,
                role: "client",
                createdAt: new Date().toISOString()
            };
        }
        this.users[cleanName].credits += Number(amount);
        this.saveUsers();
        this.syncToCloud();
        return {
            success: true,
            username: cleanName,
            newBalance: this.users[cleanName].credits
        };
    }

    getAllClients() {
        this.users = this.loadUsers();
        return Object.values(this.users);
    }

    // Gjenerimi i kodit HTML përmes AI (Gemini / OpenAI / Live Fallback)
    async generateAppCode(promptText) {
        const creditCheck = this.consumeCredit();
        if (!creditCheck.allowed) {
            throw new Error(creditCheck.reason);
        }

        const systemInstruction = "Ti je një zhvillues ekspert web. Kthe VETËM kodin e plotë dhe të pastër HTML5 me CSS dhe JavaScript të brendshëm (pa shpjegime jashtë kodit) për këtë kërkesë:";

        // 1. Lidhja me Google Gemini API nëse është vendosur çelësi
        if (this.apiSettings.provider === "gemini" && this.apiSettings.apiKey) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(this.apiSettings.apiKey)}`;
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `${systemInstruction} ${promptText}` }] }]
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || "Gabim në Gemini API");
            let rawCode = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            return this.cleanHtmlOutput(rawCode);
        }

        // 2. Lidhja me OpenAI API nëse është vendosur çelësi
        if (this.apiSettings.provider === "openai" && this.apiSettings.apiKey) {
            const res = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.apiSettings.apiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: systemInstruction },
                        { role: "user", content: promptText }
                    ]
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || "Gabim në OpenAI API");
            let rawCode = data.choices?.[0]?.message?.content || "";
            return this.cleanHtmlOutput(rawCode);
        }

        // 3. Modaliteti i menjëhershëm pa çelës API (Gjeneron faqe të gatshme moderne)
        return this.buildInstantTemplate(promptText);
    }

    cleanHtmlOutput(code) {
        return code.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    }

    buildInstantTemplate(titlePrompt) {
        const safeTitle = titlePrompt.replace(/</g, "&lt;").replace(/>/g, "&gt;").slice(0, 60) || "Projekti Im";
        return `<!DOCTYPE html>
<html lang="sq">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle}</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: #0b0f19; color: #f8fafc; }
  header { padding: 24px 40px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; }
  .hero { max-width: 820px; margin: 80px auto; text-align: center; padding: 0 20px; }
  h1 { font-size: 2.8rem; margin-bottom: 16px; background: linear-gradient(90deg, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  p { color: #94a3b8; font-size: 1.15rem; line-height: 1.6; }
  .btn { display: inline-block; margin-top: 28px; padding: 14px 32px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 10px; font-weight: 600; }
</style>
</head>
<body>
  <header><strong>Sabi AI Build</strong><span>SSL & CDN Aktiv</span></header>
  <section class="hero">
    <h1>${safeTitle}</h1>
    <p>Ky aplikacion u gjenerua automatikisht nga motori Sabi AI Studio. Gati për publikim dhe personalizim të plotë.</p>
    <a href="#kontakti" class="btn" onclick="alert('Aplikacioni është aktiv!')">Fillo Tani</a>
  </section>
</body>
</html>`;
    }

    // Sinkronizim automatik kur hapet në dy dritare (Admin + Klient) ose me Firebase URL
    initAutoSync() {
        window.addEventListener("storage", (e) => {
            if (e.key === SABI_CONFIG.storageKeyUsers) {
                this.users = this.loadUsers();
                if (this.currentUser && this.currentUser.role === "client") {
                    const updated = this.users[this.currentUser.username];
                    if (updated) {
                        this.currentUser.credits = updated.credits;
                        this.saveSession(this.currentUser);
                    }
                }
                window.dispatchEvent(new Event("sabi_data_updated"));
            }
        });
    }

    async syncToCloud() {
        if (!this.apiSettings.firebaseUrl) return;
        const cleanUrl = this.apiSettings.firebaseUrl.replace(/\/$/, "") + "/sabi_users.json";
        try {
            await fetch(cleanUrl, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(this.users)
            });
        } catch (err) {
            console.warn("Cloud sync error:", err);
        }
    }
}

// Eksportohet globalisht për përdorim direkt në index.html
window.SabiEngine = new SabiPlatformEngine();
