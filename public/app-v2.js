// ---- VARIABLES GLOBALES Y CONFIGURACIÓN ----
let revelationCountdownInterval;
const userLang = navigator.language.slice(0, 2) || 'es';
let currentLang = 'es'; // Idioma por defecto
const PAGE_SIZE = 10;
let globalPage = 1, globalMaxPages = 1;
let myPage = 1, myMaxPages = 1;
let userCountry = "Desconocido"; 
let countryReady = false;
let allThoughtsAndCapsules = [];
let map;

// ---- CONFIGURACIÓN DE FIREBASE ----
const firebaseConfig = {
  apiKey: "AIzaSyDulqQnpuXtLEIqKdFrlXW3M8zeadms_yI",
  authDomain: "libreantisocial.firebaseapp.com",
  projectId: "libreantisocial",
  storageBucket: "libreantisocial.firebasestorage.app",
  messagingSenderId: "842162863212",
  appId: "1:842162863212:web:5dde2e830ba261fd35ec49",
  measurementId: "G-ZCYR53CGX7"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ---- LÓGICA DE TRADUCCIÓN (I18N) Y UTILIDADES ----
function getCountryName(countryCode) {
    const code = countryCode || "Desconocido";
    if (typeof COUNTRIES !== 'undefined' && COUNTRIES[code]) {
        return COUNTRIES[code]['name_' + currentLang] || COUNTRIES[code]['name_es'];
    }
    return code;
}

function applyTranslations() {
    document.querySelectorAll('[data-translate-key]').forEach(el => {
        const key = el.getAttribute('data-translate-key');
        el.innerHTML = translations[currentLang][key] || el.innerHTML;
    });
    document.querySelectorAll('[data-translate-key-placeholder]').forEach(el => {
        const key = el.getAttribute('data-translate-key-placeholder');
        el.placeholder = translations[currentLang][key] || el.placeholder;
    });
    document.querySelectorAll('[data-translate-key-title]').forEach(el => {
        const key = el.getAttribute('data-translate-key-title');
        el.title = translations[currentLang][key] || el.title;
    });
    document.documentElement.lang = currentLang;
    document.getElementById('lang-es').classList.toggle('active', currentLang === 'es');
    document.getElementById('lang-en').classList.toggle('active', currentLang === 'en');
}

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('libre_lang', lang);
    const langBanner = document.getElementById('langBanner');
    if (langBanner) langBanner.classList.remove('show');
    applyTranslations();
    refreshAllData();
}

function setupLanguage() {
    const savedLang = localStorage.getItem('libre_lang');
    const browserLang = navigator.language.slice(0, 2);

    if (savedLang) {
        currentLang = savedLang;
        applyTranslations();
    } else {
        const langBanner = document.getElementById('langBanner');
        currentLang = browserLang === 'en' ? 'en' : 'es';
        applyTranslations();
        setTimeout(() => langBanner.classList.add('show'), 500);
    }
}

// ---- SISTEMA DE NOTIFICACIONES ----
function showNotification(messageKey, type = 'info', duration = 3000, context = '') {
    const message = (translations[currentLang][messageKey] || messageKey) + context;
    const area = document.getElementById('notification-area');
    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.textContent = message;
    area.appendChild(notif);
    setTimeout(() => { notif.classList.add('show'); }, 10);
    setTimeout(() => {
        notif.classList.remove('show');
        notif.addEventListener('transitionend', () => notif.remove());
    }, duration);
}

// ---- FUNCIONALIDAD DE TEXTAREAS (BORRADOR AUTOMÁTICO Y CONTADOR) ----
function setupTextareaFeatures(textarea, counterElement, storageKey) {
    if (!textarea || !counterElement) return;
    const maxLength = parseInt(textarea.getAttribute('maxlength'), 10);

    // 1. Cargar borrador desde localStorage
    const savedDraft = localStorage.getItem(storageKey);
    if (savedDraft) {
        textarea.value = savedDraft;
    }

    // 2. Función para actualizar el contador
    function updateCounter() {
        const currentLength = textarea.value.length;
        const remaining = maxLength - currentLength;
        
        counterElement.textContent = remaining;
        
        counterElement.classList.remove('warn', 'danger');
        if (remaining <= 0) {
            counterElement.classList.add('danger');
        } else if (remaining <= 20) {
            counterElement.classList.add('warn');
        }
    }

    // 3. Event listener para guardar borrador y actualizar contador
    textarea.addEventListener('input', () => {
        localStorage.setItem(storageKey, textarea.value);
        updateCounter();
    });

    // 4. Inicializar el contador
    updateCounter();
}

// ---- LÓGICA DE LA PANTALLA DE BIENVENIDA ----
function setupWelcomeScreen() {
    const overlay = document.getElementById('welcome-overlay');
    // Si el usuario ya vio la bienvenida, eliminamos el overlay del DOM y no hacemos nada más.
    if (localStorage.getItem('libre_welcome_seen') === 'true') {
        overlay.remove();
        return;
    }

    // Mostramos el overlay si es la primera vez
    overlay.classList.remove('hidden');

    const slides = document.querySelectorAll('.welcome-slide');
    const startBtn = document.getElementById('welcome-start-btn');
    const dotsContainer = document.getElementById('welcome-dots');
    let currentSlide = 0;
    let welcomeInterval;

    // Crear puntos de navegación
    slides.forEach((_, i) => {
        const dot = document.createElement('div');
        dot.className = 'welcome-dot';
        if (i === 0) dot.classList.add('active');
        dotsContainer.appendChild(dot);
    });
    const dots = document.querySelectorAll('.welcome-dot');

    function updateDots() {
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === currentSlide);
        });
    }

    function showNextSlide() {
        slides[currentSlide].classList.remove('active');
        currentSlide++;
        
        if (currentSlide >= slides.length) {
            // Fin del slideshow
            clearInterval(welcomeInterval);
            startBtn.classList.remove('hidden');
            dotsContainer.classList.add('hidden'); // Ocultar los puntos al final
            return;
        }

        slides[currentSlide].classList.add('active');
        updateDots();
    }

    // Iniciar el carrusel automático
    welcomeInterval = setInterval(showNextSlide, 4000); // 4 segundos por diapositiva

    startBtn.onclick = () => {
        localStorage.setItem('libre_welcome_seen', 'true');
        overlay.classList.add('hidden');
        // Esperar a que la transición de opacidad termine antes de eliminar el elemento
        overlay.addEventListener('transitionend', () => overlay.remove());
    };
}

