export class RoomError extends Error {status:number;constructor(message:string,status=400){super(message);this.status=status}}
export const roomId=()=>crypto.randomUUID().replaceAll('-','');
const text=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):'';
export interface Member {slot:number;name:string;token:string;seen:number;visible:number}
export interface Task {id:string;owner:number;title:string;done:number;created_at:number}
export interface Message {id:string;owner:number;content:string;created_at:number}
export interface Session {id:string;seconds:number;created_at:number}
export interface StoredRoom {
 room:{code:string;duration:number;remaining:number;ends_at:number|null;phase:string;run_id:string|null;created_at:number};
 members:Member[];tasks:Task[];messages:Message[];sessions:Session[];
}
export function createRoom(nameInput:unknown,now=Date.now()){
 const name=text(nameInput,12);if(!name)throw new RoomError('请填写你的昵称');
 const code=roomId(),token=roomId();
 const state:StoredRoom={room:{code,duration:1500,remaining:1500,ends_at:null,phase:'focus',run_id:null,created_at:now},members:[{slot:1,name,token,seen:now,visible:1}],tasks:[],messages:[],sessions:[]};
 return {state,code,token};
}
export function updateRoom(s:StoredRoom,action:string,token:string,body:Record<string,unknown>={},visible=true,now=Date.now()){
 let member=s.members.find(m=>m.token===token),joining=false;
 if(action==='join'&&!member){
  const name=text(body.name,12);if(!name)throw new RoomError('请填写你的昵称');
  if(s.members.length>=2)throw new RoomError('两张座位都有主人了，请使用原来的浏览器，或新建房间',409);
  member={slot:2,name,token:roomId(),seen:now,visible:1};s.members.push(member);joining=true;
 }
 if(!member)throw new RoomError('请先加入这个房间',401);
 member.seen=now;member.visible=visible?1:0;
 const r=s.room;
 if(r.ends_at && r.ends_at<=now){
  if(r.phase==='focus'&&r.run_id&&!s.sessions.some(x=>x.id===r.run_id))s.sessions.unshift({id:r.run_id,seconds:r.duration,created_at:r.ends_at});
  s.sessions=s.sessions.slice(0,100);r.ends_at=null;r.remaining=0;
 }
 switch(action){
  case 'sync':case 'join':break;
  case 'start':if(!r.ends_at&&r.remaining>0){r.ends_at=now+r.remaining*1000;r.run_id??=roomId();}break;
  case 'pause':if(r.ends_at){r.remaining=Math.max(0,Math.ceil((r.ends_at-now)/1000));r.ends_at=null;}break;
  case 'reset':case 'duration':case 'phase':{
   const phase=action==='phase'?(body.phase==='break'?'break':'focus'):action==='duration'?'focus':r.phase;
   const duration=action==='duration'?([1500,3000,5400].includes(Number(body.duration))?Number(body.duration):1500):action==='phase'?(phase==='break'?300:1500):r.duration;
   Object.assign(r,{phase,duration,remaining:duration,ends_at:null,run_id:null});break;
  }
  case 'task':{const title=text(body.title,100);if(!title)throw new RoomError('写下一个小目标吧');if(s.tasks.length>=100)throw new RoomError('本房间最多保存 100 个任务');s.tasks.push({id:roomId(),owner:member.slot,title,done:0,created_at:now});break;}
  case 'toggle':{const task=s.tasks.find(t=>t.id===body.id&&t.owner===member.slot);if(task)task.done=1-task.done;break;}
  case 'delete':s.tasks=s.tasks.filter(t=>!(t.id===body.id&&t.owner===member.slot));break;
  case 'message':{const content=text(body.content,280);if(!content)throw new RoomError('留言不能为空');const previous=s.messages.filter(m=>m.owner===member.slot).at(-1);if(previous&&now-previous.created_at<1000)throw new RoomError('慢慢说，稍等一秒再发',429);s.messages.push({id:roomId(),owner:member.slot,content,created_at:now});s.messages=s.messages.slice(-60);break;}
  case 'name':{const name=text(body.name,12);if(name)member.name=name;break;}
  default:throw new RoomError('未知操作');
 }
 if(joining)return {code:r.code,token:member.token};
 return {...s,members:s.members.map(({token,...m})=>m),me:member.slot,now};
}
