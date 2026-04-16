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

  if(text.startsWith("@nexus")){
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

  if(el("title")){
    el("title").innerText = "# " + name;
  }

  listen();
};

/* =========================
   AI AUTO MODEL SYSTEM
========================= */
window.nexusAI = async function(text){

  const models = [
    "llama-3.1-8b-instant",
    "llama3-70b-8192",
    "mixtral-8x7b-32768",
    "gemma2-9b-it"
  ];

  const prompt = text.replace("@nexus","");

  for(const model of models){

    try{

      console.log("🧠 TRY MODEL:", model);

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions",{
        method:"POST",
        headers:{
          "Authorization":"Bearer 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",
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          model,
          messages:[
            {
              role:"system",
              content:"Sen Nexus AI'sın. Türkçe kısa ve net cevap ver."
            },
            {
              role:"user",
              content:prompt
            }
          ],
          temperature:0.7,
          max_tokens:500
        })
      });

      const data = await res.json();

      console.log("📦 RESPONSE:", model, data);

      if(data?.error) continue;

      const reply = data?.choices?.[0]?.message?.content;

      if(reply){

        await addDoc(ref(),{
          user:"🤖 Nexus",
          text:`(${model}) ${reply}`,
          time:Date.now()
        });

        return;
      }

    }catch(err){
      console.log("❌ MODEL FAIL:", model, err);
      continue;
    }
  }

  await addDoc(ref(),{
    user:"🤖 Nexus",
    text:"AI hiçbir modelde çalışmadı (API / key / limit sorunu)",
    time:Date.now()
  });
};