// ---- FUNCIÓN DE INICIALIZACIÓN DE LA APP ----
function initializeApp() {
    const textLogo = document.getElementById('textLogo');
    const imgLogo = document.getElementById('logolibre');
    if (textLogo && imgLogo) {
        textLogo.classList.remove('logo-hidden');
        textLogo.classList.add('logo-shown');
        imgLogo.classList.remove('visible');
        setTimeout(() => {
            textLogo.classList.remove('logo-shown');
            textLogo.classList.add('logo-hidden');
        }, 2000);
        setTimeout(() => { imgLogo.classList.add('visible'); }, 3500);
    }
    setupLanguage();
    setupAgeGate();
    setupLangBannerButtons();
    
    // Configurar textareas estáticos
    setupTextareaFeatures(document.getElementById('textarea'), document.getElementById('charCounterMain'), 'libre_draft_main');
    setupTextareaFeatures(document.getElementById('revelacionTextarea'), document.getElementById('charCounterRevelation'), 'libre_draft_revelation');
    setupTextareaFeatures(document.getElementById('capsuleMessage'), document.getElementById('charCounterCapsule'), 'libre_draft_capsule');

    showTab('feed');
    setTimeout(checkNewReplies, 1500);
    setInterval(() => { checkNewReplies(); }, 40000);
}

// ---- BANNERS (EDAD E IDIOMA) ----
function setupAgeGate() {
    const ageGateBanner = document.getElementById('ageGateBanner');
    const ageGateAccept = document.getElementById('ageGateAccept');
    
    if (localStorage.getItem('libre_age_gate_accepted') === 'true') {
        ageGateBanner.classList.remove('show');
    } else {
        setTimeout(() => ageGateBanner.classList.add('show'), 200);
    }

    ageGateAccept.onclick = () => {
        localStorage.setItem('libre_age_gate_accepted', 'true');
        ageGateBanner.classList.remove('show');
    };
}

function setupLangBannerButtons() {
    document.getElementById('langBannerEs').onclick = () => setLanguage('es');
    document.getElementById('langBannerEn').onclick = () => setLanguage('en');
}

// ---- FRASES INSPIRADORAS ----
function mostrarFraseInspiradoraEnTextarea() { 
    const frases = translations[currentLang]['inspirational_phrases'];
    const frase = frases[Math.floor(Math.random() * frases.length)]; 
    const textarea = document.getElementById('textarea'); 
    if (textarea) {
        textarea.placeholder = frase;
    }
}

