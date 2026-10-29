'use client';
import {useEffect,useRef,useState} from 'react';
import {BookOpen,Armchair,ArrowUpRight,ArrowRight,BarChart3,Check,ChevronRight,Clock3,Coffee,Copy,DoorOpen,Expand,Flame,Headphones,Heart,Leaf,Link2,Loader2,Maximize2,MessageCircle,Minimize2,Moon,MoreHorizontal,Pause,Play,Plus,RotateCcw,Send,Settings2,Sparkles,Sun,Trash2,Users,Volume2,VolumeX,X} from 'lucide-react';

type Member={slot:number;name:string;seen:number;visible:number};
type Task={id:string;owner:number;title:string;done:number};
type Msg={id:string;owner:number;content:string;created_at:number};
type Session={id:string;seconds:number;created_at:number};
type State={room:{code:string;duration:number;remaining:number;ends_at:number|null;phase:string};me:number;members:Member[];tasks:Task[];messages:Msg[];sessions:Session[];now:number};
type Identity={code:string;token:string};
const day=(n:number)=>new Date(n).toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'});
const stamp=(n:number)=>new Date(n).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
const timer=(n:number)=>`${Math.floor(n/60).toString().padStart(2,'0')}:${(n%60).toString().padStart(2,'0')}`;
export default function Home(){
 const [identity,setIdentity]=useState<Identity|null>(null),[data,setData]=useState<State|null>(null);
 const [peerMode,setPeerMode]=useState(false);
 const [ready,setReady]=useState(false),[connected,setConnected]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[toast,setToast]=useState('');
 const [now,setNow]=useState(Date.now()),[offset,setOffset]=useState(0),[tab,setTab]=useState('room'),[immersive,setImmersive]=useState(false);
 const [modal,setModal]=useState(''),[name,setName]=useState(''),[joinCode,setJoinCode]=useState(''),[taskInput,setTaskInput]=useState(''),[messageInput,setMessageInput]=useState('');
 const [scene,setScene]=useState('library'),[sound,setSound]=useState('off'),[volume,setVolume]=useState(35);
 const [taskTab,setTaskTab]=useState('mine'),[copied,setCopied]=useState(false);
 const audio=useRef<{context:AudioContext;gain:GainNode;source:AudioBufferSourceNode}|null>(null),messagesEnd=useRef<HTMLDivElement>(null),inFlight=useRef(false),latest=useRef(0),finished=useRef(false),noticeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const notify=(text:string)=>{setToast(text);if(noticeTimer.current)clearTimeout(noticeTimer.current);noticeTimer.current=setTimeout(()=>setToast(''),3800)};
 useEffect(()=>{
  if(!modal)return;
  const prior=document.activeElement as HTMLElement|null;
  const panel=document.querySelector<HTMLElement>('[role="dialog"]');
  const focusable=()=>Array.from(panel?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href]')||[]);
  const initial=setTimeout(()=>{(panel?.querySelector<HTMLElement>('input:not([readonly])')||focusable()[0])?.focus();},20);
  const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const onKey=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){setModal('');setError('');}
   if(e.key==='Tab'){const items=focusable();const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
  };
  document.addEventListener('keydown',onKey);
  return()=>{clearTimeout(initial);document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',onKey);prior?.focus();};
 },[modal]);
 useEffect(()=>{
  setPeerMode(!!(window as any).__TONGZHUO_PEER__);
  const code=new URLSearchParams(window.location.search).get('room')||'';
  let saved:Identity|null=null;try{const last=code||localStorage.getItem('tongzhuo:last');if(last){const t=localStorage.getItem(`tongzhuo:${last}`);if(t)saved={code:last,token:t};} setScene(localStorage.getItem('tongzhuo:scene')||'library');setName(localStorage.getItem('tongzhuo:name')||'');}catch{}
  if(saved){setIdentity(saved);window.history.replaceState(null,'',`?room=${saved.code}`);}else if(code){setJoinCode(code);setModal('join');}
  setReady(true);const tick=setInterval(()=>setNow(Date.now()),1000);return()=>{clearInterval(tick);audio.current?.context.close();};
 },[]);
 const apply=(s:State)=>{setData(s);setOffset(s.now-Date.now());setConnected(true);};
 useEffect(()=>{
  if(!identity)return;
  let disposed=false;
  const sync=async()=>{if(inFlight.current)return;inFlight.current=true;const version=latest.current;
   try{const r=await fetch(`/api/room?code=${identity.code}&visible=${document.hidden?0:1}`,{headers:{Authorization:`Bearer ${identity.token}`},cache:'no-store'});const s:any=await r.json();if(!disposed && version===latest.current){if(!r.ok)throw new Error(s.error);apply(s);}}
   catch{if(!disposed)setConnected(false);}finally{inFlight.current=false;}};
  sync();const poll=setInterval(sync,4000);document.addEventListener('visibilitychange',sync);
  return()=>{disposed=true;clearInterval(poll);document.removeEventListener('visibilitychange',sync);};
 },[identity]);
 useEffect(()=>{messagesEnd.current?.scrollIntoView({behavior:'smooth',block:'nearest'});},[data?.messages.length]);
 const seconds=data ? Math.max(0,data.room.ends_at?Math.ceil((data.room.ends_at-now-offset)/1000):data.room.remaining):1500;
 const running=!!data?.room.ends_at&&seconds>0;
 useEffect(()=>{if(data && seconds===0 && !finished.current){finished.current=true;notify('这一轮完成了，给认真学习的自己一个拥抱。');if(audio.current){const c=audio.current.context;const o=c.createOscillator();const g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=660;g.gain.setValueAtTime(.1,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.8);o.start();o.stop(c.currentTime+.8);}}if(seconds>0)finished.current=false;},[seconds,data]);
 const post=async(action:string,extra:Record<string,unknown>={})=>{
  if(!identity){setModal('create');return false;}if(busy)return false;setBusy(true);setError('');latest.current++;
  try{const r=await fetch('/api/room',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${identity.token}`},body:JSON.stringify({action,code:identity.code,...extra})});const s:any=await r.json();if(!r.ok)throw new Error(s.error);apply(s);return true;}
  catch(e){notify(e instanceof Error?e.message:'操作失败，请稍后重试');return false;}finally{setBusy(false);}
 };
 const enter=async()=>{
  if(!name.trim()){setError('先告诉搭子怎么称呼你吧');return;}setBusy(true);setError('');
  try{let code=joinCode.trim();if(code.includes('://'))code=new URL(code).searchParams.get('room')||'';
   const action=modal==='join'?'join':'create';if(action==='join'&&!/^[a-f0-9]{32}$/.test(code)){setError('请粘贴完整邀请链接或 32 位房间码');return;}
   const stored=localStorage.getItem(`tongzhuo:${code}`);
   const r=await fetch('/api/room',{method:'POST',headers:{'Content-Type':'application/json',...(stored?{Authorization:`Bearer ${stored}`}:{})},body:JSON.stringify({action,name,code})});const s:any=await r.json();if(!r.ok)throw new Error(s.error);
   const next={code:s.code||code,token:s.token||stored};if(!next.token)throw new Error('未能恢复座位，请使用原浏览器');
   localStorage.setItem(`tongzhuo:${next.code}`,next.token);localStorage.setItem('tongzhuo:last',next.code);localStorage.setItem('tongzhuo:name',name.trim());
   setData(null);setConnected(false);setIdentity(next);window.history.replaceState(null,'',`?room=${next.code}`);setModal(action==='create'?'invite':'');notify(action==='create'?'自习室准备好了，把另一个座位留给 TA。':'欢迎入座，今天也一起加油。');
  }catch(e){setError(e instanceof Error?e.message:'连接失败，请稍后重试');}finally{setBusy(false);}
 };
 const copy=async()=>{if(!identity){setModal('create');return;}try{await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?room=${identity.code}`);setCopied(true);notify('邀请链接已复制，发给你的学习搭子吧');setTimeout(()=>setCopied(false),2500);}catch{setModal('invite');setError('请长按或选中链接复制');}};
 const changeSound=async(kind:string)=>{
  if(audio.current){await audio.current.context.close();audio.current=null;}
  if(kind==='off'){setSound('off');return;}
  try{const context=new AudioContext();await context.resume();const gain=context.createGain();gain.gain.value=volume/100*.4;gain.connect(context.destination);
   const buffer=context.createBuffer(2,context.sampleRate*8,context.sampleRate);for(let ch=0;ch<2;ch++){const out=buffer.getChannelData(ch);let last=0;for(let i=0;i<out.length;i++){const white=Math.random()*2-1;last=(last+white*.02)/1.02;out[i]=kind==='rain'?white*.16+last: last*3.5;}}
   const source=context.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(gain);source.start();audio.current={context,gain,source};setSound(kind);
  }catch{notify('浏览器暂时无法播放声音，请再次点击');setSound('off');}
 };
 const switchScene=(s:string)=>{setScene(s);localStorage.setItem('tongzhuo:scene',s);};
 const changeTimer=(action:string,extra:Record<string,unknown>={})=>{if(running){setModal('confirm:'+action+':'+(extra.duration||extra.phase||''));return;}post(action,extra);};
 const leave=()=>{setIdentity(null);setData(null);setConnected(false);localStorage.removeItem('tongzhuo:last');window.history.replaceState(null,'',window.location.pathname);setModal('');notify('已回到大厅，原邀请链接仍可找回座位');};
 const members=data?.members||[],me=data?.me||1,partner=members.find(m=>m.slot!==me);
 const tasks=data?.tasks||[],messages=data?.messages||[],sessions=data?.sessions||[];
 const todaySessions=sessions.filter(s=>day(s.created_at)===day(now));
 const minutes=Math.floor(todaySessions.reduce((a,s)=>a+s.seconds,0)/60);
 const done=tasks.filter(t=>t.done).length,myTasks=tasks.filter(t=>t.owner===(taskTab==='mine'?me:me===1?2:1));
 const memberName=(slot:number)=>members.find(m=>m.slot===slot)?.name||'搭子';
 const status=(m:Member)=>!connected?'连接中断':now+offset-m.seen>20000?'暂时离线':!m.visible?'暂时离开页面':running?'正在专注':'已入座';
 const online=(m:Member)=>connected&&now+offset-m.seen<=20000&&!!m.visible;
 const begin=()=>{if(!identity){setModal('create');return;}if(seconds===0){post('phase',{phase:data?.room.phase==='focus'?'break':'focus'});return;}post(running?'pause':'start');};
 return <div className={`app ${immersive?'immersive':''}`}>
  <aside className="sidebar">
   <a className="brand" href="/" onClick={e=>{e.preventDefault();setTab('room')}}><span className="brand-icon"><BookOpen size={25}/></span><span>同桌<small>TOGETHER, FOCUSED.</small></span></a>
   <div className="side-caption">留一盏灯，等一个同频的人。</div>
   <nav><button className={tab==='room'?'selected':''} onClick={()=>setTab('room')}><Armchair size={19}/>我们的自习室<span className="nav-dot"/></button><button className={tab==='review'?'selected':''} onClick={()=>setTab('review')}><BarChart3 size={19}/>学习足迹</button></nav>
   <div className="side-note"><span className="note-symbol">“</span><p>你不必很厉害<br/>才开始，<br/>但你要开始，<br/>才会很厉害。</p><span className="note-line"/><small>每天一点，慢慢靠近。</small><Leaf className="note-leaf" size={70} strokeWidth={.8}/></div>
   <div className="side-bottom"><div className="tiny-plant"><Leaf size={17}/>好好学习，也好好生活</div><button onClick={()=>setModal('settings')} className="profile"><span className="avatar small">{(members.find(m=>m.slot===me)?.name||'我')[0]}</span><span>{members.find(m=>m.slot===me)?.name||'未来的自己'}<small>{identity?'今天也在认真生长':'准备好，就从现在开始'}</small></span><Settings2 size={17}/></button></div>
  </aside>
  <main>
   <header className="topbar"><div className="breadcrumb">我的空间 <ChevronRight size={13}/> <b>{tab==='room'?'双人自习室':'学习足迹'}</b></div><div className="top-actions"><span className={`live-pill ${identity&&connected?'online':''}`}><i/>{!identity?'等待入座':connected?'房间已连接':'正在重新连接'}</span><button className="invite-button" onClick={()=>identity?copy():setModal('create')}><Users size={16}/>{identity?'邀请学习搭子':'创建双人房间'}<ArrowUpRight size={15}/></button></div></header>
   {tab==='room'?<>
   <section className="greeting"><div><div className="eyebrow"><span/> A LITTLE CLOSER, EVERY DAY</div><h1>隔着距离，也能<span>并肩。</span><span className="heading-star">✳</span></h1><p>把忙碌留在门外。这一刻，和同桌一起专心。</p></div><div className="date-card"><Sun size={19}/><div>{new Date(now).toLocaleDateString('zh-CN',{month:'long',day:'numeric'})}<small>{['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][new Date(now).getDay()]} · 宜专注，宜进步</small></div></div></section>
   <div className="workspace">
    <div className="study-column">
     <section className={`scene scene-${scene}`}>
      <div className="scene-shade"/>{scene==='rain'&&<div className="rain-lines"/>}
      <div className="scene-top"><span className="scene-label"><span className="scene-light"/>{scene==='library'?'日落图书馆':scene==='rain'?'窗边听雨':'午夜书房'}<small> / ROOM FOR TWO</small></span><button aria-label={immersive?'退出沉浸模式':'进入沉浸模式'} title="沉浸模式" onClick={()=>setImmersive(!immersive)}>{immersive?<Minimize2 size={19}/>:<Expand size={19}/>}</button></div>
      <div className="timer-wrap"><div className="timer-tabs"><button className={data?.room.phase!=='break'?'active':''} onClick={()=>changeTimer('phase',{phase:'focus'})}><Flame size={13}/>专注时光</button><button className={data?.room.phase==='break'?'active':''} onClick={()=>changeTimer('phase',{phase:'break'})}><Coffee size={13}/>小憩一下</button></div>
       <div className="timer" aria-live="off">{timer(seconds)}</div><p className="timer-subtitle">{seconds===0?'好好休息，下一程再一起。':running?'你正在靠近想成为的自己':identity?'准备好了，就一起开始吧':'从这 25 分钟开始，慢慢变好'}</p>
       <div className="timer-controls"><button className="round-button" title="重新计时" aria-label="重新计时" disabled={busy} onClick={()=>changeTimer('reset')}><RotateCcw size={18}/></button><button className="start-button" disabled={busy} onClick={begin}>{busy?<Loader2 size={17} className="spin"/>:running?<Pause size={17} fill="currentColor"/>:<Play size={17} fill="currentColor"/>}{seconds===0?(data?.room.phase==='focus'?'休息 5 分钟':'开始新一轮'):running?'暂停一下':'开始专注'}</button><button className="round-button" aria-label="选择专注时长" title="专注时长" onClick={()=>setModal('duration')}><Settings2 size={18}/></button></div>
       <div className="tomato-dots">{Array.from({length:4}).map((_,i)=><span key={i} className={i<todaySessions.length%4?'filled':''}/>)}<span className="round-count">今日第 {todaySessions.length+1} 轮</span></div>
      </div>
      <div className="scene-bottom"><div><span className="scene-quote">此刻，各自努力。也是一起。</span><small>SAME MOMENT. DIFFERENT PLACES. TOGETHER.</small></div><span className="quiet-tag"><Headphones size={14}/>请轻轻地，进入专注</span></div>
     </section>
     <section className="seats"><div className="seats-title"><span><Users size={16}/>我们的座位</span><small>{members.length===2?'两个人，一起向前':'总有一个座位，为 TA 留着'}</small></div><div className="seat-grid">{[me,me===1?2:1].map((slot,i)=>{const m=members.find(x=>x.slot===slot);return <div key={slot} className={`seat ${!m?'empty-seat':''}`}><span className={`avatar ${i===1?'peach':''}`}>{m?m.name[0]:<Armchair size={24}/>}<i className={m&&online(m)?'on':''}/></span><div className="seat-info"><strong>{m?m.name:i===0?'我的座位':'搭子的专属座位'}<small>{i===0?'我':'同桌'}</small></strong><p>{m?status(m):i===0?'准备入座，开启今天的旅程':'等 TA 一起翻开新的一页'}</p></div>{m?<span className={`seat-status ${online(m)?'active':''}`}><i/>{online(m)?running?'专注中':'在线':'离开'}</span>:<button aria-label={i===0?'创建房间':'邀请搭子'} onClick={()=>identity?copy():setModal('create')}><Plus size={18}/></button>}</div>})}</div><div className="seat-foot"><span className="link-line"/><Heart size={12}/><span>{partner&&online(partner)?'有人和你一起努力，这感觉真好。':'不用时刻说话，在这里，就是陪伴。'}</span><span className="link-line"/></div></section>
     <section className="ambience"><div className="ambience-title"><Headphones size={18}/><div>给专注一点背景音<small>戴上耳机，让世界安静一点</small></div></div><div className="sound-choices"><button className={sound==='off'?'active':''} onClick={()=>changeSound('off')}><VolumeX size={15}/>安静</button><button className={sound==='rain'?'active':''} onClick={()=>changeSound('rain')}><span>☂</span>雨声</button><button className={sound==='brown'?'active':''} onClick={()=>changeSound('brown')}><Volume2 size={15}/>棕噪音</button></div><label className="volume"><Volume2 size={14}/><input aria-label="背景音音量" type="range" min="0" max="100" value={volume} onChange={e=>{const v=Number(e.target.value);setVolume(v);if(audio.current)audio.current.gain.gain.value=v/100*.4;}}/></label></section>
    </div>
    <aside className="right-column">
     <section className="card today-card"><div className="card-title"><span><Sun size={16}/>今天的小小进步</span><span className="muted tiny">TODAY</span></div><div className="stats"><div><strong>{minutes}<small>分钟</small></strong><span>共同专注</span></div><div><strong>{done}<small>/ {tasks.length}</small></strong><span>完成的目标</span></div></div><div className="progress-track"><i style={{width:`${tasks.length?done/tasks.length*100:0}%`}}/></div><p><Sparkles size={12}/>{minutes>0?'每一分钟的坚持，都有意义。':'一小步，也算数。'}</p></section>
     <section className="card task-card"><div className="card-title"><span><Check size={17}/>把今天，一件件做好</span><span className="muted tiny">{done}/{tasks.length}</span></div><div className="task-tabs"><button className={taskTab==='mine'?'active':''} onClick={()=>setTaskTab('mine')}>我的计划</button><button className={taskTab==='partner'?'active':''} onClick={()=>setTaskTab('partner')}>同桌的计划</button></div><div className="task-list">{myTasks.length?myTasks.map(t=><div className={`task ${t.done?'done':''}`} key={t.id}><button className="checkbox" disabled={t.owner!==me||busy} aria-label={`${t.done?'取消完成':'完成'}：${t.title}`} onClick={()=>post('toggle',{id:t.id})}>{!!t.done&&<Check size={12}/>}</button><span>{t.title}</span>{t.owner===me&&<button className="delete-task" aria-label={`删除：${t.title}`} onClick={()=>post('delete',{id:t.id})}><X size={13}/></button>}</div>):<div className="empty-tasks"><span className="empty-illustration"><BookOpen size={27} strokeWidth={1.2}/><Leaf size={15}/></span><p>{taskTab==='mine'?'先写下一件想完成的小事':'TA 的小目标会出现在这里'}</p><small>{taskTab==='mine'?'不用太多，一件就很好。':'彼此看见，就是温柔的监督。'}</small></div>}</div>{taskTab==='mine'&&<form className="task-input" onSubmit={async e=>{e.preventDefault();if(!taskInput.trim())return;if(await post('task',{title:taskInput}))setTaskInput('');}}><Plus size={15}/><input value={taskInput} onChange={e=>setTaskInput(e.target.value)} maxLength={100} placeholder="添加一个小目标…" aria-label="学习目标"/><button aria-label="添加目标" disabled={busy||!taskInput.trim()}><ArrowRight size={15}/></button></form>}</section>
     <section className="card chat-card"><div className="card-title"><span><MessageCircle size={16}/>悄悄话便利贴</span><Heart size={14} className="heart-outline"/></div><div className="messages">{messages.length?messages.map(m=><div key={m.id} className={`message ${m.owner===me?'mine':''}`}><div className="message-meta"><span>{memberName(m.owner)}{m.owner===me?' · 我':''}</span><time>{stamp(m.created_at)}</time></div><p>{m.content}</p></div>):<div className="chat-empty"><span>给未来的进步，留句话。</span><p>「你认真学习的样子，闪闪发光。」</p><small>鼓励不用很多，刚好被看见就好。</small></div>}<div ref={messagesEnd}/></div><div className="quick-messages"><button disabled={busy} onClick={()=>post('message',{content:'一起加油，你可以的 🌱'})}>🌱 一起加油</button><button disabled={busy} onClick={()=>post('message',{content:'我去接杯水，一会儿回来 ☕'})}>☕ 去接杯水</button></div><form className="message-input" onSubmit={async e=>{e.preventDefault();if(!messageInput.trim())return;if(await post('message',{content:messageInput}))setMessageInput('');}}><input value={messageInput} onChange={e=>setMessageInput(e.target.value)} maxLength={280} aria-label="给搭子留言" placeholder="给同桌一句鼓励…"/><button disabled={busy||!messageInput.trim()} aria-label="发送留言"><Send size={15}/></button></form></section>
    </aside>
   </div><footer className="footer"><span>不赶路，感受路。一起慢慢变好。</span><button onClick={()=>setModal('scene')}><Moon size={13}/>切换自习场景<ChevronRight size={12}/></button></footer>
   </>:<section className="review"><div className="eyebrow">OUR LITTLE MILESTONES</div><h1>努力过的每一刻，<br/><span>都留下了足迹。</span></h1><p>每完成一轮专注，就为你们记下一个小小的里程碑。</p><div className="review-stats"><div><Clock3/><strong>{Math.floor(sessions.reduce((a,s)=>a+s.seconds,0)/60)}<small>分钟</small></strong><p>房间累计专注</p></div><div><Flame/><strong>{sessions.length}<small>轮</small></strong><p>完整专注轮次</p></div><div><Check/><strong>{done}<small>件</small></strong><p>共同完成的目标</p></div></div><div className="review-history"><h3>一起走过的专注时光</h3>{sessions.length?sessions.map(s=><div className="history-row" key={s.id}><span className="history-icon"><Leaf size={18}/></span><div>完成了一轮 {s.seconds/60} 分钟专注<small>{day(s.created_at)} · {stamp(s.created_at)}</small></div><span>+{s.seconds/60} min</span></div>):<div className="history-empty"><BookOpen size={36} strokeWidth={1}/><p>故事还没写下，空白也充满可能。</p><button onClick={()=>setTab('room')}>回自习室，开始第一轮 <ArrowRight size={15}/></button></div>}<small className="history-note">记录保留最近 100 轮 · 完整计时结束后自动记录，不含暂停与未完成的轮次</small></div></section>}
  </main>
  {toast&&<div className="toast" role="status"><Check size={16}/>{toast}</div>}
  {modal&&<div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget&&!busy)setModal('')}}><section className="modal" role="dialog" aria-modal="true" aria-label="自习室设置"><button className="modal-close" aria-label="关闭" onClick={()=>{setModal('');setError('')}}><X size={20}/></button>
   {(modal==='create'||modal==='join')&&<><span className="modal-icon"><Armchair size={29}/></span><div className="eyebrow">A ROOM FOR YOU TWO</div><h2>{modal==='create'?'留个座位，一起学习。':'你的同桌，正在等你。'}</h2><p>{modal==='create'?'创建你们的小小自习室，把邀请链接发给 TA。':'加入同一间房，把距离留给地图。'}</p><form onSubmit={e=>{e.preventDefault();enter()}}><label>怎么称呼你？<input autoFocus maxLength={12} placeholder="给自己起个昵称" value={name} onChange={e=>setName(e.target.value)}/></label>{modal==='join'&&<label>邀请链接或房间码<input required value={joinCode} onChange={e=>setJoinCode(e.target.value)} placeholder="粘贴搭子发来的邀请链接"/></label>}{error&&<p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy?<Loader2 className="spin" size={17}/>:modal==='create'?'创建我们的自习室':'入座，开始陪伴'}{!busy&&<ArrowRight size={17}/>}</button></form><button className="text-button" onClick={()=>{setError('');setModal(modal==='create'?'join':'create')}}>{modal==='create'?'已经有邀请链接？加入房间':'想开一间新的？创建房间'}<ChevronRight size={13}/></button><small className="modal-tip">{peerMode?"双人直连 · 房主需保持此页面打开 · 记录保存在本机":"仅有两个座位 · 无需注册 · 请保留原浏览器的座位记录"}</small></>}
   {modal==='invite'&&<><span className="modal-icon"><Users size={28}/></span><h2>另一个座位，留给 TA。</h2><p>把链接发给学习搭子，即可进入同一间自习室。</p><div className="invite-preview"><Armchair/><span className="dashed-line"/><Heart size={17}/><span className="dashed-line"/><Armchair/></div><input className="invite-link" readOnly onFocus={e=>e.target.select()} value={ready&&identity?`${window.location.origin}${window.location.pathname}?room=${identity.code}`:''} aria-label="邀请链接"/><button className="primary" onClick={copy}>{copied?<Check size={17}/>:<Copy size={17}/>} {copied?'复制好了':'复制邀请链接'}</button>{error&&<p className="error">{error}</p>}<small className="modal-tip">拿到链接的人可以占用空座位，请只分享给你的搭子。<br/>{peerMode?"房主请保持页面打开，搭子才能连接。记录保存在本机，清除浏览器数据会丢失。":"座位会保存在当前浏览器，清除浏览器数据后无法自动找回。"}</small></>}
   {modal==='duration'&&<><span className="modal-icon"><Clock3 size={28}/></span><h2>给这段专注，一点时间。</h2><p>选择适合你们的节奏，修改后同步到双方。</p><div className="duration-options">{[25,50,90].map(n=><button key={n} className={data?.room.duration===n*60?'chosen':''} disabled={busy} onClick={()=>{setModal('');changeTimer('duration',{duration:n*60})}}><strong>{n}</strong><span>分钟</span></button>)}</div><small className="modal-tip">切换时长会重新计时；建议先和搭子说一声。</small></>}
   {modal==='scene'&&<><span className="modal-icon"><Moon size={28}/></span><h2>换个地方，继续热爱。</h2><p>只改变你的场景，不打扰搭子的选择。</p><div className="scene-options">{[['library','日落图书馆','温暖的书架，刚好的安静'],['rain','窗边听雨','雨幕轻落，隔开一点喧嚣'],['night','午夜书房','夜色渐深，心渐渐安静']].map(([s,t,d])=><button key={s} className={scene===s?'chosen':''} onClick={()=>{switchScene(s);setModal('')}}><span className={`scene-thumb scene-${s}`}/><span><b>{t}</b><small>{d}</small></span>{scene===s?<Check size={18}/>:<ChevronRight size={18}/>}</button>)}</div></>}
   {modal==='settings'&&<><span className="modal-icon"><Settings2 size={28}/></span><h2>我的小小空间</h2><p>保存好邀请链接，随时回来找你的同桌。</p><label>我的昵称<input value={name} maxLength={12} onChange={e=>setName(e.target.value)}/></label><button className="primary" disabled={!name.trim()||busy} onClick={async()=>{if(identity){if(await post('name',{name})){localStorage.setItem('tongzhuo:name',name);setModal('');notify('昵称已更新');}}else{localStorage.setItem('tongzhuo:name',name);setModal('')}}}>保存昵称<Check size={16}/></button><div className="settings-links"><button onClick={()=>setModal('scene')}><Moon size={17}/>选择自习场景<ChevronRight size={16}/></button><button onClick={()=>{setModal('');setImmersive(!immersive)}}><Maximize2 size={17}/>切换沉浸模式<ChevronRight size={16}/></button>{identity&&<><button onClick={()=>setModal('invite')}><Link2 size={17}/>查看邀请链接<ChevronRight size={16}/></button><button onClick={()=>setModal('leave')}><DoorOpen size={17}/>回到大厅<ChevronRight size={16}/></button></>}</div><small className="modal-tip">手机浏览器菜单中选择「添加到主屏幕」，<br/>下次就可以像 App 一样打开。</small></>}
   {modal==='leave'&&<><h2>先回大厅坐坐？</h2><p>座位仍然为你保留，使用原邀请链接可以回来。搭子可以继续学习。</p><button className="primary" onClick={leave}>回到大厅<DoorOpen size={17}/></button><button className="text-button" onClick={()=>setModal('settings')}>继续留在这里</button></>}
   {modal.startsWith('confirm:')&&<><span className="modal-icon"><Clock3 size={28}/></span><h2>要重新开始这轮计时吗？</h2><p>两个人的计时会一起改变，当前未完成的这轮不会计入学习足迹。</p><button className="primary" disabled={busy} onClick={async()=>{const [,a,v]=modal.split(':');if(await post(a,a==='duration'?{duration:Number(v)}:a==='phase'?{phase:v}:{}))setModal('')}}>确认，重新计时<RotateCcw size={16}/></button><button className="text-button" onClick={()=>setModal('')}>继续这一轮</button></>}
  </section></div>}
 </div>;
}


