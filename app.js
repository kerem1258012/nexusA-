let user = localStorage.getItem("user");

if(!user){
  user = prompt("kullanıcı adı:");
  localStorage.setItem("user",user);
}

document.getElementById("user").innerText=user;

/* STATE */
let channel="genel";
let db=JSON.parse(localStorage.getItem("db")||"{}");
let files=JSON.parse(localStorage.getItem("files")||"[]");

if(!db.genel) db.genel=[];

/* SAVE */
function save(){
  localStorage.setItem("db",JSON.stringify(db));
  localStorage.setItem("files",JSON.stringify(files));
}

/* CHANNEL */
function createChannel(){
  let n=prompt("kanal adı");
  if(!n) return;
  db[n]=[];
  renderChannels();
}

/* RENDER CHANNELS */
function renderChannels(){
  let box=document.getElementById("channels");
  box.innerHTML="";

  Object.keys(db).forEach(c=>{
    let d=document.createElement("div");
    d.innerText="# "+c;
    d.onclick=()=>switchC(c);
    box.appendChild(d);
  });
}

function switchC(c){
  channel=c;
  document.getElementById("title").innerText="# "+c;
  render();
}

/* SEND */
function send(){
  let input=document.getElementById("input");
  let text=input.value;
  if(!text) return;

  if(!db[channel]) db[channel]=[];

  db[channel].push({user,text});
  input.value="";

  /* FILE */
  if(text.startsWith("#")){
    files.push({name:text.slice(1),content:""});
    renderFiles();
  }

  /* AI HOOK */
  if(text.startsWith("@nexus")){
    ai(text);
  }

  save();
  render();
}

/* RENDER CHAT */
function render(){
  let box=document.getElementById("messages");
  box.innerHTML="";

  (db[channel]||[]).forEach(m=>{
    let d=document.createElement("div");
    d.className="msg "+(m.user===user?"me":"");
    d.innerText=m.user+": "+m.text;
    box.appendChild(d);
  });

  box.scrollTop=box.scrollHeight;
}

/* FILE SYSTEM */
function renderFiles(){
  let box=document.querySelector(".files");
  box.innerHTML="";

  files.forEach((f,i)=>{
    let d=document.createElement("div");
    d.innerText=f.name;

    d.onclick=()=>{
      document.getElementById("code").value=f.content;
      window.cur=i;
    };

    box.appendChild(d);
  });
}

function newFile(){
  let n=prompt("file");
  files.push({name:n,content:""});
  renderFiles();
  save();
}

function saveFile(){
  if(window.cur==null) return;
  files[window.cur].content=document.getElementById("code").value;
  save();
}

function run(){
  document.getElementById("terminal").innerText=
  document.getElementById("code").value;
}

/* AI (SIMPLIFIED HOOK) */
function ai(text){
  setTimeout(()=>{
    db[channel].push({
      user:"Nexus",
      text:"AI: "+text.replace("@nexus","")
    });

    render();
    save();
  },600);
}

/* INIT */
renderChannels();
render();
renderFiles();
