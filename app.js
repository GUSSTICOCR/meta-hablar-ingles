// Lógica Principal de BRAD. IA - Plataforma de Aprendizaje Conversacional de Elite

// Configuración de Gemini API y Stripe
let GEMINI_API_KEY = localStorage.getItem("BRAD_GEMINI_API_KEY") || "";
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";

// STRIPE PAYMENT LINK (Configurable por el administrador)
// Los usuarios pueden crear su enlace de pago en stripe.com por 1,500 CRC / mes e insertarlo aquí:
let STRIPE_PAYMENT_LINK = "https://buy.stripe.com/mock_hablaringles_premium_1500"; 

// Códigos de activación válidos para SINPE Móvil o Transferencia
const VALID_ACTIVATION_CODES = [
    "SINPE1500",
    "META1500",
    "SINPE3500",
    "META3500",
    "BRADPRO",
    "HABLAINGLES2026",
    "FREEPASS",
    "COSTARICAINGLES"
];

// Perfiles de Tutores Disponibles
const TUTORS = {
    brad: {
        name: "Brad",
        accent: "Americano (Casual)",
        lang: "en-US",
        rate: 0.85,
        avatar: "brad_avatar.png",
        systemPrompt: `Eres Brad, un tutor de inglés interactivo súper paciente para principiantes de cero absoluto.
Tu tono es súper amigable, jovial, casual y alentador. Utilizas frases sencillas y cotidianas de nivel básico (A1-A2).
Guiarás al alumno paso a paso. Si debe repetir algo, di "Repeat after me: [palabra/frase]".
Haz siempre preguntas cortas para motivarlo.`
    },
    emma: {
        name: "Emma",
        accent: "Británico (Académico)",
        lang: "en-GB",
        rate: 0.82,
        avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200",
        systemPrompt: `Eres Emma, una tutora de inglés con acento británico formal y académico.
Tu tono es elegante, refinado, sumamente educado y estructurado. Te enfocas en la pronunciación exacta y la excelencia gramatical.
Incentiva al estudiante de manera culta y clara. Si debe repetir algo, di "Repeat after me: [palabra/frase]".`
    },
    sarah: {
        name: "Sarah",
        accent: "Americano (Negocios)",
        lang: "en-US",
        rate: 0.88,
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200",
        systemPrompt: `Eres Sarah, una tutora especializada en inglés corporativo y de negocios.
Tu tono es dinámico, profesional, empático y orientado a resultados. Ayudas al usuario con preparación para entrevistas de trabajo, vocabulario de oficina y presentaciones formales.
Desafía al estudiante a ser fluido y claro en entornos laborales. Si debe repetir algo, di "Repeat after me: [palabra/frase]".`
    }
};

// Perfil de Usuario y Estado Principal
let userProfile = {
    name: "",
    stage: "welcome", // welcome, learning, active_practice
    learningMode: "mix", // mix (bilingual), english (full english)
    totalCharactersUsed: 0,
    characterLimit: 1200,
    isPremium: false,
    selectedTutor: "brad",
    vocabulary: {}, // Mazo de vocabulario SRS
    streak: 1,
    lastActiveDate: "",
    history: [],
    weeklyActivity: [120, 300, 0, 420, 180, 0, 0] // Muestra de caracteres por día
};

// Cargar Datos Guardados de LocalStorage
function loadUserData() {
    const savedData = localStorage.getItem("BRAD_USER_PROFILE");
    if (savedData) {
        try {
            const parsed = JSON.parse(savedData);
            userProfile = { ...userProfile, ...parsed };
        } catch (e) {
            console.error("Error cargando perfil:", e);
        }
    }
    
    // Verificar e inyectar estado Premium en la UI si está activo
    if (userProfile.isPremium || GEMINI_API_KEY) {
        unlockPremiumFeaturesInUI();
    }

    // Sincronizar UI con clave Gemini
    if (GEMINI_API_KEY) {
        const apiStatusEl = document.getElementById("api-key-status");
        if (apiStatusEl) {
            apiStatusEl.innerText = "✓ Clave Gemini Guardada y Activa (Acceso Ilimitado)";
            apiStatusEl.style.color = "var(--accent-success)";
            apiStatusEl.style.display = "block";
        }
        const apiInputEl = document.getElementById("api-key-input");
        if (apiInputEl) apiInputEl.value = GEMINI_API_KEY;
    }

    updateStreak();
    renderVocabularyGrid();
    updateStatsDashboard();
}

// Desbloquear estéticamente elementos Premium
function unlockPremiumFeaturesInUI() {
    const banner = document.getElementById("sidebar-premium-banner");
    if (banner) banner.style.display = "none";
    
    const limitBadge = document.getElementById("limit-badge");
    if (limitBadge) {
        limitBadge.innerText = "Premium Activo (Sin límites)";
        limitBadge.style.color = "#fbbf24";
    }
    
    const paywall = document.getElementById("paywall");
    if (paywall) paywall.style.display = "none";
}

