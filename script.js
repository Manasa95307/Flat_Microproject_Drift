
const LEVEL_SPECS = [
  {id:1,name:'NFA BASICS',title:'Reach the exit',concept:'States & transitions',description:'Follow transitions from the start state until an accepting state is reached.',states:4,epsilon:false,branching:false,dead:false,complexity:2},
  {id:2,name:'MULTIPLE PATHS',title:'Keep every possibility alive',concept:'Non-Determinism',description:'One input symbol can lead to multiple states. The machine keeps every possible destination alive.',states:5,epsilon:false,branching:true,dead:false,complexity:3},
  {id:3,name:'ε-TRANSITIONS',title:'Move without reading',concept:'Epsilon Closure',description:'ε lets the NFA move without consuming an input symbol. The engine calculates epsilon-closure before and after each symbol.',states:5,epsilon:true,branching:false,dead:false,complexity:3},
  {id:4,name:'BRANCHING PATHS',title:'Track the branches',concept:'Nondeterministic branching',description:'Several branches can be active together. Follow every possible path instead of choosing only one.',states:6,epsilon:false,branching:true,dead:false,complexity:4},
  {id:5,name:'DEAD STATES',title:'Keep the live path alive',concept:'Dead paths',description:'Some branches terminate with no useful transition. Dead branches disappear while valid branches continue.',states:7,epsilon:false,branching:true,dead:true,complexity:4}
];

let current=0, input='', cursor=0, active=new Set(), stepHistory=[], score=0, lives=3, running=false;
let completed=JSON.parse(localStorage.getItem('nebulaCompleted')||'[]');
let automaton=null, autoTimer=null;

const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);
const level=()=>automaton || LEVEL_SPECS[current];

function randInt(n){return Math.floor(Math.random()*n);}
const INPUT_ALPHABET=['0','1','a','b'];
function randomSymbol(){return INPUT_ALPHABET[randInt(INPUT_ALPHABET.length)];}
function randomInput(n, levelId){
  let chars=Array.from({length:n},randomSymbol);
  // Every level now teaches the expanded alphabet. Even-length/higher levels
  // deliberately include the substring "ab" so it appears in real gameplay.
  if(levelId>=2 && n>=2){
    const i=randInt(n-1); chars[i]='a'; chars[i+1]='b';
  }else{
    const i=randInt(n); chars[i]=Math.random()<.5?'a':'b';
  }
  return chars.join('');
}
function isValidInputString(str){return /^[01ab]+$/.test(str);}
function addTransition(trans, edges, from, symbol, to){
  trans[from] ||= {};
  trans[from][symbol] ||= [];
  if(!trans[from][symbol].includes(to)){
    trans[from][symbol].push(to);
    edges.push([from,to,symbol]);
    return true;
  }
  return false;
}
function hasEdge(trans,from,symbol,to){return !!trans[from]?.[symbol]?.includes(to);}

