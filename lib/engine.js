// Motor da Cacheta + IA. O MESMO código roda no navegador (modo computador) e no servidor (online).







/* =====================================================================
   MOTOR DA CACHETA — funções puras, sem DOM.
   Toda jogada passa por Engine.act(), que valida e devolve um evento.
   O mesmo módulo vai rodar no servidor na etapa online.
   ===================================================================== */
const Engine=(()=>{
  const RANKS=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];   // r = 0..12
  const SUITS=['♠','♥','♦','♣'];
  const DEFAULT={hand:9,coringa:'viraCor',deck:'completo',maxJ:99,aceHigh:true,limpaDobro:true,fichas:5};
  // ordem das cartas no baralho em uso: completo (A..K) ou curto (sem 8, 9 e 10, aí 7 e J ficam seguidos)
  const ORDER_FULL=[0,1,2,3,4,5,6,7,8,9,10,11,12], ORDER_SHORT=[0,1,2,3,4,5,6,10,11,12];
  const order=cfg=>(cfg&&cfg.deck==='curto')?ORDER_SHORT:ORDER_FULL;
  const posOf=cfg=>{const o=order(cfg),m=[];o.forEach((r,i)=>m[r]=i);return m;};
  const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]];}return a;};
  const name=c=>RANKS[c.r]+SUITS[c.s];
  // coringa: cor = valor (0-12) vale todos os naipes; cor = valor + 16*(1+cor) vale só os naipes da mesma cor da vira
  const colorOf=s=>(s===1||s===2)?1:0;            // 0 = preto (♠♣), 1 = vermelho (♥♦)
  const isJ=(c,cor)=>cor>=0&&c.r===cor%16&&(cor<16||colorOf(c.s)===Math.floor(cor/16)-1);
  const corRank=cor=>cor<0?-1:cor%16;
  const corColor=cor=>cor<16?-1:Math.floor(cor/16)-1;   // -1 todos, 0 preto, 1 vermelho
  const corSuits=cor=>cor<0?[]:cor<16?[0,1,2,3]:[0,1,2,3].filter(s=>colorOf(s)===corColor(cor));

  // Melhor organização das cartas em jogos. Devolve {cov, melds, dead}.
  function analyze(cards,cor,cfg){
    const maxJ=cfg.maxJ, aceHigh=cfg.aceHigh;
    const PM=posOf(cfg), N=order(cfg).length, P=c=>PM[c.r];
    const nat=cards.filter(c=>!isJ(c,cor)).sort((a,b)=>P(a)-P(b)||a.s-b.s);
    const jok=cards.filter(c=>isJ(c,cor));
    const total=cards.length;
    let best={cov:-1,melds:[],dead:cards.slice()};
    function finish(melds,dead,jk){
      let cov=total-dead.length-jk.length;
      const m2=melds.map(m=>({c:m.c.slice(),j:m.j})), d2=dead.slice();
      let left=jk.slice();
      for(const m of m2){ while(left.length&&m.j<maxJ){m.c.push(left.pop());m.j++;cov++;} }
      if(left.length>=3&&maxJ>=3){m2.push({c:left,j:left.length});cov+=left.length;left=[];}
      d2.push(...left);
      if(cov>best.cov) best={cov,melds:m2.map(m=>m.c),dead:d2};
    }
    function rec(nat,jk,melds,dead){
      if(best.cov===total) return;
      if(!nat.length) return finish(melds,dead,jk);
      if(total-dead.length<=best.cov) return;
      const c=nat[0], rest=nat.slice(1);
      // trinca: mesmo valor, naipes diferentes (até 4)
      const others=[], seen=new Set([c.s]);
      for(const x of rest) if(x.r===c.r&&!seen.has(x.s)){seen.add(x.s);others.push(x);}
      for(let mask=(1<<others.length)-1;mask>=0;mask--){
        const S=others.filter((_,i)=>mask>>i&1);
        const size=1+S.length, need=Math.max(0,3-size);
        if(need>jk.length||need>maxJ||size+need>4) continue;
        rec(rest.filter(x=>!S.includes(x)),jk.slice(need),[...melds,{c:[c,...S,...jk.slice(0,need)],j:need}],dead);
      }
      // sequência do mesmo naipe, Ás baixo
      for(let k=0;k<=Math.min(2,jk.length,P(c),maxJ);k++){
        const avail=rest.slice(); let jU=k; const seq=[...jk.slice(0,k),c]; let pos=P(c)+1;
        if(seq.length>=3) rec(avail.slice(),jk.slice(jU),[...melds,{c:seq.slice(),j:jU}],dead);
        while(pos<=N-1){
          const i=avail.findIndex(x=>x.s===c.s&&P(x)===pos);
          if(i>=0){seq.push(avail[i]);avail.splice(i,1);}
          else if(jU<jk.length&&jU<maxJ){seq.push(jk[jU]);jU++;}
          else break;
          pos++;
          if(seq.length>=3) rec(avail.slice(),jk.slice(jU),[...melds,{c:seq.slice(),j:jU}],dead);
        }
      }
      // Ás alto (…Q-K-A)
      if(c.r===0&&aceHigh){
        const avail=rest.slice(); let jU=0; const seq=[c]; let pos=N-1;
        while(pos>=1){
          const i=avail.findIndex(x=>x.s===c.s&&P(x)===pos);
          if(i>=0){seq.unshift(avail[i]);avail.splice(i,1);}
          else if(jU<jk.length&&jU<maxJ){seq.unshift(jk[jU]);jU++;}
          else break;
          pos--;
          if(seq.length>=3) rec(avail.slice(),jk.slice(jU),[...melds,{c:seq.slice(),j:jU}],dead);
        }
      }
      rec(rest,jk,melds,[...dead,c]);
    }
    rec(nat,jok,[],[]);
    return best;
  }

  function newMatch(cfg,players){
    cfg={...DEFAULT,...cfg};
    return {cfg,players:players.map(p=>({...p,fichas:cfg.fichas,hand:[]})),dealer:Math.random()*players.length|0,round:0};
  }
  const alive=M=>M.players.filter(p=>p.fichas>0);
  function nextIdx(M,i){do{i=(i+1)%M.players.length;}while(M.players[i].fichas<=0);return i;}
  function startRound(M){
    const deck=[];let id=0;
    const decks=M.cfg.decks||(M.players.length>=6?3:2); M.decks=decks;
    const ORD=order(M.cfg);
    for(let k=0;k<decks;k++)for(let s=0;s<4;s++)for(const r of ORD)deck.push({id:id++,r,s});
    shuffle(deck);
    M.players.forEach(p=>{p.hand=[];p.queimado=false;});
    for(let n=0;n<M.cfg.hand;n++) M.players.forEach(p=>{if(p.fichas>0)p.hand.push(deck.pop());});
    M.vira=deck.pop();
    const nx=ORD[(posOf(M.cfg)[M.vira.r]+1)%ORD.length];   // a carta seguinte à vira
    M.cor=M.cfg.coringa==='vira'?nx:M.cfg.coringa==='viraCor'?nx+16*(1+colorOf(M.vira.s)):-1;
    M.monte=deck; M.desc=[]; M.taken=null; M.phase='draw'; M.over=false; M.result=null;
    M.history=[]; M.round++; M.turn=nextIdx(M,M.dealer);
  }
  function drawMonte(M){
    if(!M.monte.length){
      if(M.desc.length<2) return null;
      const top=M.desc.pop(); M.monte=shuffle(M.desc); M.desc=[top];
    }
    return M.monte.pop();
  }
  function findBater(M,hand,forbid){
    const idx=hand.map((_,i)=>i).sort((a,b)=>isJ(hand[a],M.cor)-isJ(hand[b],M.cor));
    for(const i of idx){
      if(hand[i].id===forbid) continue;
      if(analyze(hand.filter((_,j)=>j!==i),M.cor,M.cfg).cov===M.cfg.hand) return i;
    }
    return -1;
  }
  const err=e=>({ok:false,err:e});
  function act(M,pi,a){
    if(M.over) return err('A rodada já terminou');
    if(M.turn!==pi) return err('Não é a sua vez');
    const p=M.players[pi];
    if(a.type==='draw'){
      if(M.phase!=='draw') return err('Você já comprou nesta vez');
      let c;
      if(a.from==='desc'){ if(!M.desc.length) return err('O descarte está vazio'); c=M.desc.pop(); M.taken=c.id; }
      else { c=drawMonte(M); M.taken=null;
        if(!c){ M.over=true; M.result={empate:true}; M.dealer=nextIdx(M,M.dealer); return {ok:true,ev:{type:'empate'}}; } }
      p.hand.push(c); M.phase='discard';
      M.history.push({pi,t:'draw',from:a.from,card:c});
      return {ok:true,ev:{type:'draw',pi,from:a.from,card:c}};
    }
    if(a.type==='baterDesc'){
      // bater pegando a carta do descarte, direto, sem precisar comprar antes
      if(M.phase!=='draw') return err('Você já comprou: escolha a carta e toque em BATER');
      if(!M.desc.length) return err('Não tem carta no descarte');
      if(p.queimado) return err('Você errou uma batida nesta rodada: agora só pode bater comprando do monte');
      const top=M.desc[M.desc.length-1], all=[...p.hand,top];
      const b=findBater(M,all,top.id);
      if(b<0){
        // batida errada: não leva a carta, perde a vez e fica queimado
        p.queimado=true; M.history.push({pi,t:'pass',errou:true});
        M.turn=nextIdx(M,M.turn); M.phase='draw'; M.taken=null;
        return {ok:true,ev:{type:'bateuErrado',pi,card:null,top}};
      }
      const cardId=all[b].id;
      const r1=act(M,pi,{type:'draw',from:'desc'}); if(!r1.ok) return r1;
      const r2=act(M,pi,{type:'bater',cardId}); if(!r2.ok) return r2;
      r2.ev.top=top; return r2;
    }
    if(a.type==='discard'||a.type==='bater'){
      if(M.phase!=='discard') return err('Compre uma carta primeiro');
      const i=p.hand.findIndex(c=>c.id===a.cardId);
      if(i<0) return err('Carta inválida');
      if(a.cardId===M.taken) return err('Não pode descartar a carta que pegou do descarte');
      const card=p.hand[i];
      if(a.type==='bater'){
        if(p.queimado&&M.taken!=null) return err('Você errou uma batida nesta rodada: agora só pode bater comprando do monte');
        const rest=p.hand.filter((_,j)=>j!==i);
        const an=analyze(rest,M.cor,M.cfg);
        if(an.cov!==M.cfg.hand){
          // batida errada (blefe): descarta a carta, perde a vez e fica queimado
          p.hand.splice(i,1); M.desc.push(card); p.queimado=true;
          M.history.push({pi,t:'discard',card,errou:true});
          M.turn=nextIdx(M,M.turn); M.phase='draw'; M.taken=null;
          return {ok:true,ev:{type:'bateuErrado',pi,card}};
        }
        p.hand=rest; M.desc.push(card);
        const limpa=M.cor>=0&&!rest.some(c=>isJ(c,M.cor));
        const loss=limpa&&M.cfg.limpaDobro?2:1;
        const before=M.players.map(x=>x.fichas);
        M.players.forEach((x,k)=>{if(k!==pi&&x.fichas>0)x.fichas=Math.max(0,x.fichas-loss);});
        M.over=true; M.phase='end'; M.dealer=nextIdx(M,M.dealer);
        M.result={winner:pi,melds:an.melds,limpa,loss,before,card,
          matchOver:alive(M).length<=1, champion:alive(M).length===1?M.players.indexOf(alive(M)[0]):null};
        return {ok:true,ev:{type:'bater',pi,card,result:M.result}};
      }
      p.hand.splice(i,1); M.desc.push(card);
      M.history.push({pi,t:'discard',card});
      M.turn=nextIdx(M,M.turn); M.phase='draw'; M.taken=null;
      return {ok:true,ev:{type:'discard',pi,card}};
    }
    return err('Ação desconhecida');
  }
  // diz se um grupo de cartas forma um jogo válido sozinho: 'trinca', 'sequencia' ou null
  function meldType(cards,cor,cfg){
    if(cards.length<3) return null;
    const an=analyze(cards,cor,cfg);
    if(an.cov!==cards.length||an.melds.length!==1) return null;
    const nat=cards.filter(c=>!isJ(c,cor));
    return nat.length&&nat.every(c=>c.r===nat[0].r)?'trinca':'sequencia';
  }
  return {RANKS,SUITS,DEFAULT,analyze,meldType,newMatch,startRound,act,findBater,isJ,corRank,corColor,corSuits,order,posOf,name,nextIdx,alive};
})();

