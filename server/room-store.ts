import {get,put,BlobPreconditionFailedError} from '@vercel/blob';
import {createRoom,updateRoom,RoomError,type StoredRoom} from '../lib/room-model.ts';
export {RoomError};
export async function roomAction(action:string,codeInput:unknown,token:string,body:Record<string,unknown>={},visible=true){
 if(action==='create'){
  const {state,code,token:newToken}=createRoom(body.name);
  await put(`rooms/${code}.json`,JSON.stringify(state),{access:'private',addRandomSuffix:false,contentType:'application/json',allowOverwrite:false});
  return {code,token:newToken};
 }
 const code=typeof codeInput==='string'?codeInput.trim():'';
 if(!/^[a-f0-9]{32}$/.test(code))throw new RoomError('没有找到这个房间，请检查邀请链接',404);
 const path=`rooms/${code}.json`;
 for(let retry=0;retry<7;retry++){
  const stored=await get(path,{access:'private',useCache:false});
  if(!stored?.stream)throw new RoomError('没有找到这个房间，请检查邀请链接',404);
  const s=await new Response(stored.stream).json() as StoredRoom;
  const response=updateRoom(s,action,token,body,visible);
  try{
   await put(path,JSON.stringify(s),{access:'private',addRandomSuffix:false,allowOverwrite:true,ifMatch:stored.blob.etag,contentType:'application/json'});
   return response;
  }catch(e){
   if(!(e instanceof BlobPreconditionFailedError))throw e;
   if(retry===6)throw new RoomError('房间正在同步，请稍后再试',409);
   await new Promise(resolve=>setTimeout(resolve,40+Math.random()*120));
  }
 }
 throw new RoomError('房间暂时忙碌，请重试',409);
}