function generateNFA(levelId){
  const spec=LEVEL_SPECS[levelId-1];
  const states=Array.from({length:spec.states},(_,i)=>`q${i}`);
  const trans={}, edges=[];
  const start='q0', acceptState=`q${spec.states-1}`;

  // A guaranteed accepting backbone is created first.
  const backboneLength = spec.epsilon ? spec.states : (spec.id===1 ? spec.states : Math.max(4, spec.states-2));
  const backbone=states.slice(0,backboneLength);
  const acceptedInput=randomInput(backboneLength-1, spec.id);
  for(let i=0;i<backbone.length-1;i++){
    addTransition(trans,edges,backbone[i],acceptedInput[i],backbone[i+1]);
  }

  // Attach remaining states to the useful graph so the diagram never becomes disconnected.
  const extras=states.slice(backboneLength);
  extras.forEach((s,idx)=>{
    const anchor=backbone[Math.min(idx+1,backbone.length-1)];
    const symbol=idx%2===0?'a':'b';
    addTransition(trans,edges,anchor,symbol,s);
  });

  // Real nondeterminism: same source + same symbol -> multiple destinations.
  if(spec.branching){
    for(let i=0;i<Math.min(spec.complexity-1,backbone.length-1);i++){
      const source=backbone[i];
      const symbol=acceptedInput[i];
      const candidates=states.filter(s=>s!==backbone[i+1] && s!==source);
      const target=candidates[randInt(candidates.length)];
      addTransition(trans,edges,source,symbol,target);
    }
  }

  // Dead branches: for non-epsilon levels use spare nodes; for the final epsilon level
  // use a backbone node as a dead branch for the wrong symbol while preserving the
  // guaranteed accepting backbone for the correct input.
  if(spec.dead){
    if(extras.length){
      extras.forEach((dead,idx)=>{
        if(idx>1)return;
        const source=backbone[Math.min(idx+1,backbone.length-2)];
        const symbol=acceptedInput[Math.min(idx,acceptedInput.length-1)]==='0'?'1':'0';
        addTransition(trans,edges,source,symbol,dead);
        if(trans[dead]) delete trans[dead];
      });
    } else {
      const dead=backbone[backbone.length-2];
      const source=backbone[Math.max(0,backbone.length-4)];
      const correct=acceptedInput[Math.max(0,backbone.length-4)];
      const wrong=correct==='0'?'1':correct==='1'?'0':'0';
      addTransition(trans,edges,source,wrong,dead);
    }
  }

  // Epsilon transitions for the designated levels.
  if(spec.epsilon){
    const epsPairs = spec.id===3
      ? [['q0','q1']]
      : [['q1',backbone[3]],['q1',backbone[2]],['q2',backbone[4]]];
    epsPairs.forEach(([from,to])=>{
      if(from!==to && states.includes(to)) addTransition(trans,edges,from,'ε',to);
    });
    // Give an epsilon branch a useful continuation on the next symbol where possible.
    if(spec.id>=6){
      const branchTarget=backbone[3];
      const anchor=backbone[1];
      const sym=acceptedInput[1]||'0';
      if(branchTarget!==anchor && !hasEdge(trans,branchTarget,sym,backbone[2])) addTransition(trans,edges,branchTarget,sym,backbone[2]);
    }
  }

  // Guarantee the accepting backbone survives all added transitions.
  const positions=buildPositions(spec.states);
  const nfa={
    id:levelId,
    name:spec.name,title:spec.title,concept:spec.concept,description:spec.description,
    states,start,accept:[acceptState],trans,edges,pos:positions,
    acceptedInput,
    serial:Math.floor(100+Math.random()*900)
  };
  return validateNFA(nfa) ? nfa : generateNFA(levelId);
}

function validateNFA(nfa){
  if(!nfa.states.includes(nfa.start) || !nfa.accept.length)return false;
  const stateSet=new Set(nfa.states);
  for(const e of nfa.edges){
    if(!stateSet.has(e[0])||!stateSet.has(e[1]))return false;
    if(![...INPUT_ALPHABET,'ε'].includes(e[2]))return false;
  }
  const edgeKeys=new Set(nfa.edges.map(e=>e.join('|')));
  if(edgeKeys.size!==nfa.edges.length)return false;
  // Useful connectivity from start.
  const seen=new Set([nfa.start]),queue=[nfa.start];
  while(queue.length){
    const s=queue.shift();
    for(const symbol of Object.keys(nfa.trans[s]||{})){
      for(const t of nfa.trans[s][symbol]||[]){
        if(!seen.has(t)){seen.add(t);queue.push(t);}
      }
    }
  }
  if(!nfa.accept.some(s=>seen.has(s)))return false;
  if(nfa.edges.length > nfa.states.length*3+3)return false;
  return acceptsInput(nfa,nfa.acceptedInput);
}

function acceptsInput(nfa,str){
  let states=epsilonClosureFor(nfa,new Set([nfa.start]));
  for(const ch of str){
    const next=new Set();
    for(const s of states)for(const t of nfa.trans[s]?.[ch]||[])next.add(t);
    states=epsilonClosureFor(nfa,next);
    if(!states.size)return false;
  }
  return [...states].some(s=>nfa.accept.includes(s));
}
function epsilonClosureFor(nfa,states){
  const out=new Set(states),stack=[...states];
  while(stack.length){
    const s=stack.pop();
    for(const n of nfa.trans[s]?.['ε']||[]){
      if(!out.has(n)){out.add(n);stack.push(n);}
    }
  }
  return out;
}

