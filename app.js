/**
 * NEXUS AI STUDIO - CORE ENGINE v2.5
 * Modern, Modüler ve Genişletilebilir Yapı
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, onSnapshot, 
    query, orderBy, limit, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- KONFİGÜRASYON ---
const CONFIG = {
    firebase: {
        apiKey: "AIzaSyCwG8Cq5Gy1F7H5VP0W76pphhTJgJnEfcw",
        authDomain: "ai-studio-applet-webapp-b12c3.firebaseapp.com",
        projectId: "ai-studio-applet-webapp-b12c3",
        storageBucket: "ai-studio-applet-webapp-b12c3.firebasestorage.app",
        messagingSenderId: "338508580619",
        appId: "1:338508580619:web:5a3e8445710652a125440e"
    },
    ai: {
        endpoint: "https://api.groq.com/openai/v1/chat/completions",
        key: "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",
        model: "llama-3.3-70b-versatile"
    }
};

// --- UYGULAMA DURUMU (STATE) ---
class NexusApp {
    constructor() {
        this.app = initializeApp(CONFIG.firebase);
        this.db = getFirestore(this.app);
        this.user = this.initUser();
        this.currentChannel = "genel";
        this.files = JSON.parse(localStorage.getItem("nexus_fs")) || {};
        this.activeFile = null;
        this.unsubscribe = null;
        this.isAiThinking = false;

        this.init();
    }

    // 1. Kullanıcı Başlatma
    initUser() {
        let saved = localStorage.getItem("nexus_username");
        if (!saved) {
            saved = prompt("Nexus Studio'ya hoş geldin! İsmin nedir?") || "Geliştirici";
            localStorage.setItem("nexus_username", saved);
        }
        return saved;
    }

    // 2. Uygulama Başlatıcı
    init() {
        document.getElementById("user-display").innerText = this.user;
        this.setupEventListeners();
        this.listenMessages();
        this.renderFileList();
        this.logTerminal("Sistem başlatıldı. Terminal hazır...", "success");
        
        // Eğer kayıtlı dosya varsa ilkini aç
        const firstFile = Object.keys(this.files)[0];
        if (firstFile) this.openFile(firstFile);
    }

    // 3. Olay Dinleyicileri
    setupEventListeners() {
        // Klavye Kısayolları (Ctrl + S = Kaydet)
        document.addEventListener("keydown", (e) => {
            if (e.ctrlKey && e.key === "s") {
                e.preventDefault();
                this.saveCurrentFile();
            }
        });

        // Chat input enter takibi zaten HTML'de var, ancak global erişimler için:
        window.send = () => this.handleSendMessage();
        window.newFile = () => this.handleNewFile();
        window.downloadActiveFile = () => this.downloadFile();
        window.runCode = () => this.runSimulation();
        window.createChannel = () => this.switchChannel();
    }

    // 4. Firebase Mesaj Dinleyicisi
    listenMessages() {
        if (this.unsubscribe) this.unsubscribe();
        
        this.logTerminal(`${this.currentChannel} kanalına bağlanılıyor...`, "info");
        const q = query(
            collection(this.db, "channels", this.currentChannel, "messages"),
            orderBy("time", "asc"),
            limit(50)
        );

        this.unsubscribe = onSnapshot(q, (snap) => {
            const container = document.getElementById("messages-container");
            container.innerHTML = "";
            
            snap.forEach(doc => {
                const data = doc.data();
                this.renderMessage(data);
            });
            container.scrollTop = container.scrollHeight;
        });
    }

    // 5. Mesaj Render Etme
    renderMessage(data) {
        const container = document.getElementById("messages-container");
        const isAI = data.user.includes("Nexus");
        const msgDiv = document.createElement("div");
        msgDiv.className = `msg ${isAI ? 'ai-msg' : ''}`;
        
        // Zaman formatı
        const time = data.time ? new Date(data.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "";

        msgDiv.innerHTML = `
            <div class="msg-header">
                <span class="msg-user" style="color:${isAI ? '#5865f2' : '#fff'}">${data.user}</span>
                <span class="msg-time">${time}</span>
            </div>
            <div class="msg-text">${this.formatText(data.text)}</div>
        `;
        container.appendChild(msgDiv);
    }

    // 6. Basit Markdown Formatlayıcı
    formatText(text) {
        return text
            .replace(/`(.*?)`/g, '<code>$1</code>') // Inline kod
            .replace(/\n/g, '<br>'); // Satır sonu
    }

    // 7. Mesaj Gönderme Mantığı
    async handleSendMessage() {
        const input = document.getElementById("chat-input");
        const text = input.value.trim();
        if (!text || this.isAiThinking) return;

        input.value = "";
        try {
            await addDoc(collection(this.db, "channels", this.currentChannel, "messages"), {
                user: this.user,
                text: text,
                time: Date.now()
            });

            if (text.toLowerCase().includes("@nexus")) {
                this.handleAIAction(text);
            }
        } catch (err) {
            this.logTerminal("Mesaj gönderilemedi: " + err.message, "error");
        }
    }

    // 8. AI İşlem Merkezi
    async handleAIAction(text) {
        this.isAiThinking = true;
        this.logTerminal("Nexus AI düşünüyor...", "info");

        // Regex ile dosya adı yakalama (#script.js)
        const fileMatch = text.match(/#(\S+\.\S+)/);
        const fileName = fileMatch ? fileMatch[1] : null;
        const prompt = text.replace("@nexus", "").replace(/#\S+/, "").trim();

        let systemRole = "Sen Nexus Studio AI'sın. Türkçe, net ve teknik cevaplar ver.";
        if (fileName) {
            systemRole = `Sadece #${fileName} dosyası için kod üret. Asla açıklama yapma. Sadece kodun kendisini ver. Markdown tırnakları kullanma.`;
        }

        try {
            const response = await fetch(CONFIG.ai.endpoint, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${CONFIG.ai.key}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: CONFIG.ai.model,
                    messages: [
                        { role: "system", content: systemRole },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.7
                })
            });

            const data = await response.json();
            let aiText = data.choices[0].message.content;

            if (fileName) {
                this.saveFileToSystem(fileName, aiText);
                aiText = `✨ [DOSYA OLUŞTURULDU] #${fileName} editöre eklendi.`;
            }

            await addDoc(collection(this.db, "channels", this.currentChannel, "messages"), {
                user: "🤖 Nexus AI",
                text: aiText,
                time: Date.now()
            });

        } catch (err) {
            this.logTerminal("AI Hatası: " + err.message, "error");
        } finally {
            this.isAiThinking = false;
        }
    }

    // 9. Dosya Sistemi Mantığı
    saveFileToSystem(name, content) {
        this.files[name] = content;
        localStorage.setItem("nexus_fs", JSON.stringify(this.files));
        this.renderFileList();
        this.openFile(name);
        this.logTerminal(`${name} dosyası başarıyla kaydedildi.`, "success");
    }

    renderFileList() {
        const list = document.getElementById("files-list");
        list.innerHTML = "";
        Object.keys(this.files).forEach(name => {
            const div = document.createElement("div");
            div.className = "file-item";
            div.innerHTML = `<span>📄 ${name}</span><button class='del-btn' data-name='${name}'>×</button>`;
            div.onclick = (e) => {
                if (e.target.className !== 'del-btn') this.openFile(name);
            };
            
            // Silme butonu
            div.querySelector('.del-btn').onclick = (e) => {
                e.stopPropagation();
                this.deleteFile(name);
            };

            list.appendChild(div);
        });
    }

    openFile(name) {
        this.activeFile = name;
        document.getElementById("code-textarea").value = this.files[name];
        document.getElementById("active-filename-display").innerText = name;
        document.getElementById("editor-tabs").innerHTML = `<div class="tab active">${name}</div>`;
        this.logTerminal(`${name} açıldı.`, "info");
    }

    saveCurrentFile() {
        if (!this.activeFile) return;
        const content = document.getElementById("code-textarea").value;
        this.files[this.activeFile] = content;
        localStorage.setItem("nexus_fs", JSON.stringify(this.files));
        this.logTerminal("Değişiklikler kaydedildi.", "success");
    }

    deleteFile(name) {
        if (confirm(`${name} silinsin mi?`)) {
            delete this.files[name];
            localStorage.setItem("nexus_fs", JSON.stringify(this.files));
            this.renderFileList();
            this.logTerminal(`${name} silindi.`, "warn");
        }
    }

    handleNewFile() {
        const name = prompt("Dosya adı ve uzantısı:");
        if (name && name.includes(".")) {
            this.saveFileToSystem(name, "// Yeni kod sayfası\n");
        } else {
            alert("Geçersiz dosya adı. (Örn: script.js)");
        }
    }

    // 10. İndirme ve Simülasyon
    downloadFile() {
        if (!this.activeFile) return;
        const blob = new Blob([this.files[this.activeFile]], { type: "text/plain" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = this.activeFile;
        a.click();
        this.logTerminal("Dosya indirme başlatıldı.", "info");
    }

    runSimulation() {
        this.logTerminal(`Derleme başlatılıyor: ${this.activeFile}...`, "info");
        setTimeout(() => {
            this.logTerminal("Bölge taraması tamamlandı. Modül aktif.", "success");
            this.logTerminal("> Çıktı: Hello Nexus World!", "info");
        }, 1000);
    }

    // 11. Terminal Loglama
    logTerminal(msg, type = "info") {
        const term = document.getElementById("terminal-output");
        const colors = {
            info: "#00bfff",
            success: "#3fb950",
            error: "#f85149",
            warn: "#d29922"
        };
        const time = new Date().toLocaleTimeString();
        term.innerHTML += `<div><span style="color:#888">[${time}]</span> <span style="color:${colors[type]}">${msg}</span></div>`;
        term.scrollTop = term.scrollHeight;
    }

    switchChannel() {
        const n = prompt("Geçmek istediğiniz kanal adı:");
        if (n) {
            this.currentChannel = n;
            document.getElementById("current-channel-title").innerText = n;
            this.listenMessages();
        }
    }
}

// Uygulamayı Başlat
const nexus = new NexusApp();
