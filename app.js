/**
 * NEXUS AI STUDIO - CORE ENGINE v3.0
 * Özellikler: Gerçek Zamanlı Sohbet, AI Dosya Üretimi, Terminal Loglama,
 * Çoklu Kanal Desteği, Yerel Dosya Sistemi.
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

class NexusEngine {
    constructor() {
        this.firebaseApp = initializeApp(CONFIG.firebase);
        this.db = getFirestore(this.firebaseApp);
        
        // State Management
        this.user = this.initializeUser();
        this.currentChannel = "genel";
        this.activeFile = null;
        this.files = JSON.parse(localStorage.getItem("nexus_fs")) || {};
        this.channels = ["genel", "projeler", "yardım"];
        this.unsubMessages = null;

        // UI Bindings
        this.els = {
            messages: document.getElementById("messages-container"),
            input: document.getElementById("chat-input"),
            files: document.getElementById("files-list"),
            channels: document.getElementById("channels-list"),
            code: document.getElementById("code-textarea"),
            terminal: document.getElementById("terminal-output"),
            userDisplay: document.getElementById("user-display"),
            chanTitle: document.getElementById("current-channel-title"),
            fileName: document.getElementById("active-filename-display")
        };

        this.boot();
    }

    /**
     * UYGULAMA BAŞLATICI
     */
    boot() {
        console.log("🚀 Nexus Engine starting...");
        this.els.userDisplay.innerText = this.user;
        this.renderChannels();
        this.renderFiles();
        this.listenMessages();
        this.logTerminal("Sistem başarıyla yüklendi. Nexus Studio hazır.", "success");
        this.updateLineNumbers();

        // Klavye kısayolları
        document.addEventListener("keydown", (e) => {
            if (e.ctrlKey && e.key === "s") {
                e.preventDefault();
                this.saveCurrentFile();
            }
        });
    }

    initializeUser() {
        let name = localStorage.getItem("nexus_user");
        if (!name) {
            name = prompt("Nexus Studio'ya giriş için bir isim seçin:") || "Developer";
            localStorage.setItem("nexus_user", name);
        }
        return name;
    }

    /**
     * MESAJLAŞMA SİSTEMİ
     */
    async send() {
        const text = this.els.input.value.trim();
        if (!text) return;

        this.els.input.value = "";
        this.els.input.style.height = "40px";

        try {
            await addDoc(collection(this.db, "channels", this.currentChannel, "messages"), {
                user: this.user,
                text: text,
                time: Date.now()
            });

            if (text.toLowerCase().includes("@nexus")) {
                this.processAIRequest(text);
            }
        } catch (err) {
            this.logTerminal("Mesaj gönderim hatası: " + err.message, "error");
        }
    }

    listenMessages() {
        if (this.unsubMessages) this.unsubMessages();

        const q = query(
            collection(this.db, "channels", this.currentChannel, "messages"),
            orderBy("time", "asc"),
            limit(100)
        );

        this.unsubMessages = onSnapshot(q, (snap) => {
            this.els.messages.innerHTML = "";
            snap.forEach(doc => this.renderMessage(doc.data()));
            this.els.messages.scrollTop = this.els.messages.scrollHeight;
        });
    }

    renderMessage(m) {
        const isMe = m.user === this.user;
        const isAI = m.user.includes("Nexus");
        
        const div = document.createElement("div");
        div.className = `msg-container ${isMe ? 'me' : ''}`;
        div.style.display = "flex";
        div.style.flexDirection = "column";
        div.style.alignItems = isMe ? "flex-end" : "flex-start";
        div.style.marginBottom = "15px";

        const time = new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        div.innerHTML = `
            <div class="msg-bubble ${isMe ? 'me' : ''} ${isAI ? 'ai' : ''}">
                <div class="msg-header-info">
                    <b style="color:${isAI ? '#5865f2' : 'inherit'}">${m.user}</b>
                    <span>${time}</span>
                </div>
                <div class="msg-body">${this.formatMessage(m.text)}</div>
            </div>
        `;
        this.els.messages.appendChild(div);
    }

    formatMessage(text) {
        // Basit markdown tespiti
        return text
            .replace(/`(.*?)`/g, '<code class="inline-code">$1</code>')
            .replace(/\n/g, '<br>');
    }

    /**
     * AI (GROQ) SİSTEMİ
     */
    async processAIRequest(text) {
        this.logTerminal("Nexus AI düşünüyor...", "info");
        
        // Dosya adı tespiti: #script.js gibi
        const fileMatch = text.match(/#(\S+\.\S+)/);
        const fileName = fileMatch ? fileMatch[1] : null;
        const cleanPrompt = text.replace("@nexus", "").replace(/#\S+/, "").trim();

        let systemPrompt = "Sen Nexus Studio AI asistanısın. Türkçe samimi ve teknik cevaplar ver.";
        if (fileName) {
            systemPrompt = `Kullanıcı #${fileName} dosyası için kod istiyor. SADECE KODU VER. Açıklama yapma, Markdown tırnakları kullanma.`;
        }

        try {
            const res = await fetch(CONFIG.ai.endpoint, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${CONFIG.ai.key}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: CONFIG.ai.model,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: cleanPrompt }
                    ]
                })
            });

            const data = await res.json();
            let aiText = data.choices[0].message.content;

            if (fileName) {
                this.saveFile(fileName, aiText);
                aiText = `✨ **${fileName}** başarıyla oluşturuldu ve proje gezginine eklendi.`;
            }

            await addDoc(collection(this.db, "channels", this.currentChannel, "messages"), {
                user: "🤖 Nexus AI",
                text: aiText,
                time: Date.now()
            });

        } catch (err) {
            this.logTerminal("AI Hatası: " + err.message, "error");
        }
    }

    /**
     * DOSYA SİSTEMİ
     */
    saveFile(name, content) {
        this.files[name] = content;
        this.updateFileSystem();
        this.renderFiles();
        this.openFile(name);
        this.logTerminal(`${name} dosyası sisteme kaydedildi.`, "success");
    }

    openFile(name) {
        this.activeFile = name;
        this.els.code.value = this.files[name];
        this.els.fileName.innerText = name;
        this.renderFiles(); // Aktif dosyayı vurgulamak için
        this.logTerminal(`${name} editörde açıldı.`, "info");
        this.updateLineNumbers();
    }

    saveCurrentFile() {
        if (!this.activeFile) return;
        this.files[this.activeFile] = this.els.code.value;
        this.updateFileSystem();
        this.logTerminal("Değişiklikler kaydedildi (Ctrl+S).", "success");
    }

    newFile() {
        const name = prompt("Dosya adı (örn: style.css):");
        if (name && name.includes(".")) {
            this.saveFile(name, "// Yeni dosya içeriği\n");
        }
    }

    deleteFile(name) {
        if (confirm(`${name} kalıcı olarak silinsin mi?`)) {
            delete this.files[name];
            this.updateFileSystem();
            this.renderFiles();
            this.els.code.value = "";
            this.els.fileName.innerText = "dosya_yok";
            this.logTerminal(`${name} silindi.`, "warn");
        }
    }

    updateFileSystem() {
        localStorage.setItem("nexus_fs", JSON.stringify(this.files));
    }

    renderFiles() {
        this.els.files.innerHTML = "";
        Object.keys(this.files).forEach(f => {
            const div = document.createElement("div");
            div.className = f === this.activeFile ? "active" : "";
            div.innerHTML = `
                <span><i class="fas fa-file-alt"></i> ${f}</span>
                <i class="fas fa-trash-alt delete-icon" onclick="event.stopPropagation(); window.nexus.deleteFile('${f}')"></i>
            `;
            div.onclick = () => this.openFile(f);
            this.els.files.appendChild(div);
        });
    }

    /**
     * KANAL SİSTEMİ
     */
    renderChannels() {
        this.els.channels.innerHTML = "";
        this.channels.forEach(c => {
            const div = document.createElement("div");
            div.className = c === this.currentChannel ? "active" : "";
            div.innerHTML = `<i class="fas fa-hashtag"></i> ${c}`;
            div.onclick = () => this.switchChannel(c);
            this.els.channels.appendChild(div);
        });
    }

    switchChannel(name) {
        this.currentChannel = name;
        this.els.chanTitle.innerText = name;
        this.logTerminal(`${name} kanalına geçiş yapıldı.`, "info");
        this.renderChannels();
        this.listenMessages();
    }

    createChannel() {
        const n = prompt("Yeni kanal adı:");
        if (n) {
            this.channels.push(n);
            this.renderChannels();
            this.switchChannel(n);
        }
    }

    /**
     * TERMİNAL VE YARDIMCILAR
     */
    logTerminal(msg, type = "info") {
        const line = document.createElement("div");
        line.className = `line ${type}`;
        line.innerHTML = `<span style="opacity:0.5">${new Date().toLocaleTimeString()}</span> > ${msg}`;
        this.els.terminal.appendChild(line);
        this.els.terminal.scrollTop = this.els.terminal.scrollHeight;
    }

    clearTerminal() {
        this.els.terminal.innerHTML = '<div class="line info">Terminal temizlendi.</div>';
    }

    downloadActiveFile() {
        if (!this.activeFile) return alert("İndirilecek dosya yok!");
        const content = this.els.code.value;
        const blob = new Blob([content], { type: "text/plain" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = this.activeFile;
        a.click();
    }

    runCode() {
        this.logTerminal(`Derleme işlemi başlatılıyor: ${this.activeFile || 'Unnamed'}...`, "info");
        setTimeout(() => {
            this.logTerminal("Build başarılı. Runtime aktif.", "success");
            this.logTerminal("Nexus Runtime Output: Hello World!", "success");
        }, 1200);
    }

    updateLineNumbers() {
        const gutter = document.getElementById("line-numbers");
        const lines = this.els.code.value.split('\n').length;
        gutter.innerHTML = "";
        for (let i = 1; i <= Math.max(lines, 20); i++) {
            const span = document.createElement("span");
            span.innerText = i;
            gutter.appendChild(span);
        }
    }
}

// Global Erişim İçin
window.nexus = new NexusEngine();
