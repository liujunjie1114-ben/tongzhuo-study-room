import {get,put,BlobPreconditionFailedError} from '@vercel/blob';
import {randomUUID} from 'node:crypto';
export class RoomError extends Error {status:number;constructor(message:string,status=400){super(message);this.status=status}}
const id=()=>randomUUID().replaceAll('-','');
const text=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):'';
interface Member {slot:number;name:string;token:string;seen:number;visible:number}
interface Task {id:string;owner:number;title:string;done:number;created_at:number}
interface Message {id:string;owner:number;content:string;created_at:number}
interface Session {id:string;seconds:number;created_at:number}
interface StoredRoom {
 room:{code:string;duration:number;remaining:number;ends_at:number|null;phase:string;run_id:string|null;created_at:number};
 members:Member[];tasks:Task[];messages:Message[];sessions:Session[];
}
function finish(s:StoredRoom,now:number){
 const r=s.room;
 if(r.ends_at && r.ends_at<=now){
  if(r.phase==='focus'&&r.run_id&&!s.sessions.some(x=>x.id===r.run_id))s.sessions.unshift({id:r.run_id,seconds:r.duration,created_at:r.ends_at});
  s.sessions=s.sessions.slice(0,100);r.ends_at=null;r.remaining=0;
 }
}
function publicState(s:StoredRoom,me:number,now:number){return {...s,members:s.members.map(({token,...m})=>m),me,now};}
export async function roomAction(action:string,codeInput:unknown,token:string,body:Record<string,unknown>={},visible=true){
 const now=Date.now(),code=text(codeInput,40),newToken=id();
 if(action==='create'){
  const name=text(body.name,12);if(!name)throw new RoomError('请填写你的昵称');
  const newCode=id();const s:StoredRoom={room:{code:newCode,duration:1500,remaining:1500,ends_at:null,phase:'focus',run_id:null,created_at:now},members:[{slot:1,name,token:newToken,seen:now,visible:1}],tasks:[],messages:[],sessions:[]};
  await put(`rooms/${newCode}.json`,JSON.stringify(s),{access:'private',addRandomSuffix:false,contentType:'application/json',allowOverwrite:false});
  return {code:newCode,token:newToken};
 }
 if(!/^[a-f0-9]{32}$/.test(code))throw new RoomError('没有找到这个房间，请检查邀请链接',404);
 const path=`rooms/${code}.json`;
 for(let retry=0;retry<7;retry++){
  const stored=await get(path,{access:'private',useCache:false});
  if(!stored?.stream)throw new RoomError('没有找到这个房间，请检查邀请链接',404);
  const s=await new Response(stored.stream).json() as StoredRoom;
  let member=s.members.find(m=>m.token===token);
  let joining=false;
  if(action==='join'&&!member){
   const name=text(body.name,12);if(!name)throw new RoomError('请填写你的昵称');
   if(s.members.length>=2)throw new RoomError('两张座位都有主人了，请使用原来的浏览器，或新建房间',409);
   member={slot:2,name,token:newToken,seen:now,visible:1};s.members.push(member);joining=true;
  }
  if(!member)throw new RoomError('请先加入这个房间',401);
  member.seen=now;member.visible=visible?1:0;finish(s,now);
  const r=s.room;
  switch(action){
   case 'sync':case 'join':break;
   case 'start':if(!r.ends_at&&r.remaining>0){r.ends_at=now+r.remaining*1000;r.run_id??=id();}break;
   case 'pause':if(r.ends_at){r.remaining=Math.max(0,Math.ceil((r.ends_at-now)/1000));r.ends_at=null;}break;
   case 'reset':case 'duration':case 'phase':{
    const phase=action==='phase'?(body.phase==='break'?'break':'focus'):action==='duration'?'focus':r.phase;
    const duration=action==='duration'?([1500,3000,5400].includes(Number(body.duration))?Number(body.duration):1500):action==='phase'?(phase==='break'?300:1500):r.duration;
    Object.assign(r,{phase,duration,remaining:duration,ends_at:null,run_id:null});break;
   }
   case 'task':{const title=text(body.title,100);if(!title)throw new RoomError('写下一个小目标吧');if(s.tasks.length>=100)throw new RoomError('本房间最多保存 100 个任务');s.tasks.push({id:id(),owner:member.slot,title,done:0,created_at:now});break;}
   case 'toggle':{const task=s.tasks.find(t=>t.id===body.id&&t.owner===member.slot);if(task)task.done=1-task.done;break;}
   case 'delete':s.tasks=s.tasks.filter(t=>!(t.id===body.id&&t.owner===member.slot));break;
   case 'message':{const content=text(body.content,280);if(!content)throw new RoomError('留言不能为空');const previous=s.messages.filter(m=>m.owner===member.slot).at(-1);if(previous&&now-previous.created_at<1000)throw new RoomError('慢慢说，稍等一秒再发',429);s.messages.push({id:id(),owner:member.slot,content,created_at:now});s.messages=s.messages.slice(-60);break;}
   case 'name':{const name=text(body.name,12);if(name)member.name=name;break;}
   default:throw new RoomError('未知操作');
  }
  try{
   await put(path,JSON.stringify(s),{access:'private',addRandomSuffix:false,allowOverwrite:true,ifMatch:stored.blob.etag,contentType:'application/json'});
   return joining?{code,token:newToken}:publicState(s,member.slot,now);
  }catch(e){
   if(!(e instanceof BlobPreconditionFailedError))throw e;
   if(retry===6)throw new RoomError('房间正在同步，请稍后再试',409);
   await new Promise(resolve=>setTimeout(resolve,40+Math.random()*120));
  }
 }
 throw new RoomError('房间暂时忙碌，请重试',409);
}