// ---- REVELACIÓN DIARIA ----
function getDayOfYear(date) { const start = new Date(date.getFullYear(), 0, 0); const diff = date - start; const oneDay = 1000 * 60 * 60 * 24; return Math.floor(diff / oneDay); }
function getTodaysDateStr() { const now = new Date(); return now.getUTCFullYear() + '-' + String(now.getUTCMonth() + 1).padStart(2, '0') + '-' + String(now.getUTCDate()).padStart(2, '0'); }
function getYesterdaysDateStr() { const yesterday = new Date(); yesterday.setUTCDate(yesterday.getUTCDate() - 1); return yesterday.getUTCFullYear() + '-' + String(yesterday.getUTCMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getUTCDate()).padStart(2, '0'); }
function getQuestionForDate(date) { 
    const questions = translations[currentLang]['revelation_questions'];
    const dayIndex = getDayOfYear(date); 
    return questions[dayIndex % questions.length]; 
}
function startCountdown() { if (revelationCountdownInterval) clearInterval(revelationCountdownInterval); const countdownEl = document.getElementById('revelacionCountdown'); if (!countdownEl) return; revelationCountdownInterval = setInterval(() => { const now = new Date(); const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)); const diff = tomorrow - now; if (diff <= 0) { countdownEl.textContent = "¡Revelado!"; clearInterval(revelationCountdownInterval); setTimeout(() => location.reload(), 1000); return; } const hours = Math.floor((diff / (1000 * 60 * 60)) % 24); const minutes = Math.floor((diff / 1000 / 60) % 60); const seconds = Math.floor((diff / 1000) % 60); countdownEl.textContent = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0'); }, 1000); }
async function loadRevelacionDiaria() { const todayStr = getTodaysDateStr(); const question = getQuestionForDate(new Date()); document.getElementById('revelacionQuestion').textContent = question; const hasAnsweredToday = localStorage.getItem('libre_revelacion_answered') === todayStr; if (hasAnsweredToday) { document.getElementById('revelacionInputArea').classList.add('hidden'); document.getElementById('revelacionThanks').classList.remove('hidden'); startCountdown(); } else { document.getElementById('revelacionInputArea').classList.remove('hidden'); document.getElementById('revelacionThanks').classList.add('hidden'); if (revelationCountdownInterval) clearInterval(revelationCountdownInterval); } }
document.getElementById('revelacionSendBtn').onclick = async function() { const textarea = document.getElementById('revelacionTextarea'); const text = textarea.value.trim(); if (!text) return; if (window.contienePalabraOfensiva(text)) return; if (!countryReady) { showNotification("js.notification.country_wait", "info"); return; } this.disabled = true; const todayStr = getTodaysDateStr(); try { await db.collection('revelations').doc(todayStr).collection('responses').add({ text: text, ts: Date.now(), country: userCountry, user: getAnonUserId() }); localStorage.setItem('libre_revelacion_answered', todayStr); textarea.value = ''; localStorage.removeItem('libre_draft_revelation'); const counter = document.getElementById('charCounterRevelation'); counter.textContent = textarea.getAttribute('maxlength'); counter.classList.remove('warn', 'danger'); loadRevelacionDiaria(); } catch (e) { console.error("Error saving revelation answer:", e); showNotification("revelation.send_error", "error"); } finally { this.disabled = false; } };
async function showYesterdaysRevelation() {
  const container = document.getElementById('revelacionAyerContainer');
  const questionEl = document.getElementById('revelacionAyerQuestion');
  const respuestasEl = document.getElementById('revelacionAyerRespuestas');
  container.classList.toggle('hidden');
  if (container.classList.contains('hidden')) return;
  
  respuestasEl.innerHTML = createRevelationSkeleton(3);

  const yesterdayStr = getYesterdaysDateStr();
  const yesterdayQuestion = getQuestionForDate(new Date(yesterdayStr + "T00:00:00Z"));
  questionEl.textContent = `${translations[currentLang]['revelation.yesterdays_question_prefix']} ${yesterdayQuestion}`;

  try {
    const snapshot = await db.collection('revelations').doc(yesterdayStr).collection('responses').orderBy('ts', 'asc').get();
    if (snapshot.empty) {
      respuestasEl.innerHTML = `<p class="empty-state" data-translate-key="empty.no_revelation_answers">${translations[currentLang]['empty.no_revelation_answers']}</p>`;
      return;
    }
    respuestasEl.innerHTML = '';
    snapshot.forEach(doc => {
      const data = doc.data();
      const answerDiv = document.createElement('div');
      answerDiv.className = 'revelation-answer';
      const p = document.createElement('p');
      p.className = 'font-medium';
      p.textContent = data.text;
      const footer = document.createElement('div');
      footer.className = 'text-xs text-gray-500 mt-1';
      footer.textContent = `Desde ${getCountryName(data.country) || 'un lugar desconocido'}`;
      answerDiv.append(p, footer);
      respuestasEl.appendChild(answerDiv);
    });
  } catch (e) {
    console.error("Error loading yesterday's revelation:", e);
    respuestasEl.innerHTML = '<p class="empty-state text-red-700">Error loading responses.</p>';
  }
}

// ---- FORMATO FECHA ----
function formatearFecha(ts) { 
    if (!ts || typeof ts !== 'number') return "Invalid Date";
    const fecha = new Date(ts); 
    const opciones = { year: 'numeric', month: 'long', day: 'numeric' }; 
    const fechaStr = fecha.toLocaleDateString(currentLang, opciones); 
    const horaStr = fecha.toLocaleTimeString(currentLang, { hour: '2-digit', minute: '2-digit' }); 
    return `${fechaStr}, ${horaStr}`; 
}

// ---- GENERADOR ANÓNIMO Y EXPORT/IMPORT ----
function getAnonUserId() { let id = localStorage.getItem("libre_anon_id"); if (!id) { id = "anon-" + Math.random().toString(36).slice(2, 17); localStorage.setItem("libre_anon_id", id); } return id; }
function exportAnonId() { const id = getAnonUserId(); window.prompt(translations[currentLang]['js.prompt.export_id'], id); }
function importAnonId() { const newId = window.prompt(translations[currentLang]['js.prompt.import_id']); if (newId && /^anon-[a-z0-9]{15}$/.test(newId)) { localStorage.setItem("libre_anon_id", newId); loadMyThoughts(); showNotification("js.notification.id_restored", "success"); } else if (newId) { showNotification("js.notification.id_invalid", "error"); } }

// ---- DETECTAR PAÍS ----
async function detectCountry() { try { const res = await axios.get("https://ipinfo.io/json?token=ec664cefb36ece"); userCountry = res.data.country || "Desconocido"; } catch (e) { console.error("Error detecting country:", e); userCountry = "Desconocido"; } finally { countryReady = true; } }

// ---- MODO "BOTELLA AL MAR" ALEATORIO ----
document.getElementById('randomThoughtGlobe').onclick = async function() { const randomThoughtEl = document.getElementById('randomThought'); if (!randomThoughtEl) return; randomThoughtEl.classList.add('hidden'); try { const snapshot = await db.collection("thoughts").get(); const docs = snapshot.docs; if (docs.length === 0) { randomThoughtEl.textContent = "No hay pensamientos aún."; randomThoughtEl.classList.remove('hidden'); return; } const idx = Math.floor(Math.random() * docs.length); const data = docs[idx].data(); randomThoughtEl.innerHTML = ''; const headerDiv = document.createElement('div'); headerDiv.className = 'flex items-center space-x-2 mb-2'; headerDiv.innerHTML = `<span class="text-xs font-medium">${getCountryName(data.country) || "🌐"}</span>`; const p = document.createElement('p'); p.className = 'font-medium text-justify'; p.textContent = data.text; const dateDiv = document.createElement('div'); dateDiv.className = 'text-[0.7rem] text-gray-400 mt-1'; dateDiv.textContent = formatearFecha(data.ts); randomThoughtEl.append(headerDiv, p, dateDiv); randomThoughtEl.classList.remove('hidden'); } catch (e) { console.error("Error loading random thought:", e); randomThoughtEl.textContent = "Error al cargar pensamiento aleatorio."; randomThoughtEl.classList.remove('hidden'); } };

// ---- SISTEMA DE NOTIFICACIONES ----
function getLastSeenReplyTimestamp(thoughtId) { return Number(localStorage.getItem("libre_last_seen_reply_" + thoughtId) || 0); }
function setLastSeenReplyTimestamp(thoughtId, ts) { localStorage.setItem("libre_last_seen_reply_" + thoughtId, String(ts)); }
async function checkNewReplies() { try { const snapshot = await db.collection("thoughts").where("user", "==", getAnonUserId()).get(); let hasNewReply = false; for (const doc of snapshot.docs) { const thoughtId = doc.id; const repliesSnap = await db.collection("thoughts").doc(thoughtId).collection("replies").orderBy("ts", "desc").limit(1).get(); if (!repliesSnap.empty) { const latestReply = repliesSnap.docs[0].data(); const lastSeen = getLastSeenReplyTimestamp(thoughtId); if (latestReply.ts > lastSeen) { hasNewReply = true; break; } } } const notifEl = document.getElementById("mineTabNotification"); if(notifEl) notifEl.classList.toggle("hidden", !hasNewReply); } catch (e) { console.error("Error checking new replies:", e); } }
async function markRepliesAsSeen(myThoughts) {
    for (const thought of myThoughts) {
        const repliesSnap = await db.collection("thoughts").doc(thought.id).collection("replies").orderBy("ts", "desc").limit(1).get();
        if (!repliesSnap.empty) {
            const latestReply = repliesSnap.docs[0].data();
            setLastSeenReplyTimestamp(thought.id, latestReply.ts);
        }
    }
    const notifEl = document.getElementById("mineTabNotification");
    if(notifEl) notifEl.classList.add("hidden");
}

// ---- ESCRIBIR PENSAMIENTO ----
document.getElementById('sendBtn').onclick = async function() {
  if (!countryReady) { showNotification("js.notification.country_wait", "info"); return; }
  const textarea = document.getElementById('textarea'); const txt = textarea.value.trim();
  if (!txt) return;
  if (window.contienePalabraOfensiva(txt)) { showNotification('js.notification.offensive_word', 'error'); return; }
  
  try {
    this.disabled = true;
    await db.collection("thoughts").add({ text: txt, ts: Date.now(), country: userCountry, user: getAnonUserId() });
    textarea.value = '';
    localStorage.removeItem('libre_draft_main');
    const counter = document.getElementById('charCounterMain');
    counter.textContent = textarea.getAttribute('maxlength');
    counter.classList.remove('warn', 'danger');
    mostrarFraseInspiradoraEnTextarea();
    showNotification("js.notification.thought_sent", "success");
    refreshAllData();
  } catch (e) {
    console.error("Error saving thought:", e);
    showNotification("js.notification.thought_error", "error");
  } finally {
    this.disabled = false;
  }
};

// ---- REPORTAR PENSAMIENTOS (VERSIÓN MODIFICADA CON LÍMITE DIARIO) ----
async function reportThought(thoughtId, buttonElement) {
    if (!confirm(translations[currentLang]['js.notification.report_confirm'])) return;

    buttonElement.disabled = true;
    buttonElement.textContent = translations[currentLang]['js.notification.reporting'];

    const userId = getAnonUserId();
    const todayStr = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
    const counterDocId = `${userId}_${todayStr}`;
    const counterRef = db.collection('report_counters').doc(counterDocId);
    const thoughtRef = db.collection('thoughts').doc(thoughtId);
    const reportRef = thoughtRef.collection('reports').doc(userId); // Usar ID de usuario para evitar reportes duplicados

    try {
        await db.runTransaction(async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            const reportDoc = await transaction.get(reportRef);

            // 1. Evitar que un usuario reporte el mismo pensamiento varias veces
            if (reportDoc.exists) {
                throw new Error("already_reported");
            }

            // 2. Comprobar el límite diario de reportes
            const currentCount = counterDoc.exists ? counterDoc.data().count : 0;
            if (currentCount >= 3) {
                throw new Error("limit_exceeded");
            }

            // 3. Si todo está en orden, procesar el reporte y actualizar el contador
            transaction.set(reportRef, { timestamp: Date.now() });
            if (counterDoc.exists) {
                transaction.update(counterRef, { count: firebase.firestore.FieldValue.increment(1) });
            } else {
                transaction.set(counterRef, { count: 1 });
            }
        });

        // Si la transacción tiene éxito
        showNotification("js.notification.report_success", "success");
        buttonElement.textContent = translations[currentLang]['feed.reported_button'];

    } catch (error) {
        // Manejar los errores específicos de la transacción
        if (error.message === "limit_exceeded") {
            showNotification("js.notification.report_limit_exceeded", "error");
        } else if (error.message === "already_reported") {
            showNotification("js.notification.report_already_reported", "info");
        } else {
            console.error("Error reporting thought:", error);
            showNotification("js.notification.report_error", "error");
        }
        
        // Restaurar el botón a su estado original si el reporte falló
        buttonElement.disabled = false;
        buttonElement.textContent = translations[currentLang]['feed.action_report'];
        // Si el usuario ya lo había reportado, mantener el estado "Reportado"
        if (error.message === "already_reported") {
            buttonElement.textContent = translations[currentLang]['feed.reported_button'];
            buttonElement.disabled = true;
        }
    }
}