function buildPositions(count){
  const templates={
    4:{q0:[150,215],q1:[430,105],q2:[430,325],q3:[850,215]},
    5:{q0:[125,215],q1:[350,105],q2:[350,325],q3:[625,105],q4:[900,275]},
    6:{q0:[105,215],q1:[320,95],q2:[320,335],q3:[555,95],q4:[555,335],q5:[900,215]},
    7:{q0:[90,215],q1:[285,85],q2:[285,345],q3:[500,85],q4:[500,345],q5:[720,120],q6:[900,285]},
    8:{q0:[80,215],q1:[255,75],q2:[255,355],q3:[470,75],q4:[470,355],q5:[690,75],q6:[690,355],q7:[930,215]}
  };
  return templates[count]||templates[6];
}

function renderLevels(){
  $('#levelCards').innerHTML=LEVEL_SPECS.map((l,i)=>{
    const done=completed.includes(i);
    const locked=i>0&&!completed.includes(i-1);
    return `<div class="level-card ${done?'completed':''} ${locked?'locked':''}" data-level="${i}">
      <span class="level-num">LEVEL 0${i+1}</span><h3>${l.name}</h3><p>${l.concept}</p>
      <div class="level-icon">${locked?'🔒':done?'✓':'◌'}</div>
    </div>`;
  }).join('');
  $('#homeProgress').textContent=`${completed.length} / ${LEVEL_SPECS.length}`;
  $$('.level-card').forEach(c=>c.onclick=()=>{
    const i=+c.dataset.level;
    if(i>0&&!completed.includes(i-1)){toast('Complete the previous level first.');return}
    openGame(i);
  });
}

function showScreen(id){
  $$('.screen').forEach(x=>x.classList.remove('active'));
  $('#'+id).classList.add('active');
  $$('.bottom-nav button').forEach(x=>x.classList.toggle('active',x.dataset.nav===id));
}

function openGame(i=0){
  current=i;
  showScreen('game');
  resetGame(true,true);
}

