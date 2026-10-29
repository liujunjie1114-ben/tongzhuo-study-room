import Peer,{type DataConnection} from 'peerjs';
import {createRoom,updateRoom,RoomError,roomId,type StoredRoom} from '../lib/room-model';
const hostPeers=new Map<string,Promise<Peer>>(),guestLinks=new Map<string,Promise<DataConnection>>();
const hostStates=new Map<string,StoredRoom>();
const hostPrefix='tongzhuo-v1-';
const key=(code:string)=>`tongzhuo:host:${code}`;
const timeoutMessage='暂时没连上房主。请让房主保持自习室页面打开；若仍失败，请双方更换网络后重试。';
const save=(s:StoredRoom)=>{localStorage.setItem(key(s.room.code),JSON.stringify(s));hostStates.set(s.room.code,s);};
function load(code:string):StoredRoom|null{if(hostStates.has(code))return hostStates.get(code)!;try{const s=localStorage.getItem(key(code));if(s){const state=JSON.parse(s);hostStates.set(code,state);return state;}}catch{}return null;}
function options(){return {debug:0,config:{iceServers:[{urls:'stun:stun.cloudflare.com:3478'},{urls:'stun:stun.l.google.com:19302'}]}};}
function startHost(code:string):Promise<Peer>{
 if(hostPeers.has(code))return hostPeers.get(code)!;
 const promise=new Promise<Peer>((resolve,reject)=>{
  const peer=new Peer(hostPrefix+code,options());
  const timer=setTimeout(()=>{hostPeers.delete(code);peer.destroy();reject(new RoomError('房间连接超时，请检查网络后重试',503));},15000);
  peer.on('open',()=>{clearTimeout(timer);resolve(peer)});
  peer.on('disconnected',()=>{if(!peer.destroyed)peer.reconnect();});
  peer.on('error',e=>{clearTimeout(timer);if(e.type==='unavailable-id'){reject(new RoomError('此房间已在另一个标签页打开，请回到原标签页',409));}else if(!peer.open){hostPeers.delete(code);reject(new RoomError('未能连接自习网络，请更换网络后重试',503));}});
  peer.on('connection',conn=>{
   let authenticated=false;const admission=setTimeout(()=>{if(!authenticated)conn.close();},20000);
   conn.on('data',(packet:unknown)=>{
    const p=packet as any;
    if(!p||p.kind!=='request'||typeof p.requestId!=='string')return;
    try{
     if(JSON.stringify(p).length>9000)throw new RoomError('请求内容过长',413);
     if(p.code!==code||typeof p.token!=='string'||typeof p.action!=='string')throw new RoomError('请求无效');
     const s=load(code);if(!s)throw new RoomError('房间记录不存在',404);
     if(s.members[0].token===p.token)throw new RoomError('房主请使用原来的页面',403);
     const next=structuredClone(s);
     const body=p.body&&typeof p.body==='object'?p.body:{};
     const result=updateRoom(next,p.action,p.token,body,p.visible!==false);
     save(next);authenticated=true;clearTimeout(admission);
     conn.send({kind:'response',requestId:p.requestId,status:200,result});
    }catch(e){const err=e instanceof RoomError?e:new RoomError('房间暂时无法同步',503);conn.send({kind:'response',requestId:p.requestId,status:err.status,result:{error:err.message}});}
   });
   conn.on('close',()=>clearTimeout(admission));conn.on('error',()=>clearTimeout(admission));
  });
 });
 hostPeers.set(code,promise);return promise;
}
function connectHost(code:string):Promise<DataConnection>{
 if(guestLinks.has(code))return guestLinks.get(code)!;
 const promise=new Promise<DataConnection>((resolve,reject)=>{
  const peer=new Peer(options());let conn:DataConnection|undefined,settled=false;
  const fail=()=>{guestLinks.delete(code);if(!settled){settled=true;reject(new RoomError(timeoutMessage,503));}conn?.close();peer.destroy();};
  const timer=setTimeout(fail,16000);
  peer.on('open',()=>{
   conn=peer.connect(hostPrefix+code,{reliable:true,serialization:'json'});
   conn.on('open',()=>{if(settled)return;settled=true;clearTimeout(timer);resolve(conn!)});
   conn.on('close',()=>{guestLinks.delete(code);peer.destroy();});conn.on('error',()=>{clearTimeout(timer);fail();});
  });
  peer.on('error',()=>{clearTimeout(timer);fail();});
  peer.on('disconnected',()=>{if(!peer.destroyed)peer.reconnect();});
 });
 guestLinks.set(code,promise);return promise;
}
async function requestHost(code:string,action:string,token:string,body:Record<string,unknown>,visible:boolean){
 const conn=await connectHost(code);
 return await new Promise<Response>((resolve,reject)=>{
  const requestId=roomId();const timer=setTimeout(()=>{conn.off('data',onData);reject(new RoomError(timeoutMessage,503));},12000);
  function onData(packet:unknown){const p=packet as any;if(p?.kind==='response'&&p.requestId===requestId){clearTimeout(timer);conn.off('data',onData);resolve(Response.json(p.result,{status:p.status}));}}
  conn.on('data',onData);conn.send({kind:'request',requestId,code,action,token,body,visible});
 });
}
export function installPeerRoomApi(){
 (window as any).__TONGZHUO_PEER__=true;
 const originalFetch=window.fetch.bind(window);
 window.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(input instanceof Request?input.url:input.toString(),location.href);
  if(url.origin!==location.origin||url.pathname!=='/api/room')return originalFetch(input,init);
  try{
   const body=init?.body?JSON.parse(String(init.body)):{};
   const action=init?.method==='POST'?body.action:'sync';
   const code=String(body.code||url.searchParams.get('code')||'');
   const headers=new Headers(init?.headers);
   const token=(headers.get('Authorization')||'').replace(/^Bearer /,'');
   const visible=url.searchParams.get('visible')!=='0';
   if(action==='create'){
    const created=createRoom(body.name);save(created.state);
    try{await startHost(created.code);}catch(e){hostStates.delete(created.code);localStorage.removeItem(key(created.code));throw e;}
    return Response.json({code:created.code,token:created.token});
   }
   if(!/^[a-f0-9]{32}$/.test(code))throw new RoomError('没有找到这个房间，请检查邀请链接',404);
   const s=load(code);
   if(s?.members[0].token===token){await startHost(code);const next=structuredClone(s);const result=updateRoom(next,action,token,body,visible);save(next);return Response.json(result);}
   const response=await requestHost(code,action,token,body,visible);
   if(response.ok){const result=await response.clone().json();if((result as any).members)localStorage.setItem(`tongzhuo:guest:${code}`,JSON.stringify(result));}
   return response;
  }catch(e){const err=e instanceof RoomError?e:new RoomError('房间连接失败，请重试',503);return Response.json({error:err.message},{status:err.status});}
 };
}