// Guardar Datos en LocalStorage
function saveUserData() {
    localStorage.setItem("BRAD_USER_PROFILE", JSON.stringify(userProfile));
    updateStatsDashboard();
}

// Manejar la Racha de Estudio Diaria
function updateStreak() {
    const today = new Date().toDateString();
    if (userProfile.lastActiveDate !== today) {
        if (userProfile.lastActiveDate) {
            const lastDate = new Date(userProfile.lastActiveDate);
            const diffTime = Math.abs(new Date(today) - lastDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
                userProfile.streak += 1;
            } else if (diffDays > 1) {
                userProfile.streak = 1; 
            }
        }
        userProfile.lastActiveDate = today;
        saveUserData();
    }
}

// Elementos de la Interfaz
const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const typingIndicator = document.getElementById("typing");
const micControl = document.getElementById("mic-control");
const limitBadge = document.getElementById("limit-badge");
const avatarImg = document.getElementById("avatar-img");
const onboardingStep1 = document.getElementById("onboarding-step-1");
const paywallModal = document.getElementById("paywall");
const celebrationModal = document.getElementById("celebration-modal");

// EFECTOS DE SONIDO SINTÉTICOS PREMIUM (Web Audio API)
let audioCtx = null;
function playUISound(type) {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        const now = audioCtx.currentTime;

        if (type === 'mic-on') {
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
            osc.start(now);
            osc.stop(now + 0.12);
        } else if (type === 'mic-off') {
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.exponentialRampToValueAtTime(440, now + 0.12);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
            osc.start(now);
            osc.stop(now + 0.12);
        } else if (type === 'click') {
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.setValueAtTime(300, now + 0.05);
            gain.gain.setValueAtTime(0.02, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
        } else if (type === 'success') {
            osc.frequency.setValueAtTime(523.25, now); // C5
            osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
            osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
            gain.gain.setValueAtTime(0.04, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            osc.start(now);
            osc.stop(now + 0.35);
        } else if (type === 'victory') {
            // Melodía triunfal gloriosa para pago completado
            const duration = 0.6;
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(523.25, now); // C5
            osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
            osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
            osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6
            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
            osc.start(now);
            osc.stop(now + duration);
        }
    } catch (e) {
        console.log("Web Audio API bloqueada o no soportada:", e.message);
    }
}

// CONTROLADOR DE PESTAÑAS
function switchTab(tabId) {
    playUISound('click');
    
    document.querySelectorAll(".menu-item, .bottom-nav-btn").forEach(el => {
        el.classList.remove("active");
    });
    
    document.querySelectorAll(".dashboard-section").forEach(sec => {
        sec.classList.remove("active");
    });

    const sideMenu = document.getElementById(`menu-${tabId}`);
    const bottomMenu = document.getElementById(`bmenu-${tabId}`);
    if (sideMenu) sideMenu.classList.add("active");
    if (bottomMenu) bottomMenu.classList.add("active");

    const section = document.getElementById(`section-${tabId}`);
    if (section) section.classList.add("active");

    if (tabId === 'vocab') {
        renderVocabularyGrid();
    } else if (tabId === 'stats') {
        updateStatsDashboard();
    }
}

// SELECCIÓN DE TUTOR EN AJUSTES
function selectTutor(tutorId) {
    if (!TUTORS[tutorId]) return;
    
    playUISound('success');
    userProfile.selectedTutor = tutorId;
    saveUserData();

    document.querySelectorAll(".tutor-card").forEach(card => {
        card.classList.remove("selected");
    });
    const tutorCard = document.getElementById(`tutor-${tutorId}`);
    if (tutorCard) tutorCard.classList.add("selected");

    const activeTutor = TUTORS[tutorId];
    const tutorAvatar = document.getElementById("avatar-img");
    const tutorNameDisplay = document.getElementById("avatar-name-display");
    if (tutorAvatar) tutorAvatar.src = activeTutor.avatar;
    if (tutorNameDisplay) tutorNameDisplay.innerText = activeTutor.name;

    const onboardingAvatar = document.getElementById("onboarding-avatar-img");
    const onboardingName = document.getElementById("onboarding-avatar-name");
    if (onboardingAvatar) onboardingAvatar.src = activeTutor.avatar;
    if (onboardingName) onboardingName.innerText = activeTutor.name;
}

// MODO DE CURSO (MIXTO VS INGLÉS PURO)
function selectCourseMode(mode, element) {
    playUISound('click');
    userProfile.learningMode = mode;
    
    document.querySelectorAll(".option-card").forEach(card => {
        card.classList.remove("selected");
    });
    element.classList.add("selected");
    saveUserData();
}

// INICIAR CONVERSACIÓN DE CHAT TRAS ONBOARDING
function startAppChat() {
    playUISound('success');
    onboardingStep1.style.display = "none";
    
    const activeTutor = TUTORS[userProfile.selectedTutor];
    selectTutor(userProfile.selectedTutor);

    chatBox.innerHTML = "";
    
    let welcomeEnglish = "";
    let welcomeSpanish = "";

    if (activeTutor.name === "Brad") {
        welcomeEnglish = "Hello! I am Brad, your AI English coach. Let's start speaking English today!";
        welcomeSpanish = "¡Hola! Soy Brad, tu entrenador de inglés con IA. ¡Comencemos a hablar inglés hoy!";
    } else if (activeTutor.name === "Emma") {
        welcomeEnglish = "Good day! I am Emma, your British English tutor. Shall we begin speaking English?";
        welcomeSpanish = "¡Buen día! Soy Emma, tu tutora de inglés británico. ¿Comenzamos a hablar inglés?";
    } else {
        welcomeEnglish = "Hello! I am Sarah. Let's practice business English and boost your career today!";
        welcomeSpanish = "¡Hola! Soy Sarah. ¡Practiquemos inglés de negocios y potenciemos tu carrera hoy!";
    }

    if (userProfile.learningMode === "english") {
        welcomeEnglish += " I will talk to you exclusively in English. Tell me, what is your name?";
        appendMessage("bot", welcomeEnglish);
    } else {
        welcomeEnglish += " Don't worry if you are a beginner. I will help you. Tell me, what is your name?";
        welcomeSpanish += " No te preocupes si eres principiante. Te ayudaré. Dime, ¿cuál es tu nombre?";
        appendMessage("bot", welcomeEnglish, welcomeSpanish);
    }
}

// CONFIGURACIÓN DE RECONOCIMIENTO DE VOZ
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;
let autoRestartRecognition = false;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = true;

    recognition.onstart = () => {
        isListening = true;
        micControl.classList.add("active");
        playUISound('mic-on');
        startVisualizerAnim("listening");
    };

    recognition.onresult = (event) => {
        const resultIndex = event.resultIndex;
        const text = event.results[resultIndex][0].transcript.trim();
        if (text) {
            userInput.value = text;
            sendMessage();
        }
    };

    recognition.onerror = (e) => {
        console.error("Reconocimiento de voz error:", e.error);
        if (e.error === 'not-allowed') {
            alert("Acceso al micrófono denegado. Permite el micrófono en tu navegador.");
            autoRestartRecognition = false;
            micControl.classList.remove("active");
            stopVisualizerAnim();
        }
    };

    recognition.onend = () => {
        isListening = false;
        if (autoRestartRecognition) {
            try {
                recognition.start();
                micControl.classList.add("active");
            } catch (err) {}
        } else {
            micControl.classList.remove("active");
            playUISound('mic-off');
            stopVisualizerAnim();
        }
    };
}

