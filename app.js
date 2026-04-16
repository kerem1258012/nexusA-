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
   FIREBASE SETUP (SENİN PROJE)
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
   USER SYSTEM
========================= */
let user = localStorage.getItem("user");

if(!user){
  user = prompt("Kullanıcı adı gir:");
  localStorage.setItem("user", user);
}

document.getElementById("user").innerText = user;

/* =========================
   STATE
========================= */
let channel = "genel";

/* =========================
   FIRESTORE REF
========================= */
function ref(){
  return collection(db, "channels", channel, "messages");
}

/* =========================
   REALTIME CHAT LISTENER
========================= */
function listen(){
  const q = query(ref(), orderBy("time","asc"));

  onSnapshot(q, (snap)=>{
    const box = document.getElementById("messages");
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
   SEND MESSAGE (FIXED)
========================= */
window.send = async function(){

  const input = document.getElementById("input");
  const text = input.value;

  if(!text) return;

  await addDoc(ref(),{
    user,
    text,
    time:Date.now()
  });

  input.value = "";

  /* AI TRIGGER */
  if(text.startsWith("@nexus")){
    window.nexusAI(text);
  }
};

/* =========================
   CHANNEL SYSTEM (SIMPLE FIX)
========================= */
window.createChannel = function(){
  const name = prompt("kanal adı:");
  if(!name) return;

  channel = name;
  document.getElementById("title").innerText = "# " + name;

  listen();
};

/* =========================
   AI (GROQ FIX - WORKING)
========================= */
window.nexusAI = async function(text){

  try{

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions",{
      method:"POST",
      headers:{
        "Authorization":"Bearer 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",
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        model:"llama3-70b-8192",
        messages:[
          {
            role:"system",
            content:"Sen Nexus AI'sın. Türkçe konuş, kısa cevap ver."
          },
          {
            role:"user",
            content:text
          }
        ]
      })
    });

    const data = await res.json();

    const reply = data?.choices?.[0]?.message?.content || "AI cevap veremedi";

    // 🔥 KRİTİK: CHAT’E YAZ
    await addDoc(ref(),{
      user:"🤖 Nexus",
      text:reply,
      time:Date.now()
    });

  }catch(err){

    console.log("AI error:",err);

    await addDoc(ref(),{
      user:"🤖 Nexus",
      text:"AI bağlantı hatası",
      time:Date.now()
    });

  }
};
