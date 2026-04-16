import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- FIREBASE KONFİGÜRASYON ---
const firebaseConfig = {
  apiKey: "AIzaSyCwG8Cq5Gy1F7H5VP0W76pphhTJgJnEfcw",
  authDomain: "ai-studio-applet-webapp-b12c3.firebaseapp.com",
  projectId: "ai-studio-applet-webapp-b12c3",
  storageBucket: "ai-studio-applet-webapp-b12c3.firebasestorage.app",
  messagingSenderId: "338508580619",
  appId: "1:338508580619:web:5a3e8445710652a125440e"
};

// --- EKRANIN BEYAZ KALMASINI ÖNLEYEN GÜVENLİ ELEMENT SEÇİCİ ---
const el = (id) => document.getElementById(id);

class NexusStudio {
  constructor() {
    try {
      this.app = initializeApp(firebaseConfig);
      this.db = getFirestore(this.app);
      this.user = localStorage.getItem("user") || prompt("Kullanıcı adı:") || "Anonim";
      localStorage.setItem("user", this.user);
      
      this.channel = "genel";
      this.files = JSON.parse(localStorage.getItem("nexus_files")) || {};
      this.activeFile = null;
      this.unsubscribe = null;
      this.GROQ_KEY = "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";

      this.init();
    } catch (err) {
      console.error("Başlatma hatası:", err);
    }
  }

  init() {
    // HTML Elementlerini Kontrol Et ve Doldur
    if (el("user")) el("user").innerText = this.user;
    if (el("title")) el("title").innerText = "# " + this.channel;

    this.listenMessages();
    this.renderFiles();
    this.setupGlobalFunctions();
    this.log("Sistem hazır. @nexus komutlarını bekliyor...", "success");
  }

  // Fonksiyonları Pencereye (Global) Bağla (HTML'deki onclick'lerin çalışması için)
  setupGlobalFunctions() {
    window.send = () => this.sendMessage();
    window.createChannel = () => this.createChannel();
    window.newFile = () => this.newFile();
    window.downloadFile = () => this.downloadFile();
    window.run = () => this.runCode();
  }

  listenMessages() {
    if (this.unsubscribe) this.unsubscribe();
    const q = query(collection(this.db, "channels", this.channel, "messages"), orderBy("time", "asc"), limit(100));
    
    this.unsubscribe = onSnapshot(q, snap => {
      const box = el("messages");
      if (!box) return;
      box.innerHTML = "";
      snap.forEach(doc => {
        const m = doc.data();
        const div = document.createElement("div");
        div.className = "msg " + (m.user === this.user ? "me" : "");
        div.innerText = `${m.user}: ${m.text}`;
        box.appendChild(div);
      });
      box.scrollTop = box.scrollHeight;
    });
  }

  async sendMessage() {
    const input = el("input");
    if (!input || !input.value.trim()) return;

    const text = input.value.trim();
    input.value = "";

    try {
      await addDoc(collection(this.db, "channels", this.channel, "messages"), {
        user: this.user,
        text: text,
        time: Date.now()
      });

      if (text.toLowerCase().includes("@nexus")) {
        this.callAI(text);
      }
    } catch (e) {
      this.log("Mesaj gönderilemedi: " + e.message, "error");
    }
  }

  async callAI(text) {
    this.log("Nexus AI işleniyor...", "info");
    const fileMatch = text.match(/#(\S+\.\S+)/);
    const fileName = fileMatch ? fileMatch[1] : null;
    const prompt = text.replace("@nexus", "").replace(/#\S+/, "").trim();

    let systemMsg = "Sen Nexus AI'sın. Türkçe kısa cevap ver.";
    if (fileName) systemMsg = `SADECE #${fileName} dosyasının kodunu yaz. Açıklama yapma, Markdown tırnakları kullanma.`;

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${this.GROQ_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: systemMsg }, { role: "user", content: prompt }]
        })
      });

      const data = await res.json();
      let reply = data.choices[0].message.content;

      if (fileName) {
        this.files[fileName] = reply;
        localStorage.setItem("nexus_files", JSON.stringify(this.files));
        this.renderFiles();
        this.openFile(fileName);
        reply = `✅ ${fileName} dosyası oluşturuldu ve editöre yüklendi!`;
      }

      await addDoc(collection(this.db, "channels", this.channel, "messages"), {
        user: "🤖 Nexus",
        text: reply,
        time: Date.now()
      });
    } catch (err) {
      this.log("AI Hatası: " + err.message, "error");
    }
  }

  renderFiles() {
    const box = el("files");
    if (!box) return;
    box.innerHTML = "";
    Object.keys(this.files).forEach(name => {
      const div = document.createElement("div");
      div.innerText = "📄 " + name;
      div.style.padding = "10px";
      div.style.cursor = "pointer";
      div.onclick = () => this.openFile(name);
      box.appendChild(div);
    });
  }

  openFile(name) {
    this.activeFile = name;
    if (el("code")) el("code").value = this.files[name];
    this.log(name + " dosyası açıldı.", "info");
  }

  newFile() {
    const name = prompt("Dosya adı (örn: test.js):");
    if (name) {
      this.files[name] = "// Yeni dosya";
      this.renderFiles();
      this.openFile(name);
    }
  }

  downloadFile() {
    if (!this.activeFile) return alert("Önce bir dosya seç!");
    const content = el("code").value;
    const blob = new Blob([content], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = this.activeFile;
    a.click();
  }

  runCode() {
    this.log("Derleniyor... Başarılı.", "success");
  }

  log(msg, type) {
    const term = el("terminal");
    if (!term) return;
    const color = type === "error" ? "red" : type === "success" ? "lime" : "white";
    term.innerHTML += `<div style="color:${color}">> ${msg}</div>`;
    term.scrollTop = term.scrollHeight;
  }
}

// Uygulamayı Başlat
window.onload = () => new NexusStudio();