function renderGraph(){
  const l=level(),g=$('#graph');
  const W=1100,H=430,R=36;
  const pos=s=>l.pos[s]||[550,215];
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const pairKey=(a,b)=>[a,b].sort().join('|');
  const pairGroups=new Map();
  l.edges.forEach((e,idx)=>{
    if(e[0]!==e[1]){
      const key=pairKey(e[0],e[1]);
      if(!pairGroups.has(key)) pairGroups.set(key,[]);
      pairGroups.get(key).push(idx);
    }
  });

  let svg=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="NFA state transition diagram">
    <defs>
      <marker id="nebulaArrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L8 4 L0 8z" fill="#a99ab9"/></marker>
      <marker id="nebulaArrowActive" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L8 4 L0 8z" fill="#d9c7ff"/></marker>
    </defs>`;

  const [sx,sy]=pos(l.start);
  svg+=`<path class="start-arrow" d="M 40 ${sy} L ${sx-R-18} ${sy}" marker-end="url(#nebulaArrow)"/><text class="start-label" x="40" y="${sy-22}">START</text>`;

  l.edges.forEach((e,idx)=>{
    const [from,to,label]=e,a=pos(from),b=pos(to);
    let d='',lx=0,ly=0;

    if(from===to){
      d=`M ${a[0]-24} ${a[1]-R+2} C ${a[0]-70} ${a[1]-130}, ${a[0]+70} ${a[1]-130}, ${a[0]+24} ${a[1]-R+2}`;
      lx=a[0];ly=a[1]-112;
    }else{
      const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;
      const ux=dx/len,uy=dy/len;
      const ax=a[0]+ux*R,ay=a[1]+uy*R,bx=b[0]-ux*R,by=b[1]-uy*R;
      const nx=-uy,ny=ux;
      const group=pairGroups.get(pairKey(from,to))||[idx];
      const hasReverse=group.some(i=>l.edges[i][0]===to && l.edges[i][1]===from);
      const sameDir=group.filter(i=>l.edges[i][0]===from && l.edges[i][1]===to);
      let curve;

      if(hasReverse){
        // Opposite-direction transitions always bend away from one another.
        // This makes arrows such as q0→q1 and q1→q0 immediately distinguishable.
        const forwardIsCanonical=from < to;
        curve=forwardIsCanonical ? 34 : -34;
        if(sameDir.length>1){
          const parallelIndex=sameDir.indexOf(idx);
          curve += (parallelIndex-(sameDir.length-1)/2)*18;
        }
      }else if(sameDir.length>1){
        // Parallel transitions in the same direction get small separated arcs.
        const parallelIndex=sameDir.indexOf(idx);
        curve=(parallelIndex-(sameDir.length-1)/2)*22;
        if(curve===0) curve=18;
      }else{
        // Single transitions retain the existing gentle curved appearance.
        curve=22;
      }

      const cx=(ax+bx)/2+nx*curve,cy=(ay+by)/2+ny*curve;
      d=`M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`;
      lx=clamp((ax+bx)/2+nx*(curve*.78),35,W-35);
      ly=clamp((ay+by)/2+ny*(curve*.78)-8,20,H-10);
    }

    const eps=label==='ε'?' epsilon':'';
    svg+=`<path id="edge-${idx}" class="edge${eps}" d="${d}" marker-end="url(#nebulaArrow)"/><text class="edge-label" x="${lx}" y="${ly}">${label}</text>`;
  });

  l.states.forEach(s=>{
    const [x,y]=pos(s),isStart=s===l.start,isAccept=l.accept.includes(s);
    svg+=`<g class="state ${isStart?'start ':''}${isAccept?'accept ':''}" id="state-${s}" transform="translate(${x} ${y})">
      ${isAccept?'<circle class="accept-ring" cx="0" cy="0" r="43"/>':''}
      <circle class="state-circle" cx="0" cy="0" r="34"/><text class="state-name" x="0" y="1">${s}</text>
    </g>`;
  });
  svg+='</svg>';
  g.innerHTML=svg;
}

function getNextStates(states,symbol){
  const out=new Set();
  states.forEach(s=>(level().trans[s]?.[symbol]||[]).forEach(x=>out.add(x)));
  return out;
}
function epsilonClosure(states){return epsilonClosureFor(level(),states)}
function processOne(){
  if(!running)return false;
  if(cursor>=input.length){finish();return false}

  const symbol=input[cursor];
  const before=epsilonClosure(new Set(active));
  const next=epsilonClosure(getNextStates(before,symbol));
  const beforeArray=[...before];
  const nextArray=[...next];

  // One click = exactly one input symbol. The active-state set is replaced
  // with the states reachable after consuming that symbol.
  active=new Set(nextArray);
  cursor++;

  stepHistory.push({symbol,before:beforeArray,states:nextArray});
  highlight(symbol,beforeArray,nextArray);
  updateStats(symbol);

  // The final symbol completes the simulation immediately. This keeps NEXT
  // STEP truly one-symbol-at-a-time while allowing AUTO PLAY to stop cleanly.
  if(cursor>=input.length){
    finish();
    return false;
  }
  return true;
}
function highlight(symbol,before=[],next=[]){
  $$('.state').forEach(el=>{
    const state=el.id.replace('state-','');
    el.classList.toggle('active',active.has(state));
  });
  const l=level();
  l.edges.forEach((e,i)=>{
    const used=before.includes(e[0]) && e[2]===symbol && next.includes(e[1]);
    $('#edge-'+i)?.classList.toggle('active',used);
  });
}

function clearPathHighlight(){
  $$('.state').forEach(el=>el.classList.remove('path'));
  $$('.edge').forEach(el=>el.classList.remove('active'));
}

function showCompletePath(){
  const l=level();
  clearPathHighlight();

  // Highlight every state that appeared during the successful simulation.
  const visited=new Set([l.start]);
  stepHistory.forEach(h=>h.states.forEach(s=>visited.add(s)));
  visited.forEach(s=>$('#state-'+s)?.classList.add('path'));

  // Highlight every transition actually traversed by the simulation.
  l.edges.forEach((e,i)=>{
    const used=stepHistory.some(h=>
      h.before.includes(e[0]) && h.symbol===e[2] && h.states.includes(e[1])
    );
    $('#edge-'+i)?.classList.toggle('active',used);
  });

  renderPathTrace(true);
}
function renderInputProgress(){
  const holder=$('#stringDisplay');
  if(!input){holder.textContent='ENTER 0 / 1 / A / B';return}
  const activeIndex=running ? Math.max(0,cursor-1) : -1;
  holder.innerHTML=[...input].map((ch,i)=>`<span class="${i<cursor?'read':''} ${i===activeIndex?'current':''}">${ch}</span>`).join('');
}
function renderPathTrace(fullPath=false){
  const trace=$('#pathTrace');
  if(!trace)return;
  if(!stepHistory.length){trace.innerHTML='<span class="trace-muted">Waiting for simulation…</span>';return}

  const rows=[`<span><b>START</b> {${level().start}}</span>`];
  stepHistory.forEach((h,i)=>{
    rows.push(`<span><b>${String(i+1).padStart(2,'0')}</b> ${h.symbol} → {${h.states.join(', ')||'∅'}}</span>`);
  });
  if(fullPath){
    rows.push(`<span><b>FINAL</b> {${[...active].join(', ')||'∅'}}</span>`);
    trace.innerHTML=rows.join('');
  }else{
    trace.innerHTML=rows.slice(-5).join('');
  }
}
function updateStats(symbol='—'){
  $('#currentSymbol').textContent=symbol;
  $('#activeStates').textContent=`{${[...active].join(', ')||'∅'}}`;
  $('#stepCount').textContent=cursor;
  $('#nodesExplored').textContent=stepHistory.reduce((n,x)=>n+x.states.length,0);
  $('#pathsCount').textContent=Math.max(0,active.size);
  $('#inputPreview').textContent=input||'—';
  $('#statusText').textContent=running?'PROCESSING':'READY';
  $('#activeStates').setAttribute('aria-label', `Current active states: ${[...active].join(', ')||'none'}`);
  $('#possibleStates').textContent=active.size>1?`${active.size} POSSIBLE STATES`:active.size===1?'1 ACTIVE STATE':'NO ACTIVE STATES';
  renderInputProgress();
  renderPathTrace();
}
function finish(){
  if(!running)return;
  running=false;
  clearTimeout(autoTimer);
  $('#nextBtn').disabled=true;$('#autoBtn').disabled=true;
  const accepted=[...active].some(s=>level().accept.includes(s));
  if(accepted){
    score+=100;$('#score').textContent=score;$('#statusText').textContent='ACCEPTED';showResult(true);
  }else{
    lives=Math.max(0,lives-1);renderLives();$('#statusText').textContent='REJECTED';showResult(false);
  }
}

function showAllLevelsComplete(){
  clearTimeout(autoTimer);
  running=false;
  $('#nextBtn').disabled=true;
  $('#autoBtn').disabled=true;

  // The home screen is shown behind the celebration so the player can
  // immediately see that the complete journey is finished.
  showScreen('home');
  renderLevels();

  $('#modalContent').innerHTML=`
    <div class="celebration-icon">✦</div>
    <h2>CONGRATULATIONS!</h2>
    <p>You finished all 5 levels of NEBULA NFA!</p>
    <div class="completion-badge">ALL LEVELS COMPLETE ✓</div>
    <div class="modal-actions">
      <button class="primary" id="continueHome">BACK TO HOME</button>
    </div>`;
  $('#modal').classList.add('show');

  launchConfetti();

  $('#continueHome')?.addEventListener('click',()=>{
    $('#modal').classList.remove('show');
    clearConfetti();
    showScreen('home');
  });
}

function launchConfetti(){
  clearConfetti();
  const layer=document.createElement('div');
  layer.className='confetti-layer';
  layer.setAttribute('aria-hidden','true');

  const symbols=['✦','◆','●','✧','+'];
  for(let i=0;i<55;i++){
    const piece=document.createElement('span');
    piece.className='confetti-piece';
    piece.textContent=symbols[i%symbols.length];
    piece.style.left=`${Math.random()*100}%`;
    piece.style.animationDelay=`${Math.random()*0.55}s`;
    piece.style.animationDuration=`${2.2+Math.random()*1.6}s`;
    piece.style.setProperty('--drift',`${-120+Math.random()*240}px`);
    piece.style.setProperty('--spin',`${360+Math.random()*720}deg`);
    layer.appendChild(piece);
  }
  document.body.appendChild(layer);
  window.__nebulaConfetti=layer;
}

function clearConfetti(){
  if(window.__nebulaConfetti){
    window.__nebulaConfetti.remove();
    window.__nebulaConfetti=null;
  }
}

function showResult(ok){
  const l=level(),paths=Math.max(1,stepHistory.reduce((n,h)=>n+h.states.length,0));
  $('#modalContent').innerHTML=ok
    ?`<div style="font-size:45px">✦</div><h2>ACCEPTED!</h2><p>The input string belongs to the language.</p>
      <div class="result-stats"><div><small>INPUT</small><b>${input}</b></div><div><small>FINAL STATES</small><b>{${[...active].join(',')||'∅'}}</b></div><div><small>PATHS EXPLORED</small><b>${paths}</b></div></div>
      <div class="modal-actions"><button class="secondary" id="viewPath">VIEW PATH</button><button class="primary" id="nextLevel">${current<LEVEL_SPECS.length-1?'NEXT LEVEL':'FINISH'}</button></div>`
    :`<div style="font-size:45px">×</div><h2>REJECTED</h2><p>No possible path reached an accepting state.</p>
      <div class="result-stats"><div><small>INPUT</small><b>${input||'—'}</b></div><div><small>FINAL STATES</small><b>{${[...active].join(',')||'∅'}}</b></div><div><small>LIVES</small><b>${'♥ '.repeat(lives)||'0'}</b></div></div>
      <div class="modal-actions"><button class="primary" id="tryAgain">TRY AGAIN</button><button class="secondary" id="showPaths">SHOW PATHS</button></div>`;
  $('#modal').classList.add('show');
  $('#nextLevel')?.addEventListener('click',()=>{
    if(current<LEVEL_SPECS.length-1){
      if(!completed.includes(current))completed.push(current);
      localStorage.setItem('nebulaCompleted',JSON.stringify(completed));
      renderLevels();$('#modal').classList.remove('show');openGame(current+1);
    }else{
      if(!completed.includes(current))completed.push(current);
      localStorage.setItem('nebulaCompleted',JSON.stringify(completed));
      renderLevels();
      showAllLevelsComplete();
    }
  });
  $('#tryAgain')?.addEventListener('click',()=>{$('#modal').classList.remove('show');resetGame(false,false)});
  $('#viewPath')?.addEventListener('click',()=>{
    // VIEW PATH closes the result modal and reveals the completed simulation
    // on the same automaton. Nothing is regenerated or restarted.
    $('#modal').classList.remove('show');
    showCompletePath();
    toast('Complete path from START to FINAL is highlighted.');
  });
  $('#showPaths')?.addEventListener('click',()=>{$('#modal').classList.remove('show');toast('Try a different input path.');});
}
function highlightAllPath(){
  showCompletePath();
}
function resetGame(newRun=true,generate=true){
  clearTimeout(autoTimer);
  if(generate)automaton=generateNFA(current+1);
  const l=level();
  input=newRun?'':input;cursor=0;active=new Set([l.start]);stepHistory=[];running=false;if(generate)lives=3;
  renderGraph();updateStats();renderLives();
  clearPathHighlight();
  $('#stringDisplay').textContent=input||'ENTER 0 / 1 / A / B';
  $('#nextBtn').disabled=true;$('#autoBtn').disabled=true;
  $('#levelBadge').textContent=`LEVEL 0${l.id}`;$('#levelName').textContent=l.name;$('#missionTitle').textContent=l.title;
  $('#concept').textContent=l.concept;$('#infoText').textContent=l.description;
  $('#automatonId').textContent=`AUTOMATON #${l.serial}`;
}
function renderLives(){$('#lives').textContent='♥ '.repeat(lives).trim()||'♡';}
function start(){
  if(!input){toast('Enter an input string first.');return}
  if(!isValidInputString(input)){toast('INVALID STRING — use only 0, 1, a or b.');return}

  clearTimeout(autoTimer);
  active=new Set([level().start]);
  cursor=0;
  stepHistory=[];
  running=true;
  $('#nextBtn').disabled=false;
  $('#autoBtn').disabled=false;
  $('#modal').classList.remove('show');
  clearPathHighlight();
  highlight('—',[],[]);
  updateStats('—');
}