// Activar o desactivar micrófono manos libres
function toggleVoice() {
    if (!recognition) {
        alert("La entrada por voz no está disponible en este navegador. Te sugerimos Google Chrome.");
        return;
    }
    
    if (autoRestartRecognition) {
        autoRestartRecognition = false;
        recognition.stop();
        micControl.classList.remove("active");
        return;
    }

    autoRestartRecognition = true;
    userInput.value = ""; 
    try {
        recognition.start();
    } catch (err) {
        micControl.classList.add("active");
    }
}

// Manejar presionar enter
function handleKeyPress(event) {
    if (event.key === "Enter") {
        sendMessage();
    }
}

// SÍNTESIS DE VOZ INTELIGENTE (Text-to-Speech)
function speakText(englishText, spanishText = "") {
    if ('speechSynthesis' in window) {
        if (recognition && isListening) {
            recognition.stop();
        }

        window.speechSynthesis.cancel();
        
        const cleanEnglish = englishText.replace(/\[.*?\]/g, "").replace(/\*+/g, "");
        const activeTutor = TUTORS[userProfile.selectedTutor];

        if (cleanEnglish.toLowerCase().includes("repeat after me")) {
            const parts = cleanEnglish.split(/repeat after me:?/i);
            const intro = (parts[0] || "") + " Repeat after me... ";
            const repeatWord = parts[1] || "";
            
            const utteranceIntro = new SpeechSynthesisUtterance(intro);
            utteranceIntro.lang = activeTutor.lang;
            utteranceIntro.rate = activeTutor.rate;
            setTutorVoice(utteranceIntro, activeTutor.lang);

            utteranceIntro.onstart = () => {
                avatarImg.classList.add("speaking");
                startVisualizerAnim("speaking");
            };
            
            utteranceIntro.onend = () => {
                setTimeout(() => {
                    const utteranceRepeat = new SpeechSynthesisUtterance(repeatWord);
                    utteranceRepeat.lang = activeTutor.lang;
                    utteranceRepeat.rate = activeTutor.rate * 0.85;
                    setTutorVoice(utteranceRepeat, activeTutor.lang);
                    
                    utteranceRepeat.onstart = () => {
                        avatarImg.classList.add("speaking");
                        startVisualizerAnim("speaking");
                    };
                    
                    utteranceRepeat.onend = () => {
                        avatarImg.classList.remove("speaking");
                        stopVisualizerAnim();
                        
                        setTimeout(() => {
                            const utteranceRepeat2 = new SpeechSynthesisUtterance("One more time... " + repeatWord);
                            utteranceRepeat2.lang = activeTutor.lang;
                            utteranceRepeat2.rate = activeTutor.rate * 0.85;
                            setTutorVoice(utteranceRepeat2, activeTutor.lang);
                            
                            utteranceRepeat2.onstart = () => {
                                avatarImg.classList.add("speaking");
                                startVisualizerAnim("speaking");
                            };
                            
                            utteranceRepeat2.onend = () => {
                                avatarImg.classList.remove("speaking");
                                stopVisualizerAnim();
                                
                                if (spanishText && userProfile.learningMode === "mix") {
                                    speakSpanishTranslation(spanishText);
                                } else {
                                    if (autoRestartRecognition) {
                                        try { recognition.start(); } catch(e) {}
                                    }
                                }
                            };
                            window.speechSynthesis.speak(utteranceRepeat2);
                        }, 1200);
                    };
                    window.speechSynthesis.speak(utteranceRepeat);
                }, 1000);
            };
            
            window.speechSynthesis.speak(utteranceIntro);
        } else {
            const utteranceEng = new SpeechSynthesisUtterance(cleanEnglish);
            utteranceEng.lang = activeTutor.lang;
            utteranceEng.rate = activeTutor.rate;
            setTutorVoice(utteranceEng, activeTutor.lang);

            utteranceEng.onstart = () => {
                avatarImg.classList.add("speaking");
                startVisualizerAnim("speaking");
            };
            
            utteranceEng.onend = () => {
                avatarImg.classList.remove("speaking");
                stopVisualizerAnim();
                
                if (spanishText && userProfile.learningMode === "mix") {
                    speakSpanishTranslation(spanishText);
                } else {
                    if (autoRestartRecognition) {
                        try { recognition.start(); } catch(e) {}
                    }
                }
            };

            window.speechSynthesis.speak(utteranceEng);
        }
    }
}