// ---- ACCIONES DE PENSAMIENTO (RESPONDER, TRADUCIR, REPORTAR) ----
function handleTranslateClick(text) { if (confirm(translations[currentLang]['js.notification.translate_confirm'])) { const encodedText = encodeURIComponent(text); const url = `https://translate.google.com/?sl=auto&tl=${currentLang}&text=${encodedText}&op=translate`; window.open(url, '_blank', 'noopener,noreferrer'); } }
async function enviarRespuesta(thoughtId, replyText, respuestasDiv, btn, textarea, storageKey) { if (!replyText.trim()) return; if (window.contienePalabraOfensiva(replyText)) { showNotification('js.notification.offensive_word', 'error'); return; } btn.disabled = true; textarea.disabled = true; try { const thoughtDoc = await db.collection("thoughts").doc(thoughtId).get(); if (!thoughtDoc.exists) { showNotification("js.notification.reply_error_generic", "error"); return; } if (thoughtDoc.data().user === getAnonUserId()) { showNotification("js.notification.reply_error_own", "info"); return; } await db.collection("thoughts").doc(thoughtId).collection("replies").add({ text: replyText.trim(), ts: Date.now(), user: getAnonUserId() }); textarea.value = ''; localStorage.removeItem(storageKey); await mostrarRespuestas(thoughtId, respuestasDiv); setTimeout(checkNewReplies, 1000); } catch(e) { console.error("Error saving reply:", e); showNotification('js.notification.reply_error_generic', "error"); } finally { btn.disabled = false; textarea.disabled = false; } }
async function mostrarRespuestas(thoughtId, respuestasDiv) { respuestasDiv.innerHTML = ''; try { const snapshot = await db.collection("thoughts").doc(thoughtId).collection("replies").orderBy("ts", "asc").get(); if (snapshot.empty) return; snapshot.forEach(doc => { const data = doc.data(); const replyCard = document.createElement('div'); replyCard.className = 'reply-box'; const textDiv = document.createElement('div'); const span = document.createElement('span'); span.className = 'font-medium'; span.textContent = data.text; textDiv.appendChild(span); const dateDiv = document.createElement('div'); dateDiv.className = 'text-[0.7rem] text-gray-400 mt-1'; dateDiv.textContent = formatearFecha(data.ts); replyCard.append(textDiv, dateDiv); respuestasDiv.appendChild(replyCard); }); } catch(e) { console.error("Error loading replies:", e); respuestasDiv.innerHTML = '<div class="text-[0.7rem] text-red-500">Error al cargar respuestas.</div>'; } }

