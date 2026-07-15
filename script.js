import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    addDoc,
    query,
    orderBy,
    serverTimestamp,
    onSnapshot,
    getDocs,
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Configuración Firebase
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

/* --- Toast Helper --- */
let toastTimer;
function showToast(msg, type = "ok") {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.className = `show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = ""; }, 3600);
}

/* --- UI Helpers --- */
const mainNav     = document.getElementById("main-nav");
const appContent  = document.getElementById("app-content");
const authSection = document.getElementById("auth-section");
const authMessage = document.getElementById("auth-message");

window.showPage = function(id) {
    document.querySelectorAll(".tab-content").forEach(s => s.classList.remove("active"));
    const el = document.getElementById(id);
    if (el) el.classList.add("active");
    
    document.querySelectorAll(".tab-button").forEach(b => b.classList.remove("active"));
    const btn = Array.from(document.querySelectorAll(".tab-button"))
        .find(b => b.dataset.target === id);
    if (btn) btn.classList.add("active");
    
    // El menú colapsa dinámicamente tras pulsar en pantallas móviles
    if (mainNav) mainNav.classList.remove("open");
};

function setAuthMsg(msg, ok = true) {
    if (!authMessage) return;
    authMessage.style.color = ok ? "var(--verde-1)" : "#d32f2f";
    authMessage.textContent = msg;
}

/* --- Inicialización DOM --- */
document.addEventListener("DOMContentLoaded", () => {

    /* Menú Hamburguesa Móvil */
    const hamburgerBtn = document.getElementById("hamburger");
    if (hamburgerBtn && mainNav) {
        hamburgerBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            mainNav.classList.toggle("open");
        });
    }

    // Cerrar menú al tocar fuera del contenedor (comportamiento web móvil estándar)
    document.addEventListener("click", () => {
        if (mainNav) mainNav.classList.remove("open");
    });

    /* Mostrar / ocultar contraseña */
    document.querySelectorAll(".toggle-pw").forEach(btn => {
        btn.addEventListener("click", () => {
            const inp = btn.closest(".pw-wrap")?.querySelector("input");
            if (inp) inp.type = inp.type === "password" ? "text" : "password";
        });
    });

    /* Tabs de navegación */
    document.querySelectorAll(".tab-button[data-target]").forEach(btn => {
        btn.addEventListener("click", () => showPage(btn.dataset.target));
    });

    /* Gestión de Autenticación */
    const loginBtn      = document.getElementById("login-btn");
    const registerBtn   = document.getElementById("register-btn");
    const forgotBtn     = document.getElementById("forgot-btn");
    const logoutBtn     = document.getElementById("logout-btn");
    const loginEmail    = document.getElementById("login-email");
    const loginPassword = document.getElementById("login-password");

    loginBtn?.addEventListener("click", async () => {
        const email = loginEmail?.value.trim();
        const pass  = loginPassword?.value.trim();
        if (!email || !pass) { setAuthMsg("Escribe correo y contraseña.", false); return; }
        loginBtn.textContent = "Entrando…";
        loginBtn.disabled = true;
        try {
            await signInWithEmailAndPassword(auth, email, pass);
            setAuthMsg("");
        } catch (e) {
            setAuthMsg(friendlyError(e.code), false);
        } finally {
            loginBtn.textContent = "Ingresar →";
            loginBtn.disabled = false;
        }
    });

    registerBtn?.addEventListener("click", async () => {
        const email = loginEmail?.value.trim();
        const pass  = loginPassword?.value.trim();
        if (!email || !pass) { setAuthMsg("Escribe correo y contraseña.", false); return; }
        if (pass.length < 6) { setAuthMsg("La contraseña debe tener al menos 6 caracteres.", false); return; }
        registerBtn.textContent = "Creando cuenta…";
        registerBtn.disabled = true;
        try {
            await createUserWithEmailAndPassword(auth, email, pass);
            setAuthMsg("¡Registro exitoso! Bienvenido 🎉");
        } catch (e) {
            setAuthMsg(friendlyError(e.code), false);
        } finally {
            registerBtn.textContent = "Registrarse";
            registerBtn.disabled = false;
        }
    });

    forgotBtn?.addEventListener("click", async () => {
        const email = loginEmail?.value.trim();
        if (!email) { setAuthMsg("Escribe tu correo primero.", false); return; }
        try {
            await sendPasswordResetEmail(auth, email);
            setAuthMsg("Correo de recuperación enviado ✉️");
        } catch (e) {
            setAuthMsg(friendlyError(e.code), false);
        }
    });

    logoutBtn?.addEventListener("click", async () => {
        await signOut(auth);
        showToast("¡Hasta pronto! 👋");
    });

    /* Envío de Comentarios de la Comunidad */
    document.getElementById("comentario-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const nombre = document.getElementById("nombre").value.trim() || "Anónimo";
        const texto  = document.getElementById("comentario").value.trim();
        if (!texto) return;
        const btn = e.target.querySelector("button[type='submit']");
        btn.textContent = "Publicando…";
        btn.disabled = true;
        try {
            await addDoc(collection(db, "comentarios"), {
                nombre, texto, fecha: serverTimestamp()
            });
            e.target.reset();
            showToast("¡Comentario publicado! 💬");
        } catch (err) {
            showToast("Error al publicar.", "error");
        } finally {
            btn.textContent = "Publicar 🚀";
            btn.disabled = false;
        }
    });
});

/* --- Control del Estado de Autenticación --- */
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.body.classList.add("is-authed");
        if (appContent) appContent.style.display = "block";
        if (authSection) authSection.style.display = "none";
        showPage("inicio");

        subscribeNoticias();
        subscribeCandidatos();
        subscribeComentarios();
        loadStats();
        initRacha(user);

        const rachaBtn = document.getElementById("racha-nav-btn");
        if (rachaBtn) rachaBtn.style.display = "";
    } else {
        document.body.classList.remove("is-authed");
        if (mainNav) mainNav.classList.remove("open");
        if (appContent) appContent.style.display = "none";
        if (authSection) {
            authSection.style.display = "block";
            authSection.classList.add("active");
        }
        if (authMessage) authMessage.textContent = "";
    }
});

/* --- Carga Dinámica de Estadísticas en Inicio --- */
async function loadStats() {
    try {
        const [c, ca, n] = await Promise.all([
            getDocs(collection(db, "comentarios")),
            getDocs(collection(db, "candidatos")),
            getDocs(collection(db, "noticias"))
        ]);
        animateCount("stat-candidatos",  ca.size);
        animateCount("stat-comentarios", c.size);
        animateCount("stat-noticias",    n.size);
    } catch (e) { console.warn("Stats error:", e); }
}

function animateCount(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    let cur = 0;
    const step = Math.ceil(target / 30) || 1;
    const t = setInterval(() => {
        cur = Math.min(cur + step, target);
        el.textContent = cur;
        if (cur >= target) clearInterval(t);
    }, 40);
}

/* --- Suscripciones en Tiempo Real (Firestore Snapshots) --- */
let unsubNoticias, unsubCandidatos, unsubComentarios;

function subscribeNoticias() {
    unsubNoticias?.();
    const q = query(collection(db, "noticias"), orderBy("fecha", "desc"));
    unsubNoticias = onSnapshot(q, snap => {
        const lista = document.getElementById("lista-noticias");
        const empty = document.getElementById("noticias-empty");
        if (!lista) return;
        lista.innerHTML = "";
        if (snap.empty) { if (empty) empty.style.display = "block"; return; }
        if (empty) empty.style.display = "none";
        snap.forEach(d => {
            const n = d.data();
            const fecha = n.fecha?.toDate ? n.fecha.toDate().toLocaleString("es-CO") : "";
            const div = document.createElement("div");
            div.className = "noticia";
            div.innerHTML = `<h3>${n.titulo || "Sin título"}</h3><p>${n.contenido || ""}</p>${fecha ? `<small>📅 ${fecha}</small>` : ""}`;
            lista.appendChild(div);
        });
    });
}

function subscribeCandidatos() {
    unsubCandidatos?.();
    unsubCandidatos = onSnapshot(collection(db, "candidatos"), snap => {
        const lista = document.getElementById("lista-candidatos");
        const empty = document.getElementById("candidatos-empty");
        if (!lista) return;
        lista.innerHTML = "";
        if (snap.empty) { if (empty) empty.style.display = "block"; return; }
        if (empty) empty.style.display = "none";
        snap.forEach(d => {
            const c = d.data();
            const nombre    = c.nombre || c.Nombre || "Candidato";
            const puesto    = c.puesto || c.Personera || "Sin puesto";
            const slogan    = c.slogan || "¡Vota por el cambio!";
            const foto      = c.foto_perfil || `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=287840&color=fff&size=150`;
            const propuestas = Array.isArray(c.propuestas) ? c.propuestas : [];
            const propHTML  = propuestas.length
                ? `<h4>Propuestas</h4><ul>${propuestas.map(p => `<li class="propuesta-item">${p}</li>`).join("")}</ul>`
                : `<p class="sin-propuestas">Propuestas próximamente…</p>`;

            const div = document.createElement("div");
            div.className = "tarjeta-candidato";
            div.innerHTML = `
                <img src="${foto}" alt="${nombre}" loading="lazy" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=287840&color=fff&size=150'">
                <h3>${nombre}</h3>
                <span class="puesto-badge">${puesto}</span>
                <p class="slogan">"${slogan}"</p>
                ${propHTML}
            `;
            lista.appendChild(div);
        });
    });
}

function subscribeComentarios() {
    unsubComentarios?.();
    const q = query(collection(db, "comentarios"), orderBy("fecha", "desc"));
    unsubComentarios = onSnapshot(q, snap => {
        const lista = document.getElementById("lista-comentarios");
        const empty = document.getElementById("comentarios-empty");
        if (!lista) return;
        lista.innerHTML = "";
        if (snap.empty) { if (empty) empty.style.display = "block"; return; }
        if (empty) empty.style.display = "none";
        snap.forEach(d => {
            const c = d.data();
            const fecha   = c.fecha?.toDate ? c.fecha.toDate().toLocaleString("es-CO") : "";
            const inicial = (c.nombre || "A")[0].toUpperCase();
            const div = document.createElement("div");
            div.className = "comentario";
            div.innerHTML = `
                <div class="coment-top">
                    <div class="coment-avatar">${inicial}</div>
                    <strong>${c.nombre || "Anónimo"}</strong>
                </div>
                <p>${c.texto}</p>
                ${fecha ? `<small>🕐 ${fecha}</small>` : ""}
            `;
            lista.appendChild(div);
        });
    });
}

/* --- Módulo de Racha Diaria --- */
function initRacha(user) {
    const rachaCount = document.getElementById("racha-count");
    const rachaLast  = document.getElementById("racha-last");
    const rachaMsg   = document.getElementById("racha-msg");
    const btnMark    = document.getElementById("racha-btn-mark");
    if (!btnMark) return;
    const docRef     = doc(db, "rachas", user.uid);

    function updateMilestones(n) {
        document.querySelectorAll(".ms").forEach(m => {
            m.classList.toggle("achieved", n >= parseInt(m.dataset.goal));
        });
    }

    async function cargarRacha() {
        try {
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const data = snap.data();
                if(rachaCount) rachaCount.textContent = data.conteo || 0;
                if(rachaLast) rachaLast.textContent  = data.ultimaFecha || "—";
                updateMilestones(data.conteo || 0);
            } else {
                await setDoc(docRef, { conteo: 0, ultimaFecha: "" });
            }
        } catch (e) { console.error(e); }
    }

    async function marcarHoy() {
        const hoy  = new Date().toLocaleDateString("es-CO");
        const snap = await getDoc(docRef);
        let data   = snap.exists() ? snap.data() : { conteo: 0, ultimaFecha: "" };

        if (data.ultimaFecha === hoy) {
            if (rachaMsg) rachaMsg.textContent = "✅ Ya marcaste hoy";
            return;
        }

        const ayer = new Date();
        ayer.setDate(ayer.getDate() - 1);
        const fechaAyer = ayer.toLocaleDateString("es-CO");

        const nuevo = data.ultimaFecha === fechaAyer ? (data.conteo || 0) + 1 : 1;
        await setDoc(docRef, { conteo: nuevo, ultimaFecha: hoy });

        if(rachaCount) rachaCount.textContent = nuevo;
        if(rachaLast) rachaLast.textContent  = hoy;
        if(rachaMsg) rachaMsg.textContent   = "🎉 ¡Ingreso registrado!";
        updateMilestones(nuevo);
        showToast(`🔥 ¡${nuevo} día${nuevo > 1 ? "s" : ""} de racha!`);

        if ([5, 10, 30].includes(nuevo)) {
            setTimeout(() => showToast(`🏆 ¡${nuevo} días! Contacta al encargado para tu premio.`), 1400);
        }
    }

    // Clonar nodo para limpiar selectores antiguos de eventos previos de manera segura
    const newBtn = btnMark.cloneNode(true);
    btnMark.parentNode.replaceChild(newBtn, btnMark);
    newBtn.addEventListener("click", marcarHoy);

    cargarRacha();
}

/* --- Mensajes de Error de Autenticación de Firebase --- */
function friendlyError(code) {
    const map = {
        "auth/user-not-found":        "No existe cuenta con ese correo.",
        "auth/wrong-password":        "Contraseña incorrecta.",
        "auth/invalid-credential":    "Correo o contraseña incorrectos.",
        "auth/email-already-in-use":  "Ese correo ya está registrado.",
        "auth/invalid-email":         "El correo no es válido.",
        "auth/weak-password":         "La contraseña es muy débil.",
        "auth/too-many-requests":     "Demasiados intentos. Espera un momento.",
        "auth/network-request-failed":"Sin conexión a internet.",
    };
    return map[code] || "Ocurrió un error. Intenta de nuevo.";
}