// Asignar voces nativas de acento
function setTutorVoice(utterance, lang) {
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.toLowerCase().includes(lang.toLowerCase()));
    if (voice) {
        utterance.voice = voice;
    }
}

// Síntesis de voz al Español nativo
function speakSpanishTranslation(text) {
    if (!('speechSynthesis' in window)) return;
    
    const parts = text.split(/(["'].*?["'])/g);
    let index = 0;
    
    function speakNextPart() {
        if (index >= parts.length) {
            if (autoRestartRecognition) {
                try { recognition.start(); } catch(e) {}
            }
            return;
        }
        
        const part = parts[index];
        if (!part || !part.trim()) {
            index++;
            speakNextPart();
            return;
        }
        
        const isQuoted = (part.startsWith('"') && part.endsWith('"')) || (part.startsWith("'") && part.endsWith("'"));
        const cleanPart = part.replace(/["']/g, "").trim();
        
        if (!cleanPart) {
            index++;
            speakNextPart();
            return;
        }
        
        const utterance = new SpeechSynthesisUtterance(cleanPart);
        
        if (isQuoted) {
            utterance.lang = TUTORS[userProfile.selectedTutor].lang;
            utterance.rate = 0.8;
            setTutorVoice(utterance, utterance.lang);
        } else {
            utterance.lang = 'es-ES';
            utterance.rate = 0.95;
            const voices = window.speechSynthesis.getVoices();
            const voice = voices.find(v => v.lang.startsWith('es'));
            if (voice) utterance.voice = voice;
        }
        
        utterance.onstart = () => {
            avatarImg.classList.add("speaking");
            startVisualizerAnim("speaking");
        };
        
        utterance.onend = () => {
            avatarImg.classList.remove("speaking");
            stopVisualizerAnim();
            index++;
            speakNextPart();
        };
        
        utterance.onerror = () => {
            avatarImg.classList.remove("speaking");
            stopVisualizerAnim();
            index++;
            speakNextPart();
        };
        
        window.speechSynthesis.speak(utterance);
    }
    
    speakNextPart();
}

// Inyectar Mensaje en la UI
function appendMessage(sender, text, translation = "", cardData = null) {
    if (!text) return;
    
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", sender);
    
    let formattedText = text.replace(/\n/g, "<br>");
    msgDiv.innerHTML = formattedText;

    if (translation && userProfile.learningMode === "mix") {
        const transSpan = document.createElement("span");
        transSpan.classList.add("translation-hint");
        transSpan.innerText = translation;
        msgDiv.appendChild(transSpan);
    }

    chatBox.appendChild(msgDiv);

    if (cardData && (typeof cardData === 'object') && cardData.english) {
        const cardDiv = document.createElement("div");
        cardDiv.classList.add("reels-card");
        cardDiv.innerHTML = `
            <div class="reels-spanish">${cardData.spanish}</div>
            <div class="reels-english">${cardData.english}</div>
            <div class="reels-pronunciation">${cardData.pronunciation}</div>
        `;
        chatBox.appendChild(cardDiv);
        saveToVocabSRS(cardData);
    }

    chatBox.scrollTop = chatBox.scrollHeight;

    if (sender === "bot") {
        speakText(text, translation);
    }
}

// Guardar Tarjeta de Vocabulario en el Mazo SRS
function saveToVocabSRS(card) {
    const key = card.english.trim().toUpperCase();
    if (!userProfile.vocabulary[key]) {
        userProfile.vocabulary[key] = {
            english: card.english,
            spanish: card.spanish,
            pronunciation: card.pronunciation,
            status: 'learning',
            timestamp: Date.now()
        };
        saveUserData();
    }
}

// Renderizar Mazo de Vocabulario SRS
function renderVocabularyGrid() {
    const container = document.getElementById("vocab-grid-container");
    if (!container) return;
    
    container.innerHTML = "";
    
    const words = Object.values(userProfile.vocabulary);
    
    if (words.length === 0) {
        container.innerHTML = `
            <div class="vocab-empty">
                <div class="vocab-empty-icon">📚</div>
                <h3>Tu Mazo está Vacío</h3>
                <p>Las palabras nuevas que te enseñe tu tutor AI aparecerán aquí automáticamente para que las repases en cualquier momento.</p>
            </div>
        `;
        return;
    }

    words.reverse().forEach(word => {
        const card = document.createElement("div");
        card.classList.add("srs-card");
        
        const isMastered = word.status === 'mastered';
        const badgeClass = isMastered ? 'srs-badge' : 'srs-badge needs-review';
        const badgeText = isMastered ? 'Dominado' : 'Por Repasar';

        card.innerHTML = `
            <div class="srs-card-header">
                <span class="${badgeClass}">${badgeText}</span>
                <button class="btn-audio-play" onclick="playCardAudio('${word.english.replace(/'/g, "\\'")}')" title="Escuchar pronunciación">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.25-2.5-4.06v8.11c1.48-.81 2.5-2.29 2.5-4.05zm-2.5-7.43v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                </button>
            </div>
            <div class="srs-card-body">
                <div class="srs-english">${word.english}</div>
                <div class="srs-spanish">${word.spanish}</div>
                <div class="srs-pronunciation">${word.pronunciation}</div>
            </div>
            <div class="srs-card-footer">
                <button class="srs-btn mastered" onclick="updateSRSStatus('${word.english.replace(/'/g, "\\'")}', 'mastered')">Dominado</button>
                <button class="srs-btn review" onclick="updateSRSStatus('${word.english.replace(/'/g, "\\'")}', 'review')">Repasar</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// Cambiar estado SRS
function updateSRSStatus(englishKey, newStatus) {
    const key = englishKey.trim().toUpperCase();
    if (userProfile.vocabulary[key]) {
        userProfile.vocabulary[key].status = newStatus;
        playUISound('success');
        saveUserData();
        renderVocabularyGrid();
    }
}

// Escuchar pronunciación individual de tarjeta SRS
function playCardAudio(englishText) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const activeTutor = TUTORS[userProfile.selectedTutor];
        const utterance = new SpeechSynthesisUtterance(englishText);
        utterance.lang = activeTutor.lang;
        utterance.rate = activeTutor.rate * 0.9;
        setTutorVoice(utterance, activeTutor.lang);
        window.speechSynthesis.speak(utterance);
    }
}

// Configurar racha e historial dinámico en Dashboard
function updateStatsDashboard() {
    const streakEl = document.getElementById("stats-streak");
    const wordsEl = document.getElementById("stats-words");
    const masteredEl = document.getElementById("stats-mastered");
    
    if (streakEl) streakEl.innerText = `${userProfile.streak} ${userProfile.streak === 1 ? 'Día' : 'Días'}`;
    
    const totalWords = Object.keys(userProfile.vocabulary).length;
    if (wordsEl) wordsEl.innerText = `${totalWords} ${totalWords === 1 ? 'Palabra' : 'Palabras'}`;
    
    const totalMastered = Object.values(userProfile.vocabulary).filter(w => w.status === 'mastered').length;
    if (masteredEl) masteredEl.innerText = `${totalMastered} ${totalMastered === 1 ? 'Palabra' : 'Palabras'}`;

    const chart = document.getElementById("stats-chart");
    if (chart) {
        chart.innerHTML = "";
        const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
        
        days.forEach((day, index) => {
            const charCount = userProfile.weeklyActivity[index] || 0;
            const barHeight = Math.min(130, Math.max(8, charCount / 4));
            
            const isToday = index === new Date().getDay() - 1;
            const activeClass = isToday || charCount > 0 ? "active" : "";

            const barWrapper = document.createElement("div");
            barWrapper.classList.add("chart-bar-wrapper");
            barWrapper.innerHTML = `
                <div class="chart-bar ${activeClass}" style="height: ${barHeight}px;" title="${charCount} letras escritas"></div>
                <div class="chart-day-label">${day}</div>
            `;
            chart.appendChild(barWrapper);
        });
    }
}

// Simular indicador de tutor escribiendo
function setTyping(show) {
    typingIndicator.style.display = show ? "flex" : "none";
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Guardar API Key dinámicamente desde Ajustes
function saveApiKey() {
    const key = document.getElementById("api-key-input").value.trim();
    const statusEl = document.getElementById("api-key-status");
    
    if (key) {
        GEMINI_API_KEY = key;
        localStorage.setItem("BRAD_GEMINI_API_KEY", key);
        userProfile.isPremium = true;
        saveUserData();
        
        statusEl.innerText = "✓ ¡Clave Gemini guardada con éxito! Acceso Premium Ilimitado Activo.";
        statusEl.style.color = "var(--accent-success)";
        statusEl.style.display = "block";
        
        unlockPremiumFeaturesInUI();
        playUISound('success');
    } else {
        GEMINI_API_KEY = "";
        localStorage.removeItem("BRAD_GEMINI_API_KEY");
        userProfile.isPremium = false;
        saveUserData();
        
        statusEl.innerText = "Clave eliminada. Se utilizará el modo gratuito limitado.";
        statusEl.style.color = "var(--accent-danger)";
        statusEl.style.display = "block";
        
        const banner = document.getElementById("sidebar-premium-banner");
        if (banner) banner.style.display = "block";
    }
}

// ============================================================================
// INTEGRACIÓN DE PASARELA DE PAGOS Y ACTIVACIONES MANUALES
// ============================================================================

// Mostrar el Modal de Cobro/Suscripción
function showCheckoutModal() {
    playUISound('click');
    paywallModal.style.display = "flex";
}

// Cerrar el Modal de Cobro
function closePaywall() {
    playUISound('click');
    paywallModal.style.display = "none";
}

// Redireccionar al usuario a Stripe Payment Link
function handleStripePaymentRedirect() {
    playUISound('success');
    
    // Para entornos locales de prueba, podemos simular que pagan en 2 segundos
    // En producción, esto abrirá el Stripe Link real en su propio navegador/celular.
    if (STRIPE_PAYMENT_LINK.includes("mock_hablaringles")) {
        alert("[Prueba Local] Redireccionando a la pasarela de cobros segura de Stripe por 3,500 CRC/mes. Para propósitos de simulación local, te redirigiremos de inmediato de vuelta con el pago aprobado.");
        // Simular éxito del pago redirigiendo la URL local
        const currentUrl = window.location.origin + window.location.pathname;
        window.location.href = currentUrl + "?payment=success";
    } else {
        // Redireccionar al link real de Stripe
        window.open(STRIPE_PAYMENT_LINK, "_blank");
    }
}

// Validar Códigos de Activación Manual (SINPE Móvil / Cash)
function validateActivationCode() {
    const codeInput = document.getElementById("activation-code-input");
    const code = codeInput.value.trim().toUpperCase();
    
    if (VALID_ACTIVATION_CODES.includes(code)) {
        codeInput.value = "";
        
        // Desbloquear Premium
        userProfile.isPremium = true;
        saveUserData();
        
        // Cerrar Checkout y Abrir Celebración
        paywallModal.style.display = "none";
        showCelebrationModal();
    } else {
        alert("Código de activación inválido. Por favor verifica los caracteres o realiza tu pago vía SINPE Móvil al administrador.");
        playUISound('mic-off');
    }
}

// Mostrar Modal de Celebración de Pago exitoso
function showCelebrationModal() {
    playUISound('victory');
    celebrationModal.style.display = "flex";
    unlockPremiumFeaturesInUI();
}

// Cerrar el Modal de Celebración
function closeCelebrationModal() {
    playUISound('click');
    celebrationModal.style.display = "none";
}

// Activar membresía Premium simulada
function activatePremium() {
    showCheckoutModal();
}

// ENVIAR MENSAJE DEL USUARIO
async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    // Verificar estrictamente los límites de caracteres en modo gratuito
    if (!userProfile.isPremium && userProfile.totalCharactersUsed >= userProfile.characterLimit) {
        showCheckoutModal();
        if (recognition) recognition.stop();
        return;
    }

    appendMessage("user", text);
    userInput.value = "";

    // Contar uso de caracteres
    if (!userProfile.isPremium) {
        userProfile.totalCharactersUsed += text.length;
        if (limitBadge) {
            limitBadge.innerText = `${userProfile.totalCharactersUsed} / ${userProfile.characterLimit} Letras`;
        }
    }

    // Registrar actividad en gráfico semanal (Día actual)
    const todayIndex = (new Date().getDay() + 6) % 7; 
    userProfile.weeklyActivity[todayIndex] = (userProfile.weeklyActivity[todayIndex] || 0) + text.length;

    if (userProfile.stage === "welcome") {
        userProfile.name = text;
        userProfile.stage = "learning";
    }

    saveUserData();
    setTyping(true);

    try {
        const response = await getAICoachResponse(text);
        setTyping(false);
        appendMessage("bot", response.english, response.spanish, response.card);
    } catch (error) {
        setTyping(false);
        console.error(error);
        appendMessage("bot", "Oops! I had a little connection issue. Can you repeat that, please?", "¡Ups! Tuve un pequeño problema de conexión. ¿Puedes repetir eso, por favor?");
    }
}

// LLAMAR A LA API DE GEMINI (CON PERSONA SELECTIVA Y MOTORES DINÁMICOS)
async function getAICoachResponse(userInputText) {
    const tutor = TUTORS[userProfile.selectedTutor];

    if (!GEMINI_API_KEY) {
        return new Promise((resolve) => {
            setTimeout(() => {
                let response = { english: "", spanish: "", card: null };
                
                if (userProfile.stage === "learning") {
                    if (tutor.name === "Brad") {
                        response.english = `Nice to meet you, ${userProfile.name}! Let's start with a very easy word. Repeat after me: "Hello". What does "Hello" mean in Spanish?`;
                        response.spanish = `¡Mucho gusto, ${userProfile.name}! Comencemos con una palabra muy fácil. Repite después de mí: "Hello". ¿Qué significa "Hello" en español?`;
                        response.card = { spanish: "Hola", english: "HELLO", pronunciation: "jelóu" };
                    } else if (tutor.name === "Emma") {
                        response.english = `Pleasure meeting you, ${userProfile.name}! Let us begin with our first expression. Repeat after me: "Thank you". What does it mean?`;
                        response.spanish = `¡Un placer conocerle, ${userProfile.name}! Comencemos con nuestra primera expresión. Repita después de mí: "Thank you". ¿Qué significa?`;
                        response.card = { spanish: "Gracias", english: "THANK YOU", pronunciation: "zanc iú" };
                    } else {
                        response.english = `Great to connect, ${userProfile.name}! Let's practice executive conversation. Repeat after me: "Welcome". What is the meaning?`;
                        response.spanish = `¡Excelente conectar contigo, ${userProfile.name}! Practiquemos conversación ejecutiva. Repite después de mí: "Welcome". ¿Cuál es el significado?`;
                        response.card = { spanish: "Bienvenido", english: "WELCOME", pronunciation: "uélcom" };
                    }
                    userProfile.stage = "active_practice";
                } else {
                    if (tutor.name === "Brad") {
                        response.english = `Excellent! Now, let's learn how to ask someone how they are. Repeat after me: "How are you?". How would you respond?`;
                        response.spanish = `¡Excelente! Ahora, aprendamos a preguntar cómo está alguien. Repite después de mí: "How are you?" (¿Cómo estás?). ¿Cómo responderías?`;
                        response.card = { spanish: "¿Cómo estás?", english: "HOW ARE YOU?", pronunciation: "jáu ar iú" };
                    } else if (tutor.name === "Emma") {
                        response.english = `Spot on! Let us move to standard courtesy. Repeat after me: "Have a nice day". How would you translate this?`;
                        response.spanish = `¡Correcto! Avancemos a cortesía estándar. Repita después de mí: "Have a nice day" (Que tengas un buen día). ¿Cómo traduciría esto?`;
                        response.card = { spanish: "Que tengas un buen día", english: "HAVE A NICE DAY", pronunciation: "jav a nais déi" };
                    } else {
                        response.english = `Exactly! Let's learn a negotiation phrase. Repeat after me: "Let's do it". How do you say it in Spanish?`;
                        response.spanish = `¡Exacto! Aprendamos una frase de negociación. Repite después de mí: "Let's do it" (Hagámoslo). ¿Cómo lo dices en español?`;
                        response.card = { spanish: "Hagámoslo", english: "LET'S DO IT", pronunciation: "lets du it" };
                    }
                }
                saveUserData();
                resolve(response);
            }, 1200);
        });
    }

    const systemPrompt = `
    ${tutor.systemPrompt}
    
    Instrucciones críticas:
    1. Mantén tus respuestas en inglés sumamente cortas, amigables, directas y sencillas (Nivel A1-A2).
    2. Si el alumno debe repetir algo, usa exactamente la estructura: "Repeat after me: [frase/palabra]".
    3. Proporciona una traducción fluida y 100% natural al español.
       * REGLA DE TRADUCCIÓN NATIVA: No uses comillas ni palabras en inglés de forma literal que confundan a la síntesis de voz en español (ej. en lugar de decir 'La palabra "Hello" significa hola', di 'Significa hola' o 'Esa palabra significa hola').
    4. Opcional (Recomendado frecuentemente): Agrega un objeto de tarjeta visual 'card' con la pronunciación fonética simplificada en español.
    
    Perfil del Alumno actual:
    - Nombre: ${userProfile.name}
    - Nivel: Principiante absoluto
    
    Mensaje del estudiante: "${userInputText}"
    
    Devuelve la respuesta en formato JSON estructurado EXACTAMENTE así:
    {
       "english": "Tu respuesta en inglés corta y con una pregunta al final",
       "spanish": "Tu respuesta anterior traducida nativamente al español",
       "card": {
          "spanish": "Texto en español subrayado (ej. ¡Ten un buen día!)",
          "english": "Texto en inglés destacado en MAYÚSCULAS (ej. HAVE A GOOD ONE!)",
          "pronunciation": "Pronunciación fonética práctica en español y minúsculas (ej. jav a gud uan)"
       }
    }
    Nota: Si no estás enseñando una frase nueva en este turno, puedes dejar "card": null.
    `;

    const response = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: systemPrompt
                }]
            }]
        })
    });

    if (!response.ok) {
        throw new Error("Error en conexión con Gemini");
    }

    const data = await response.json();
    try {
        const replyText = data.candidates[0].content.parts[0].text;
        const cleanJSON = replyText.replace(/```json/gi, "").replace(/```/g, "").trim();
        return JSON.parse(cleanJSON);
    } catch (e) {
        console.error("Error parseando respuesta JSON de Gemini:", e);
        return {
            english: "That is perfect! Let's continue speaking. What is your favorite hobby?",
            spanish: "¡Eso es perfecto! Sigamos conversando. ¿Cuál es tu pasatiempo favorito?"
        };
    }
}

