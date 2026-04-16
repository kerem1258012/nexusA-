import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================
   FIREBASE
========================= */
const firebaseConfig = {
  apiKey: "AIzaSyCwG8Cq5Gy1F7H5VP0W76pphhTJgJnEfcw",
  authDomain: "ai-studio-applet-webapp-b12c3.firebaseapp.com",
  projectId: "ai-studio-applet-webapp-b12c3",
  storageBucket: "ai-studio-applet-webapp-b12c3.firebasestorage.app",
  messagingSenderId: "338508580619",
  appId: "1:338508580619:web:5a3e8445710652a125440e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* =========================
   USER
========================= */
let user = localStorage.getItem("user");
if(!user){
  user = prompt("Kullanıcı adı:");
  localStorage.setItem("user", user);
}

/* =========================
   STATE
========================= */
let channel = "genel";
let unsubscribe = null;

/* =========================
   SAFE DOM
========================= */
function el(id){
  return document.getElementById(id);
}

/* =========================
   INIT UI
========================= */
window.addEventListener("DOMContentLoaded", ()=>{
  if(el("user")) el("user").innerText = user;
  if(el("title")) el("title").innerText = "# genel";
});

/* =========================
   FIRESTORE REF
========================= */
function ref(){
  return collection(db, "channels", channel, "messages");
}

/* =========================
   REALTIME CHAT
========================= */
function listen(){
  if(unsubscribe) unsubscribe();
  const q = query(ref(), orderBy("time","asc"));
  unsubscribe = onSnapshot(q, snap=>{
    const box = el("messages");
    if(!box) return;
    box.innerHTML = "";
    snap.forEach(doc=>{
      const m = doc.data();
      const div = document.createElement("div");
      div.className = "msg " + (m.user === user ? "me" : "");
      div.innerText = m.user + ": " + m.text;
      box.appendChild(div);
    });
    box.scrollTop = box.scrollHeight;
  });
}
listen();

/* =========================
   SEND MESSAGE
========================= */
window.send = async function(){
  const input = el("input");
  if(!input) return;
  const text = input.value.trim();
  if(!text) return;

  await addDoc(ref(),{
    user,
    text,
    time:Date.now()
  });

  input.value = "";

  // @nexus ile başlıyorsa AI'yı tetikle
  if(text.toLowerCase().includes("@nexus")){
    window.nexusAI(text);
  }
};

/* =========================
   CHANNEL SYSTEM
========================= */
window.createChannel = function(){
  const name = prompt("kanal adı:");
  if(!name) return;
  channel = name;
  if(el("title")) el("title").innerText = "# " + name;
  listen();
};

/* =========================
   AI SYSTEM (GROQ GÜNCEL)
========================= */
window.nexusAI = async function(text){

  // Groq API Anahtarın
  const API_KEY = "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";
  
  // Mesajdaki @nexus kısmını temizle
  const promptText = text.replace(/@nexus/gi, "").trim();

  try{
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", // Groq üzerindeki en güçlü modellerden biri
        messages: [
          {
            role: "system",
            content: "Sen Nexus AI'sın. Türkçe, kısa, samimi ve net cevaplar ver."
          },
          {
            role: "user",
            content: promptText
          }
        ]
      })
    });

    const data = await res.json();
    
    // Groq yanıt formatı OpenAI ile aynıdır
    const reply = data.choices?.[0]?.message?.content || "AI bir hata ile karşılaştı.";

    await addDoc(ref(),{
      user:"🤖 Nexus",
      text: reply,
      time: Date.now()
    });

  } catch(err) {
    console.error("❌ GROQ ERROR:", err);
    await addDoc(ref(),{
      user:"🤖 Nexus",
      text: "Bağlantı hatası (Groq)",
      time: Date.now()
    });
  }
};