function autoPlay(){
  if(!input){toast('Enter an input string first.');return}

  // AUTO PLAY always starts a fresh simulation of the CURRENT input on the
  // CURRENT automaton. It never generates a new NFA.
  clearTimeout(autoTimer);
  active=new Set([level().start]);
  cursor=0;
  stepHistory=[];
  running=true;
  $('#modal').classList.remove('show');
  $('#nextBtn').disabled=true;
  $('#autoBtn').disabled=true;
  clearPathHighlight();
  highlight('—',[],[]);
  updateStats('—');

  const runNext=()=>{
    if(!running)return;
    const hasMore=processOne();
    if(hasMore && running)autoTimer=setTimeout(runNext,850);
  };
  autoTimer=setTimeout(runNext,450);
}
function addSymbol(s){
  if(running){toast('Finish the current simulation first.');return false}
  s=String(s).toLowerCase();
  if(!INPUT_ALPHABET.includes(s)){
    toast(`INVALID SYMBOL — '${s}' is not allowed.`);
    return false;
  }
  input+=s;
  renderInputProgress();
  $('#inputPreview').textContent=input;
  return true;
}
function backspaceInput(){
  if(running){toast('Finish the current simulation first.');return}
  if(!input){toast('Nothing to remove.');return}
  input=input.slice(0,-1);
  cursor=0;
  renderInputProgress();
  $('#inputPreview').textContent=input||'—';
  updateStats();
}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),1800)}