// ============================================================================
// MOTOR DE ANIMACIÓN DEL VISUALIZADOR DE ONDAS DE AUDIO HOLOGRÁFICO
// ============================================================================
const canvas = document.getElementById("audio-visualizer");
let canvasCtx = null;
let animId = null;
let visMode = "idle"; 
let wavePhase = 0;

if (canvas) {
    canvasCtx = canvas.getContext("2d");
    
    function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvasCtx.scale(dpr, dpr);
    }
    
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
}

function startVisualizerAnim(mode) {
    visMode = mode;
    if (!animId) {
        drawWave();
    }
}

function stopVisualizerAnim() {
    visMode = "idle";
}

function drawWave() {
    if (!canvas || !canvasCtx) return;
    
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);
    
    canvasCtx.clearRect(0, 0, width, height);
    canvasCtx.lineWidth = 2.5;
    
    let waveCount = 3;
    let amplitude = 0;
    let speed = 0;
    let color = "rgba(59, 130, 246, 0.4)"; 
    
    if (visMode === "speaking") {
        amplitude = 12;
        speed = 0.12;
        waveCount = 4;
        color = "rgba(139, 92, 246, 0.5)"; 
    } else if (visMode === "listening") {
        amplitude = 15;
        speed = 0.18;
        waveCount = 5;
        color = "rgba(16, 185, 129, 0.5)"; 
    } else {
        amplitude = 1.5 + Math.sin(Date.now() * 0.003) * 0.5;
        speed = 0.02;
        waveCount = 1;
        color = "rgba(255, 255, 255, 0.15)";
    }
    
    for (let i = 0; i < waveCount; i++) {
        canvasCtx.beginPath();
        const offset = i * (Math.PI / waveCount);
        const currentAmp = amplitude * (1 - i * 0.2);
        
        canvasCtx.strokeStyle = i === 0 ? color.replace("0.4", "0.8").replace("0.5", "0.9") : color;
        
        for (let x = 0; x < width; x++) {
            const progress = x / width;
            const envelope = Math.sin(progress * Math.PI);
            
            const y = (height / 2) + Math.sin(progress * Math.PI * 2.5 + wavePhase + offset) * currentAmp * envelope;
            
            if (x === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }
        }
        canvasCtx.stroke();
    }
    
    wavePhase += speed;
    animId = requestAnimationFrame(drawWave);
}

// Cargar datos al cargar la página e integrar verificador de retornos de pagos
window.addEventListener("load", () => {
    loadUserData();
    startVisualizerAnim("idle");
    
    // DETECTOR DE RETORNO DE PAGO EXITOSO DESDE STRIPE
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("payment") === "success") {
        // Activar membresía Premium en base de datos local
        userProfile.isPremium = true;
        saveUserData();
        
        // Mostrar animación de celebración en pantalla
        setTimeout(() => {
            showCelebrationModal();
        }, 800);
        
        // Limpiar la URL de retorno para evitar re-lanzar el modal al refrescar la pestaña
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
    }
    
    if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.getVoices();
        };
    }
});
