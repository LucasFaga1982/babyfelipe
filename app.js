const QUESTIONS=[40,44,2013,18299,1934,2001,7,151,7,39,700,3350];

let players=[];
let currentRound=0;
let answers=[];

const app=document.getElementById('app');

function shootConfetti(){
 confetti({particleCount:200,spread:100});
}
function playWinSound(){
 document.getElementById('winSound').play();
}

function renderRegister(){
 app.innerHTML=`
 <h1>Baby Shower 🎉</h1>
 <input id="name" placeholder="Tu nombre"/>
 <button onclick="join()">Entrar</button>`;
}

window.join=()=>{
 const name=document.getElementById('name').value;
 players.push({name,points:0});
 renderGame();
}

function renderGame(){
 app.innerHTML=`
 <h2>Pregunta ${currentRound+1}</h2>
 <input class="mega-input" id="answer" type="number"/>
 <button onclick="send()">Enviar</button>`;
}

window.send=()=>{
 const val=Number(document.getElementById('answer').value);
 answers.push({player:players[players.length-1],val});
 if(answers.length===players.length){
   resolve();
 }
}

function resolve(){
 const correct=QUESTIONS[currentRound];
 answers.forEach(a=>a.diff=Math.abs(a.val-correct));
 answers.sort((a,b)=>a.diff-b.diff);
 answers[0].player.points++;

 shootConfetti();
 playWinSound();

 currentRound++;
 answers=[];

 if(currentRound>=QUESTIONS.length){
   showPodium();
 }else{
   renderGame();
 }
}

function showPodium(){
 players.sort((a,b)=>b.points-a.points);

 app.innerHTML=`
 <div class="podium-screen">
  <h1>🏆 FINAL 🏆</h1>
  <div class="podium">
   <div class="second">
    <div class="podium-card">${players[1]?.name||''}<br>${players[1]?.points||0}</div>
    <div class="base"></div>
   </div>
   <div class="first">
    <div class="podium-card">${players[0]?.name||''}<br>${players[0]?.points||0}</div>
    <div class="base"></div>
   </div>
   <div class="third">
    <div class="podium-card">${players[2]?.name||''}<br>${players[2]?.points||0}</div>
    <div class="base"></div>
   </div>
  </div>
 </div>`;

 setInterval(shootConfetti,1200);
}

renderRegister();
