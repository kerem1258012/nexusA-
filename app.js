let user="user#"+Math.floor(Math.random()*9999);
document.getElementById("user").innerText=user;

let channel="general";

let db=JSON.parse(localStorage.getItem("db")||"{}");
let files=JSON.parse(localStorage.getItem("files")||"[]");

if(!db.general) db.general=[];

/* SAVE */
function save(){
  localStorage.setItem("db",JSON.stringify(db));
  localStorage.setItem("files",JSON.stringify(files));
}

/* CHANNEL */
function createChannel(){
  let name=prompt("channel");
  if(!name) return;
  db[name]=[];
  renderChannels();
}

/* RENDER CHANNELS */
function renderChannels(){
  let box=document.getElementById("channelList");
  box.innerHTML="";

  Object.keys(db).forEach(c=>{
    let d=document.createElement("div");
    d.innerText="# "+c;
    d.onclick=()=>switchChannel(c);
    box.appendChild(d);
  });
}

function switchChannel(c){
  channel=c;
  document.getElementById("header").innerText="# "+c;
  render();
}

/* SEND */
function send(){
  let input=document.getElementById("input");
  let text=input.value;
  if(!text) return;

  db[channel].push({user,text});
  input.value="";

  /* FILE */
  if(text.startsWith("#")){
    files.push({name:text.slice(1),content:""});
    renderFiles();
  }

  /* AI */
  if(text.startsWith("@nexus")){
    window.nexusAI(text,channel);
  }

  /* MENTION */
  if(text.includes("@")){
    document.getElementById("typing").innerText="mention detected";
    setTimeout(()=>document.getElementById("typing").innerText="",1000);
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
  let box=document.getElementById("files");
  box.innerHTML="";

  files.forEach((f,i)=>{
    let d=document.createElement("div");
    d.innerText=f.name;

    d.onclick=()=>{
      document.getElementById("editor").value=f.content;
      window.current=i;
    };

    box.appendChild(d);
  });
}

function newFile(){
  let name=prompt("file");
  files.push({name,content:""});
  renderFiles();
  save();
}

function saveFile(){
  if(window.current==null) return;
  files[window.current].content=document.getElementById("editor").value;
  save();
}

function runFile(){
  document.getElementById("terminal").innerText="running...\n"+document.getElementById("editor").value;
}

/* INIT LOOP */
renderChannels();
render();
renderFiles();