// ---- ESTRUCTURA DE CARGA DE DATOS ----
async function fetchData() {
    try {
        const now = Date.now();
        const thoughtsPromise = db.collection("thoughts").get();
        const capsulesPromise = db.collection("capsules").where("openAt", "<=", now).get();
        const [thoughtsSnap, capsulesSnap] = await Promise.all([thoughtsPromise, capsulesPromise]);
        
        let allItems = [];
        const addItem = (doc, type) => {
            const data = doc.data();
            if (data && data.text && (data.ts || data.openAt)) {
                allItems.push({ id: doc.id, data: data, type: type });
            }
        };
        thoughtsSnap.forEach(doc => addItem(doc, 'thought'));
        capsulesSnap.forEach(doc => addItem(doc, 'capsule'));
        
        allItems.sort((a, b) => {
            const timeA = a.data.openAt || a.data.ts || 0;
            const timeB = b.data.openAt || b.data.ts || 0;
            return timeB - timeA;
        });
        
        allThoughtsAndCapsules = allItems;
    } catch (e) {
        console.error("Error fetching data:", e);
        allThoughtsAndCapsules = [];
    }
}

async function refreshAllData() {
    loadGlobalThoughts(globalPage, true);
    await fetchData();
    loadGlobalThoughts(globalPage);
    loadGlobalCount();
    loadCountryRanking();
    loadEstadisticasAnonimas();
    loadMap();
    setTimeout(checkNewReplies, 2000);
}

// ---- FUNCIONES DE CARGA ----
function loadGlobalThoughts(page = 1, showSkeleton = false) {
  const globalThoughts = document.getElementById('globalThoughts');
  const globalPagination = document.getElementById('globalPagination');
  if (!globalThoughts) return;

  if (showSkeleton) {
    globalThoughts.innerHTML = createThoughtSkeleton(5);
    globalPagination.innerHTML = '';
    return;
  }
  
  if (allThoughtsAndCapsules.length === 0) {
      globalThoughts.innerHTML = `<p class="empty-state">${translations[currentLang]['empty.no_thoughts']}</p>`;
      globalPagination.innerHTML = '';
      return;
  }

  globalThoughts.innerHTML = '';
  globalMaxPages = Math.max(1, Math.ceil(allThoughtsAndCapsules.length / PAGE_SIZE));
  page = Math.max(1, Math.min(page, globalMaxPages));
  globalPage = page;
  const start = (page - 1) * PAGE_SIZE;
  const pagedItems = allThoughtsAndCapsules.slice(start, start + PAGE_SIZE);
  for (let item of pagedItems) {
    const { id: thoughtId, data, type } = item;
    if (data.user !== getAnonUserId()) { registrarEco(thoughtId, type); }
    const isCapsule = type === 'capsule';
    const headerIcon = isCapsule ? '🕰️' : '';
    const card = document.createElement('div');
    card.className = 'p-4 bg-white rounded-lg shadow-sm';
    const headerDiv = document.createElement('div');
    headerDiv.className = 'flex items-center space-x-2 mb-2';
    headerDiv.innerHTML = `<span class="text-xs font-medium">${getCountryName(data.country) || "🌐"} ${headerIcon}</span>`;
    const p = document.createElement('p');
    p.className = 'font-medium text-justify';
    p.textContent = data.text;
    const dateDiv = document.createElement('div');
    dateDiv.className = 'text-[0.7rem] text-gray-400 mt-1';
    dateDiv.textContent = formatearFecha(data.openAt || data.ts);
    const interactionDiv = document.createElement('div');
    interactionDiv.className = 'mt-2 flex items-center space-x-4';
    if (data.user !== getAnonUserId()) {
        const mainActions = document.createElement('div');
        mainActions.className = 'flex space-x-4';
        if (!isCapsule) { mainActions.innerHTML = `<button class="action-btn" onclick="mostrarCajaRespuesta('${thoughtId}', this)">${translations[currentLang]['feed.action_reply']}</button>`; }
        const translateBtn = document.createElement('button');
        translateBtn.className = 'action-btn';
        translateBtn.textContent = translations[currentLang]['feed.action_translate'];
        translateBtn.onclick = () => handleTranslateClick(data.text);
        mainActions.appendChild(translateBtn);
        interactionDiv.appendChild(mainActions);
        const reportAction = document.createElement('div');
        reportAction.className = 'flex-grow text-right';
        if (!isCapsule) {
            const reportBtn = document.createElement('button');
            reportBtn.className = 'action-btn report-btn';
            reportBtn.textContent = translations[currentLang]['feed.action_report'];
            reportBtn.onclick = (e) => reportThought(thoughtId, e.target);
            reportAction.appendChild(reportBtn);
        }
        interactionDiv.appendChild(reportAction);
    } else {
        interactionDiv.innerHTML = `<span class="text-xs text-gray-400">${translations[currentLang][isCapsule ? 'feed.capsule_label' : 'feed.own_thought_label']}</span>`;
    }
    const respuestasDiv = document.createElement('div');
    respuestasDiv.className = 'respuestas mt-2';
    const cajaRespuestaDiv = document.createElement('div');
    cajaRespuestaDiv.className = 'caja-respuesta mt-2 hidden';
    card.append(headerDiv, p, dateDiv, interactionDiv, respuestasDiv, cajaRespuestaDiv);
    globalThoughts.appendChild(card);
    if (!isCapsule) { mostrarRespuestas(thoughtId, respuestasDiv); }
  }
  if (globalPagination) { 
      const prev = translations[currentLang]['feed.pagination_previous'];
      const next = translations[currentLang]['feed.pagination_next'];
      const page_str = translations[currentLang]['feed.pagination_page'];
      const of_str = translations[currentLang]['feed.pagination_of'];
      globalPagination.innerHTML = `<button onclick="loadGlobalThoughts(${globalPage-1})" ${globalPage<=1?'disabled':''}>${prev}</button><span>${page_str} ${globalPage} ${of_str} ${globalMaxPages}</span><button onclick="loadGlobalThoughts(${globalPage+1})" ${globalPage>=globalMaxPages?'disabled':''}>${next}</button>`;
  }
}