/* =====================================================================
   INTELIGÊNCIA ARTIFICIAL — fácil, médio e difícil
   ===================================================================== */
const AI=(()=>{
  const E=Engine;
  function seenCount(M,hand,r,s){ // quantas cópias dessa carta já estão à vista
    let n=0; for(const c of hand) if(c.r===r&&c.s===s) n++;
    for(const c of M.desc) if(c.r===r&&c.s===s) n++;
    if(M.vira.r===r&&M.vira.s===s) n++;
    return n;
  }
  function outs(M,hand,x,y){
    let need=[];
    const O=E.order(M.cfg), PM=E.posOf(M.cfg);
    if(x.r===y.r){ for(let s=0;s<4;s++) if(s!==x.s&&s!==y.s) need.push([x.r,s]); }
    else { const lo=Math.min(PM[x.r],PM[y.r]), hi=Math.max(PM[x.r],PM[y.r]);
      if(hi-lo===1){ if(lo>0)need.push([O[lo-1],x.s]); if(hi<O.length-1)need.push([O[hi+1],x.s]); }
      else need.push([O[lo+1],x.s]); }
    let o=0; for(const [r,s] of need) o+=Math.max(0,(M.decks||2)-seenCount(M,hand,r,s));
    return o;
  }
  function evalHand(M,cards,level){
    const an=E.analyze(cards,M.cor,M.cfg);
    const d=an.dead.filter(c=>!E.isJ(c,M.cor)), PM=E.posOf(M.cfg);
    let p=0, po=0;
    for(let i=0;i<d.length;i++)for(let j=i+1;j<d.length;j++){
      const x=d[i],y=d[j];
      const pair=(x.r===y.r&&x.s!==y.s)||(x.s===y.s&&x.r!==y.r&&Math.abs(PM[x.r]-PM[y.r])<=2);
      if(pair){p++; if(level==='dificil') po+=Math.min(outs(M,cards,x,y),4);}
    }
    const jk=cards.filter(c=>E.isJ(c,M.cor)).length;
    if(level==='dificil') return an.cov*10+Math.min(po,14)+jk*4;
    if(level==='facil') return an.cov*10+Math.min(p,3)*2;
    return an.cov*10+Math.min(p,4)*3+jk*4;
  }
  function danger(M,pi,card){ // difícil: evita dar carta que o próximo quer
    const np=E.nextIdx(M,pi), PM=E.posOf(M.cfg); let d=0;
    for(const h of M.history){
      if(h.pi!==np) continue;
      const c=h.card;
      if(h.t==='draw'&&h.from==='desc'){
        if(c.r===card.r) d+=5;
        else if(c.s===card.s&&Math.abs(PM[c.r]-PM[card.r])<=2) d+=3;
      }
      if(h.t==='discard'){
        if(c.r===card.r) d-=2;
        if(c.s===card.s&&Math.abs(PM[c.r]-PM[card.r])<=1) d-=1;
      }
    }
    return d;
  }
  function chooseDiscard(M,pi,hand,forbid,level){
    const an=E.analyze(hand,M.cor,M.cfg);
    if(level==='facil'&&Math.random()<0.5){
      const loose=an.dead.filter(c=>c.id!==forbid&&!E.isJ(c,M.cor));
      if(loose.length) return hand.indexOf(loose[Math.random()*loose.length|0]);
    }
    let best=-1e9,bi=-1;
    hand.forEach((c,i)=>{
      if(c.id===forbid) return;
      let sc=evalHand(M,hand.filter((_,j)=>j!==i),level);
      if(E.isJ(c,M.cor)) sc-=60;
      if(level==='dificil') sc-=danger(M,pi,c);
      sc+=Math.random()*0.4;
      if(sc>best){best=sc;bi=i;}
    });
    return bi;
  }
  function chooseDraw(M,pi,level){
    const p=M.players[pi], top=M.desc[M.desc.length-1];
    if(!top) return 'monte';
    if(E.isJ(top,M.cor)) return level==='facil'&&Math.random()<0.5?'monte':'desc';
    const withTop=[...p.hand,top];
    if(level!=='facil'&&E.findBater(M,withTop,top.id)>=0) return 'desc';
    if(level==='facil'){
      return E.analyze(withTop,M.cor,M.cfg).cov>E.analyze(p.hand,M.cor,M.cfg).cov+0&&Math.random()<0.7?'desc':'monte';
    }
    const cur=evalHand(M,p.hand,level);
    const i=chooseDiscard(M,pi,withTop,top.id,level);
    const after=evalHand(M,withTop.filter((_,j)=>j!==i),level);
    return after>cur+(level==='dificil'?0.5:1)?'desc':'monte';
  }
  function chooseEnd(M,pi,level){
    const p=M.players[pi];
    const b=(p.queimado&&M.taken!=null)?-1:E.findBater(M,p.hand,M.taken);
    if(b>=0&&!(level==='facil'&&Math.random()<0.35)) return {type:'bater',cardId:p.hand[b].id};
    return {type:'discard',cardId:p.hand[chooseDiscard(M,pi,p.hand,M.taken,level)].id};
  }
  return {chooseDraw,chooseEnd,chooseDiscard};
})();

export { Engine, AI };