$('#playBtn').onclick=()=>openGame(0);
$('#backBtn').onclick=()=>showScreen('home');
$('#resetBtn').onclick=()=>resetGame(true,true);
$('#startBtn').onclick=start;
$('#nextBtn').onclick=processOne;
$('#autoBtn').onclick=autoPlay;
$('#clearBtn').onclick=()=>{if(!running){input='';cursor=0;renderInputProgress();updateStats()}};
$('#backspaceBtn').onclick=backspaceInput;
$$('[data-symbol]').forEach(b=>b.onclick=()=>addSymbol(b.dataset.symbol));
$('#howBtn').onclick=()=>{
  $('#modalContent').innerHTML='<div style="font-size:40px">◉</div><h2>How it works</h2><p>Enter a string using 0, 1, a or b. The NFA reads one symbol at a time and keeps every state that can be reached. If at least one active path reaches the EXIT state, the input is accepted.</p><button class="primary" id="gotIt">GOT IT</button>';
  $('#modal').classList.add('show');$('#gotIt').onclick=()=>$('#modal').classList.remove('show');
};
$('#modalClose').onclick=()=>$('#modal').classList.remove('show');
$('#closeInfo').onclick=()=>{$('#infoCard').style.display='none'};
$('#infoNav').onclick=()=>{$('#infoCard').style.display='block';showScreen('game')};
$$('[data-nav]').forEach(b=>b.onclick=()=>showScreen(b.dataset.nav==='levels'?'home':b.dataset.nav));
document.addEventListener('keydown',e=>{
  const key=e.key.toLowerCase();

  // Valid input keys must be handled exclusively here. The previous handler
  // added the valid symbol and then fell through to the INVALID SYMBOL check,
  // which incorrectly showed an error for 0, 1, A and B.
  if(INPUT_ALPHABET.includes(key)){
    e.preventDefault();
    addSymbol(key);
    return;
  }

  if(e.key==='Backspace'){
    e.preventDefault();
    backspaceInput();
    return;
  }

  if(key.length===1 && /[a-z0-9]/.test(key) && !running){
    e.preventDefault();
    toast(`INVALID SYMBOL — '${e.key}' is not allowed.`);
    return;
  }

  if(e.key==='Enter'&&!running){
    e.preventDefault();
    start();
    return;
  }

  if(e.key===' '&&running){
    e.preventDefault();
    autoPlay();
  }
});
renderLevels();
showScreen('home');
openGame(0);
showScreen('home');