window.mostrarCajaRespuesta = function(thoughtId, btn) {
    const card = btn.closest('.p-4');
    const caja = card.querySelector('.caja-respuesta');
    if (!caja.classList.contains('hidden')) {
        caja.classList.add('hidden');
        caja.innerHTML = '';
        return;
    }
    document.querySelectorAll('.caja-respuesta').forEach(el => {
        el.classList.add('hidden');
        el.innerHTML = '';
    });
    caja.classList.remove('hidden');
    const placeholder = translations[currentLang]['feed.reply_placeholder'];
    const buttonText = translations[currentLang]['feed.send_reply_button'];
    
    // Crear elementos con la nueva estructura
    const container = document.createElement('div');
    container.className = 'textarea-container';

    const textarea = document.createElement('textarea');
    textarea.className = 'w-full p-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm';
    textarea.rows = 2;
    textarea.maxLength = 300;
    textarea.placeholder = placeholder;

    const charCounter = document.createElement('div');
    charCounter.className = 'char-counter';

    const enviarBtn = document.createElement('button');
    enviarBtn.className = 'mt-2 px-4 py-1 rounded-lg bg-blue-500 text-white text-sm font-medium shadow hover:bg-blue-600 transition enviarRespuestaBtn';
    enviarBtn.textContent = buttonText;
    
    // Añadir al DOM
    container.append(textarea, charCounter);
    caja.append(container, enviarBtn);

    // Configurar funcionalidades
    const storageKey = `libre_draft_reply_${thoughtId}`;
    setupTextareaFeatures(textarea, charCounter, storageKey);

    const respuestasDiv = card.querySelector('.respuestas');
    enviarBtn.onclick = async function() {
        await enviarRespuesta(thoughtId, textarea.value, respuestasDiv, enviarBtn, textarea, storageKey);
        caja.classList.add('hidden');
        caja.innerHTML = '';
    };
};
async function registrarEco(docId, type = 'thought') { if (!countryReady || type !== 'thought') return; try { const ecoRef = db.collection("thoughts").doc(docId).collection("eco").doc(userCountry); await db.runTransaction(async (tx) => { const doc = await tx.get(ecoRef); if (!doc.exists) { tx.set(ecoRef, { count: 1 }); } else { tx.update(ecoRef, { count: firebase.firestore.FieldValue.increment(1) }); } }); } catch (e) { /* Silently fail */ } }

async function loadMyThoughts(page = 1) {
    const myThoughtsDiv = document.getElementById('myThoughts');
    const myPagination = document.getElementById('myPagination');
    const personalStatsDiv = document.getElementById('personalStats');

    if (!myThoughtsDiv) return;

    myThoughtsDiv.innerHTML = createMyThoughtSkeleton(3);
    personalStatsDiv.innerHTML = createStatsSkeleton();
    myPagination.innerHTML = '';

    try {
        const myAnonId = getAnonUserId();
        const myThoughtsSnapshot = await db.collection("thoughts").where("user", "==", myAnonId).orderBy("ts", "desc").get();
        const myThoughts = myThoughtsSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));

        let totalRepliesReceived = 0;
        const countriesReached = new Set();
        
        for (const thought of myThoughts) {
            const repliesSnap = await db.collection("thoughts").doc(thought.id).collection("replies").get();
            totalRepliesReceived += repliesSnap.size;

            const ecoSnap = await db.collection("thoughts").doc(thought.id).collection("eco").get();
            ecoSnap.forEach(doc => countriesReached.add(doc.id));
        }

        personalStatsDiv.innerHTML = `
            <div class="titulo" data-translate-key="mine.stats_title">${translations[currentLang]['mine.stats_title']}</div>
            <div class="dato"><span data-translate-key="mine.stats_thoughts_sent">${translations[currentLang]['mine.stats_thoughts_sent']}</span> <strong>${myThoughts.length}</strong></div>
            <div class="dato"><span data-translate-key="mine.stats_replies_received">${translations[currentLang]['mine.stats_replies_received']}</span> <strong>${totalRepliesReceived}</strong></div>
            <div class="dato"><span data-translate-key="mine.stats_global_reach">${translations[currentLang]['mine.stats_global_reach']}</span> <strong>${countriesReached.size}</strong> <span data-translate-key="mine.stats_countries">${translations[currentLang]['mine.stats_countries']}</span></div>
        `;

        myMaxPages = Math.max(1, Math.ceil(myThoughts.length / PAGE_SIZE));
        page = Math.max(1, Math.min(page, myMaxPages));
        myPage = page;

        if (myThoughts.length === 0) {
            myThoughtsDiv.innerHTML = `<p class="empty-state">${translations[currentLang]['empty.my_thoughts']}</p>`;
        } else {
            myThoughtsDiv.innerHTML = '';
            const start = (page - 1) * PAGE_SIZE;
            const pagedItems = myThoughts.slice(start, start + PAGE_SIZE);

            for (const thought of pagedItems) {
                const { id: thoughtId, data } = thought;
                const card = document.createElement('div');
                card.className = 'p-4 bg-white rounded-lg shadow-sm';
                const p = document.createElement('p');
                p.className = 'font-medium text-justify';
                p.textContent = data.text;
                const dateDiv = document.createElement('div');
                dateDiv.className = 'text-[0.7rem] text-gray-400 mt-1';
                dateDiv.textContent = `${translations[currentLang]['mine.sent_on']} ${formatearFecha(data.ts)}`;
                const repliesContainer = document.createElement('div');
                repliesContainer.className = 'mt-3 border-t pt-3';
                const lastSeen = getLastSeenReplyTimestamp(thoughtId);
                const repliesSnap = await db.collection("thoughts").doc(thoughtId).collection("replies").orderBy("ts", "asc").get();
                let hasNewReplies = false;
                if (!repliesSnap.empty) {
                    const latestReplyTs = repliesSnap.docs[repliesSnap.docs.length - 1].data().ts;
                    if (latestReplyTs > lastSeen) hasNewReplies = true;
                }
                const repliesHeader = document.createElement('h4');
                repliesHeader.className = 'text-sm font-semibold text-green-800 mb-2';
                const newBadge = hasNewReplies ? `<span class="ml-2 text-xs font-bold text-red-500">${translations[currentLang]['mine.new_replies_badge']}</span>` : '';
                repliesHeader.innerHTML = `${translations[currentLang]['mine.replies_received_title']} (${repliesSnap.size}) ${newBadge}`;
                repliesContainer.appendChild(repliesHeader);
                const repliesDiv = document.createElement('div');
                if (repliesSnap.empty) {
                    repliesDiv.innerHTML = `<p class="text-xs text-gray-500">${translations[currentLang]['mine.no_replies']}</p>`;
                } else {
                    repliesSnap.forEach(doc => {
                        const replyData = doc.data();
                        const replyCard = document.createElement('div');
                        replyCard.className = 'reply-box';
                        const textDiv = document.createElement('div');
                        const span = document.createElement('span');
                        span.className = 'font-medium text-sm';
                        span.textContent = replyData.text;
                        textDiv.appendChild(span);
                        const replyDateDiv = document.createElement('div');
                        replyDateDiv.className = 'text-[0.7rem] text-gray-400 mt-1';
                        replyDateDiv.textContent = formatearFecha(replyData.ts);
                        replyCard.append(textDiv, replyDateDiv);
                        repliesDiv.appendChild(replyCard);
                    });
                }
                repliesContainer.appendChild(repliesDiv);
                card.append(p, dateDiv, repliesContainer);
                myThoughtsDiv.appendChild(card);
            }
        }
        if (myPagination) {
            const prev = translations[currentLang]['feed.pagination_previous'];
            const next = translations[currentLang]['feed.pagination_next'];
            const page_str = translations[currentLang]['feed.pagination_page'];
            const of_str = translations[currentLang]['feed.pagination_of'];
            myPagination.innerHTML = `<button onclick="loadMyThoughts(${myPage-1})" ${myPage<=1?'disabled':''}>${prev}</button><span>${page_str} ${myPage} ${of_str} ${myMaxPages}</span><button onclick="loadMyThoughts(${myPage+1})" ${myPage>=myMaxPages?'disabled':''}>${next}</button>`;
        }
        markRepliesAsSeen(myThoughts);
    } catch(e) {
        console.error("Error loading my thoughts:", e);
        myThoughtsDiv.innerHTML = '<p class="empty-state text-red-700">Error loading your thoughts.</p>';
        personalStatsDiv.innerHTML = '';
    }
}

