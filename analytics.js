import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAPTK90rYKQmIwBSDlNjHa0ebVqENm0wgU",
    authDomain: "mi-voz-escolar.firebaseapp.com",
    projectId: "mi-voz-escolar",
    storageBucket: "mi-voz-escolar.appspot.com",
    messagingSenderId: "621397278185",
    appId: "1:621397278185:web:8c8f68c6fa03a037701f78"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const STORAGE_KEY = "mve_ai_settings";

/* --- Toast Helper (igual que en script.js) --- */
let toastTimer;
function showToast(msg, type = "ok") {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.className = `show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = ""; }, 3600);
}

/* --- Menú hamburguesa / logout (mismo comportamiento que el resto del sitio) --- */
document.addEventListener("DOMContentLoaded", () => {
    const mainNav = document.getElementById("main-nav");
    const hamburgerBtn = document.getElementById("hamburger");
    if (hamburgerBtn && mainNav) {
        hamburgerBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            mainNav.classList.toggle("open");
        });
    }
    document.addEventListener("click", () => { if (mainNav) mainNav.classList.remove("open"); });

    document.getElementById("logout-btn")?.addEventListener("click", async () => {
        await signOut(auth);
        window.location.href = "index.html";
    });

    document.querySelectorAll(".toggle-pw").forEach(btn => {
        btn.addEventListener("click", () => {
            const inp = btn.closest(".pw-wrap")?.querySelector("input");
            if (inp) inp.type = inp.type === "password" ? "text" : "password";
        });
    });
});

/* --- Guarda de sesión: sin usuario, no hay analytics --- */
onAuthStateChanged(auth, (user) => {
    const gate = document.getElementById("analytics-gate");
    const body = document.getElementById("analytics-body");
    if (!user) {
        if (gate) gate.style.display = "block";
        if (body) body.style.display = "none";
        return;
    }
    if (gate) gate.style.display = "none";
    if (body) body.style.display = "block";
    loadAnalytics();
});

/* --- Carga de datos y gráficas --- */
let chartParticipacion, chartComentariosTiempo;

async function loadAnalytics() {
    try {
        const [comentariosSnap, candidatosSnap, noticiasSnap, rachasSnap] = await Promise.all([
            getDocs(collection(db, "comentarios")),
            getDocs(collection(db, "candidatos")),
            getDocs(collection(db, "noticias")),
            getDocs(collection(db, "rachas")).catch(() => ({ docs: [] }))
        ]);

        setNum("an-candidatos", candidatosSnap.size);
        setNum("an-comentarios", comentariosSnap.size);
        setNum("an-noticias", noticiasSnap.size);

        // Rachas "activas": último ingreso registrado hoy o ayer
        const hoy = new Date();
        const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
        const fmt = (d) => d.toLocaleDateString("es-CO");
        let activas = 0;
        rachasSnap.docs?.forEach(d => {
            const data = d.data();
            if (data.ultimaFecha === fmt(hoy) || data.ultimaFecha === fmt(ayer)) activas++;
        });
        setNum("an-rachas", activas);

        renderParticipacionChart({
            candidatos: candidatosSnap.size,
            comentarios: comentariosSnap.size,
            noticias: noticiasSnap.size
        });

        renderComentariosTiempoChart(comentariosSnap);

        // Guardar snapshot de stats para el prompt de IA
        window.__mveStats = {
            candidatos: candidatosSnap.size,
            comentarios: comentariosSnap.size,
            noticias: noticiasSnap.size,
            rachasActivas: activas,
            candidatosDetalle: candidatosSnap.docs.map(d => {
                const c = d.data();
                return { nombre: c.nombre || c.Nombre, puesto: c.puesto || c.Personera, propuestas: (c.propuestas || []).length };
            })
        };
    } catch (e) {
        console.error(e);
        showToast("No se pudieron cargar los datos de analytics.", "error");
    }
}

function setNum(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function renderParticipacionChart(counts) {
    const ctx = document.getElementById("chart-participacion");
    if (!ctx || typeof Chart === "undefined") return;
    chartParticipacion?.destroy();
    chartParticipacion = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["Candidatos", "Comentarios", "Noticias"],
            datasets: [{
                data: [counts.candidatos, counts.comentarios, counts.noticias],
                backgroundColor: ["#287840", "#4da92c", "#94c121"],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });
}

function renderComentariosTiempoChart(comentariosSnap) {
    const ctx = document.getElementById("chart-comentarios-tiempo");
    if (!ctx || typeof Chart === "undefined") return;

    const dias = [];
    const conteo = {};
    for (let i = 13; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString("es-CO");
        dias.push(key);
        conteo[key] = 0;
    }
    comentariosSnap.forEach(doc => {
        const f = doc.data().fecha?.toDate ? doc.data().fecha.toDate() : null;
        if (!f) return;
        const key = f.toLocaleDateString("es-CO");
        if (key in conteo) conteo[key]++;
    });

    chartComentariosTiempo?.destroy();
    chartComentariosTiempo = new Chart(ctx, {
        type: "line",
        data: {
            labels: dias,
            datasets: [{
                data: dias.map(d => conteo[d]),
                borderColor: "#287840",
                backgroundColor: "rgba(40,120,64,0.12)",
                fill: true,
                tension: 0.35,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });
}

/* =============================================
   PANEL DE IA — proveedor configurable
   ============================================= */

const DEFAULT_MODELS = {
    openai: "gpt-4o-mini",
    anthropic: "claude-3-5-sonnet-latest",
    gemini: "gemini-1.5-flash",
    custom: ""
};

function buildPrompt() {
    const s = window.__mveStats;
    if (!s) return "Aún no hay datos cargados de la plataforma Mi Voz Escolar.";
    const candidatosTxt = (s.candidatosDetalle || [])
        .map(c => `- ${c.nombre || "Sin nombre"} (${c.puesto || "sin puesto"}), ${c.propuestas} propuesta(s)`)
        .join("\n") || "Sin candidatos registrados.";

    return [
        "Eres un asistente que ayuda a interpretar datos de participación en el gobierno escolar de un colegio.",
        "Analiza estas cifras y da 3-4 observaciones útiles y accionables para el equipo organizador, en español, tono cercano y breve:",
        "",
        `- Candidatos registrados: ${s.candidatos}`,
        `- Comentarios de la comunidad: ${s.comentarios}`,
        `- Noticias publicadas: ${s.noticias}`,
        `- Estudiantes con racha activa (ingresaron hoy o ayer): ${s.rachasActivas}`,
        "",
        "Detalle de candidatos:",
        candidatosTxt
    ].join("\n");
}

function loadSavedSettings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (saved.provider) document.getElementById("ai-provider").value = saved.provider;
        if (saved.model) document.getElementById("ai-model").value = saved.model;
        if (saved.endpoint) document.getElementById("ai-endpoint").value = saved.endpoint;
        if (saved.key) {
            document.getElementById("ai-key").value = saved.key;
            document.getElementById("ai-remember").checked = true;
        }
        updateProviderUI();
    } catch (e) { /* si el JSON guardado es inválido, se ignora */ }
}

function updateProviderUI() {
    const provider = document.getElementById("ai-provider").value;
    document.getElementById("ai-endpoint-field").style.display = provider === "custom" ? "block" : "none";
    const modelInput = document.getElementById("ai-model");
    if (!modelInput.value) modelInput.value = DEFAULT_MODELS[provider] || "";
}

function setAiMsg(msg, ok = true) {
    const el = document.getElementById("ai-message");
    if (!el) return;
    el.style.color = ok ? "var(--verde-1)" : "#d32f2f";
    el.textContent = msg;
}

/* --- Llamadas a cada proveedor (formato de chat estándar de cada uno) --- */
async function callOpenAI(apiKey, model, prompt) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] })
    });
    if (!res.ok) throw new Error((await res.text()).slice(0, 300));
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "Sin respuesta del modelo.";
}

async function callAnthropic(apiKey, model, prompt) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({ model, max_tokens: 1000, messages: [{ role: "user", content: prompt }] })
    });
    if (!res.ok) throw new Error((await res.text()).slice(0, 300));
    const data = await res.json();
    return data.content?.map(b => b.text || "").join("\n") || "Sin respuesta del modelo.";
}

async function callGemini(apiKey, model, prompt) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    if (!res.ok) throw new Error((await res.text()).slice(0, 300));
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.map(p => p.text).join("\n") || "Sin respuesta del modelo.";
}

async function callCustom(endpoint, apiKey, model, prompt) {
    // Formato compatible con OpenAI: funciona con la mayoría de proveedores alternativos
    // (OpenRouter, Groq, Together, servidores locales tipo Ollama en modo compatible, etc.)
    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] })
    });
    if (!res.ok) throw new Error((await res.text()).slice(0, 300));
    const data = await res.json();
    return data.choices?.[0]?.message?.content || JSON.stringify(data).slice(0, 500);
}

document.addEventListener("DOMContentLoaded", () => {
    loadSavedSettings();

    document.getElementById("ai-provider")?.addEventListener("change", () => {
        document.getElementById("ai-model").value = "";
        updateProviderUI();
    });

    document.getElementById("ai-copy-prompt-btn")?.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(buildPrompt());
            showToast("Prompt copiado. Pégalo en el chat de tu IA favorita 📋");
        } catch (e) {
            setAiMsg("No se pudo copiar automáticamente. Copia el texto manualmente.", false);
        }
    });

    document.getElementById("ai-clear-key-btn")?.addEventListener("click", () => {
        localStorage.removeItem(STORAGE_KEY);
        document.getElementById("ai-key").value = "";
        document.getElementById("ai-remember").checked = false;
        showToast("Clave olvidada de este navegador");
    });

    document.getElementById("ai-generate-btn")?.addEventListener("click", async () => {
        const provider = document.getElementById("ai-provider").value;
        const model    = document.getElementById("ai-model").value.trim() || DEFAULT_MODELS[provider];
        const apiKey   = document.getElementById("ai-key").value.trim();
        const endpoint = document.getElementById("ai-endpoint").value.trim();
        const remember = document.getElementById("ai-remember").checked;
        const btn = document.getElementById("ai-generate-btn");
        const resultWrap = document.getElementById("ai-result-wrap");
        const resultEl = document.getElementById("ai-result");

        if (provider !== "gemini" && !apiKey) { setAiMsg("Ingresa tu API key.", false); return; }
        if (provider === "custom" && !endpoint) { setAiMsg("Ingresa la URL del endpoint.", false); return; }

        if (remember) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ provider, model, endpoint, key: apiKey }));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }

        const prompt = buildPrompt();
        btn.textContent = "Analizando…";
        btn.disabled = true;
        setAiMsg("");

        try {
            let texto;
            if (provider === "openai") texto = await callOpenAI(apiKey, model, prompt);
            else if (provider === "anthropic") texto = await callAnthropic(apiKey, model, prompt);
            else if (provider === "gemini") texto = await callGemini(apiKey, model, prompt);
            else texto = await callCustom(endpoint, apiKey, model, prompt);

            resultEl.textContent = texto;
            resultWrap.style.display = "block";
            showToast("Análisis generado ✨");
        } catch (e) {
            console.error(e);
            setAiMsg("No se pudo conectar con el proveedor. Puede ser la clave, el modelo, o que el proveedor bloquee llamadas desde el navegador (CORS). Usa 'Copiar prompt' como alternativa.", false);
        } finally {
            btn.textContent = "Generar análisis ✨";
            btn.disabled = false;
        }
    });

    updateProviderUI();
});
