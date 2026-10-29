import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
const blobs=new Map();
class Conflict extends Error{}
mock.module('@vercel/blob',{namedExports:{
 BlobPreconditionFailedError:Conflict,
 get:async path=>{const x=blobs.get(path);return x?{stream:new Response(x.body).body,blob:{etag:String(x.version)}}:null;},
 put:async(path,body,options)=>{const old=blobs.get(path);if(options.ifMatch!==undefined&&String(old?.version)!==options.ifMatch)throw new Conflict();if(old&&!options.allowOverwrite)throw new Error('Exists');blobs.set(path,{body,version:(old?.version||0)+1});return {etag:String((old?.version||0)+1)};}
}});
const {roomAction}=await import('../server/room-store.ts');
test('independent room service: concurrent joins, ownership, shared timer, idempotent completion and private responses',async()=>{
 const a=await roomAction('create','', '',{name:'晴天'});
 const joins=await Promise.allSettled([roomAction('join',a.code,'',{name:'小树'}),roomAction('join',a.code,'',{name:'第三人'})]);
 assert.equal(joins.filter(x=>x.status==='fulfilled').length,1);assert.equal(joins.find(x=>x.status==='rejected').reason.status,409);
 const b=joins.find(x=>x.status==='fulfilled').value;
 await assert.rejects(roomAction('sync',a.code,'invalid'),{status:401});
 let s=await roomAction('task',a.code,a.token,{title:'读完第一章'});assert(s.members.every(m=>!('token' in m)));
 await roomAction('toggle',a.code,b.token,{id:s.tasks[0].id});assert.equal((await roomAction('sync',a.code,a.token)).tasks[0].done,0);
 await roomAction('toggle',a.code,a.token,{id:s.tasks[0].id});assert.equal((await roomAction('sync',a.code,b.token)).tasks[0].done,1);
 await roomAction('message',a.code,b.token,{content:'一起加油 🌱'});assert.equal((await roomAction('sync',a.code,a.token)).messages[0].content,'一起加油 🌱');
 await roomAction('start',a.code,a.token);s=await roomAction('sync',a.code,b.token);assert(s.room.ends_at>Date.now());
 await roomAction('pause',a.code,b.token);assert.equal((await roomAction('sync',a.code,a.token)).room.ends_at,null);
 await roomAction('duration',a.code,a.token,{duration:3000});assert.equal((await roomAction('sync',a.code,b.token)).room.duration,3000);
 await roomAction('phase',a.code,b.token,{phase:'break'});assert.equal((await roomAction('sync',a.code,a.token)).room.remaining,300);
 await roomAction('sync',a.code,b.token,{},false);assert.equal((await roomAction('sync',a.code,a.token)).members[1].visible,0);
 await roomAction('phase',a.code,a.token,{phase:'focus'});await roomAction('start',a.code,a.token);
 mock.timers.enable({apis:['Date'],now:Date.now()+1501000});
 try{const finished=await Promise.all(Array.from({length:4},()=>roomAction('sync',a.code,a.token)));for(const r of finished){assert.equal(r.sessions.length,1);assert.equal(r.sessions[0].seconds,1500);assert.equal(r.room.remaining,0);}}finally{mock.timers.reset();}
});