function loadGlobalCount() { document.getElementById('globalCountNum').textContent = allThoughtsAndCapsules.filter(item => item.type === 'thought').length; }
function loadCountryRanking() { const el = document.getElementById('countryRanking'); if (!el) return; const countryCounts = {}; allThoughtsAndCapsules.forEach(({data}) => { if(data.country) { const c = data.country || "Desconocido"; countryCounts[c] = (countryCounts[c] || 0) + 1; } }); const sorted = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]); let html = `<div class="mb-2 font-semibold text-blue-800">${translations[currentLang]['feed.ranking_title']}</div><ul class="list-disc pl-4">`; sorted.slice(0, 5).forEach(([country, count]) => { html += `<li><span class="font-bold">${getCountryName(country)}</span>: ${count}</li>`; }); html += '</ul>'; el.innerHTML = html; }
function loadEstadisticasAnonimas() {
    const el = document.getElementById('estadisticasAnonimas');
    if (!el) return;
    const ahora = new Date();
    const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const inicioSemana = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 6);
    let pensamientosHoy = 0;
    let paisesSemana = new Set();
    let recordDia = 0;
    const pensamientosPorDia = {};

    allThoughtsAndCapsules.forEach(({data}) => {
        if (data && data.ts && data.type === 'thought') {
            const fechaDoc = new Date(data.ts);
            if (fechaDoc >= hoy) {
                pensamientosHoy++;
            }
            if (fechaDoc >= inicioSemana) {
                paisesSemana.add(data.country || "Desconocido");
            }
            const diaKey = fechaDoc.toISOString().split('T')[0];
            pensamientosPorDia[diaKey] = (pensamientosPorDia[diaKey] || 0) + 1;
        }
    });
    
    recordDia = Object.keys(pensamientosPorDia).length > 0 ? Math.max(...Object.values(pensamientosPorDia)) : 0;

    el.innerHTML = `<div class="titulo">${translations[currentLang]['feed.stats_title']}</div>
                    <div class="dato">${translations[currentLang]['feed.stats_today']} <strong>${pensamientosHoy}</strong></div>
                    <div class="dato">${translations[currentLang]['feed.stats_week_countries']} <strong>${paisesSemana.size}</strong></div>
                    <div class="dato">${translations[currentLang]['feed.stats_record']} <strong>${recordDia}</strong></div>`;
}

function loadMap() {
  if (map) { map.remove(); map = null; }
  const mapEl = document.getElementById('map');
  if (!mapEl || typeof L === 'undefined' || typeof COUNTRIES === 'undefined') return;
  mapEl.innerHTML = "";
  map = L.map('map', { attributionControl: false }).setView([20,0], 1.1);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
  const countryCounts = {};
  allThoughtsAndCapsules.forEach(({data}) => {
    const c = data.country || "Desconocido";
    countryCounts[c] = (countryCounts[c] || 0) + 1;
  });
  for (let [country, count] of Object.entries(countryCounts)) {
    const countryData = COUNTRIES[country] || COUNTRIES["Desconocido"];
    if (countryData && countryData.coords) {
        const marker = L.circleMarker([countryData.coords.lat, countryData.coords.lng], { radius: Math.max(8, Math.min(20, count)), color: "#6D28D9", fillColor: "#C4B5FD", fillOpacity: 0.6 }).addTo(map);
        marker.bindPopup(`<b>${getCountryName(country)}</b>: ${count} pensamientos`);
    }
  }
}

// ---- CÁPSULA DEL TIEMPO ----
function setupCapsuleInputs() {
    const dateInput = document.getElementById('capsuleDate');
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    dateInput.min = `${year}-${month}-${day}`;
}
document.getElementById('capsuleBtn').onclick = async function() {
    const date = document.getElementById('capsuleDate').value;
    const time = document.getElementById('capsuleTime').value;
    const msg = document.getElementById('capsuleMessage').value.trim();
    
    if (!date || !time || !msg) {
        showNotification('js.notification.capsule_missing_fields', 'error');
        return;
    }
    if (window.contienePalabraOfensiva(msg)) { showNotification('js.notification.offensive_word', 'error'); return; }
    if (!countryReady) {
        showNotification("js.notification.country_wait", "info");
        return;
    }

    const openAtDate = new Date(`${date}T${time}:00`);
    if (openAtDate <= new Date()) {
        showNotification('js.notification.capsule_in_past', 'error');
        return;
    }
    
    const openAt = openAtDate.getTime();
    try {
        this.disabled = true;
        await db.collection("capsules").add({ text: msg, openAt, ts: Date.now(), country: userCountry, user: getAnonUserId() });
        showNotification('js.notification.capsule_scheduled', 'success', 3000, ` ${date} @ ${time}`);
        const textarea = document.getElementById('capsuleMessage');
        textarea.value = '';
        localStorage.removeItem('libre_draft_capsule');
        const counter = document.getElementById('charCounterCapsule');
        counter.textContent = textarea.getAttribute('maxlength');
        counter.classList.remove('warn', 'danger');
        document.getElementById('capsuleDate').value = '';
        document.getElementById('capsuleTime').value = '';
        loadMyCapsules();
    } catch (e) {
        console.error("Error saving capsule:", e);
        showNotification("js.notification.capsule_error", "error");
    } finally {
        this.disabled = false;
    }
};
async function loadMyCapsules() { const list = document.getElementById('capsulesList'); if (!list) return; list.innerHTML = ''; try { const now = Date.now(); const snapshot = await db.collection("capsules").where("user", "==", getAnonUserId()).orderBy("openAt", "asc").get(); let pendingHtml = ''; let openedHtml = ''; snapshot.forEach(doc => { const data = doc.data(); const createdOn = `${translations[currentLang]['capsule.created_on']} ${formatearFecha(data.ts)}`; const scheduledOn = `${translations[currentLang]['capsule.scheduled_on']} ${formatearFecha(data.ts)}`; if (data.openAt > now) { const scheduledToOpen = `${translations[currentLang]['capsule.scheduled_to_open']} ${formatearFecha(data.openAt)}`; pendingHtml += `<div class="p-4 bg-gray-100 rounded-lg shadow-sm border border-dashed border-gray-300"><div class="flex items-center text-blue-800 font-bold text-sm"><span class="mr-2">🔒</span><span>${scheduledToOpen}</span></div><div class="text-[0.7rem] text-gray-500 mt-1">${createdOn}</div></div>`; } else { const openedOn = `${translations[currentLang]['capsule.opened_on']} ${formatearFecha(data.openAt)}`; const card = document.createElement('div'); card.className = 'p-4 bg-white rounded-lg shadow-md'; const header = document.createElement('div'); header.className = 'mb-2 text-blue-700 font-bold text-sm'; header.textContent = openedOn; const p = document.createElement('p'); p.className = 'font-medium text-justify'; p.textContent = data.text; const footer = document.createElement('div'); footer.className = 'text-[0.7rem] text-gray-400 mt-1'; footer.textContent = scheduledOn; card.append(header, p, footer); openedHtml = card.outerHTML + openedHtml; } }); let finalHtml = ''; if (pendingHtml) { finalHtml += `<h3 class="text-lg font-semibold text-blue-900 mb-3">${translations[currentLang]['capsule.pending_title']}</h3><div class="space-y-4">${pendingHtml}</div>`; } if (openedHtml) { finalHtml += `<h3 class="text-lg font-semibold text-blue-900 mt-6 mb-3">${translations[currentLang]['capsule.opened_title']}</h3><div class="space-y-4">${openedHtml}</div>`; } if (finalHtml) { list.innerHTML = finalHtml; } else { list.innerHTML = `<p class="empty-state">${translations[currentLang]['empty.my_capsules']}</p>`; } } catch (e) { console.error("Error loading my capsules:", e); list.innerHTML = '<p class="empty-state text-red-700">Error loading your capsules.</p>'; } }

// ---- NAVEGACIÓN POR TABS ----
const TABS = ['feed', 'mine', 'capsule', 'about', 'revelacion'];
function showTab(tabId) {
  TABS.forEach(id => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); });
  const active = document.getElementById(tabId);
  if (active) active.classList.remove('hidden');
  
  if (revelationCountdownInterval) clearInterval(revelationCountdownInterval);
  
  if(tabId === 'feed') { 
    refreshAllData();
    mostrarFraseInspiradoraEnTextarea();
  }
  else if(tabId === 'mine') { loadMyThoughts(myPage); }
  else if(tabId === 'capsule') { setupCapsuleInputs(); loadMyCapsules(); }
  else if(tabId === 'revelacion') { loadRevelacionDiaria(); }
}

function showLegalSection(sectionId) {
    showTab('about');
    setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 100);
}

// ---- GENERADORES DE ESQUELETOS DE CARGA ----
function createThoughtSkeleton(count = 1) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="p-4 bg-white rounded-lg shadow-sm animate-pulse">
                <div class="flex items-center space-x-2 mb-3">
                    <div class="w-12 h-4 bg-gray-200 rounded"></div>
                </div>
                <div class="h-4 bg-gray-200 rounded w-5/6 mb-2"></div>
                <div class="h-4 bg-gray-200 rounded w-4/6 mb-3"></div>
                <div class="h-3 bg-gray-200 rounded w-1/3"></div>
            </div>
        `;
    }
    return html;
}
function createMyThoughtSkeleton(count = 1) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="p-4 bg-white rounded-lg shadow-sm animate-pulse">
                <div class="h-4 bg-gray-200 rounded w-5/6 mb-2"></div>
                <div class="h-4 bg-gray-200 rounded w-4/6 mb-3"></div>
                <div class="h-3 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div class="border-t pt-3">
                    <div class="h-4 bg-gray-300 rounded w-1/2 mb-3"></div>
                    <div class="h-12 bg-gray-200 rounded"></div>
                </div>
            </div>
        `;
    }
    return html;
}
function createStatsSkeleton() {
    return `
        <div class="stats-box mb-6 animate-pulse">
            <div class="h-5 bg-green-200 rounded w-3/4 mb-3"></div>
            <div class="h-4 bg-green-100 rounded w-1/2 mb-2"></div>
            <div class="h-4 bg-green-100 rounded w-1/2 mb-2"></div>
            <div class="h-4 bg-green-100 rounded w-1/2"></div>
        </div>
    `;
}
function createRevelationSkeleton(count = 1) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="revelation-answer animate-pulse">
                <div class="h-4 bg-purple-200 rounded w-5/6 mb-2"></div>
                <div class="h-3 bg-purple-200 rounded w-1/3 mt-2"></div>
            </div>
        `;
    }
    return html;
}

// ---- INICIO DE LA APLICACIÓN ----
document.addEventListener('DOMContentLoaded', () => {
    setupWelcomeScreen();
    detectCountry();
    initializeApp();
});
