import { env } from 'cloudflare:workers';
export const dynamic = 'force-dynamic';
const json = (v: unknown, status=200) => Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const id = () => crypto.randomUUID().replaceAll('-','');
const str = (v: unknown,max: number) => typeof v==='string' ? v.trim().slice(0,max) : '';
async function db() { if(!env.DB) throw new Error('数据库尚未就绪'); return env.DB; }
async function state(code: string,token: string,visible=true) {
 const d=await db(); const member=await d.prepare('SELECT slot FROM members WHERE room=? AND token=?').bind(code,token).first<{slot:number}>();
 if(!member) return json({error:'请先加入这个房间'},401);
 const now=Date.now();
 await d.prepare('UPDATE members SET seen=?,visible=? WHERE token=?').bind(now,visible?1:0,token).run();
 const room=await d.prepare('SELECT * FROM rooms WHERE code=?').bind(code).first<any>();
 if(room.ends_at && room.ends_at<=now) {
  const finish=d.prepare('UPDATE rooms SET ends_at=NULL,remaining=0 WHERE code=? AND run_id=? AND ends_at<=?').bind(code,room.run_id,now);
  if(room.phase==='focus' && room.run_id) await d.batch([d.prepare('INSERT OR IGNORE INTO sessions(id,room,seconds,created_at) VALUES(?,?,?,?)').bind(room.run_id,code,room.duration,room.ends_at),finish]);
  else await finish.run();
  room.ends_at=null; room.remaining=0;
 }
 const results=await d.batch([
  d.prepare('SELECT slot,name,seen,visible FROM members WHERE room=? ORDER BY slot').bind(code),
  d.prepare('SELECT * FROM tasks WHERE room=? ORDER BY created_at').bind(code),
  d.prepare('SELECT id,owner,content,created_at FROM (SELECT * FROM messages WHERE room=? ORDER BY created_at DESC LIMIT 60) ORDER BY created_at').bind(code),
  d.prepare('SELECT * FROM sessions WHERE room=? ORDER BY created_at DESC LIMIT 100').bind(code),
 ]);
 return json({room,me:member.slot,members:results[0].results,tasks:results[1].results,messages:results[2].results,sessions:results[3].results,now});
}
export async function GET(req:Request) {
 try { const u=new URL(req.url); return await state(u.searchParams.get('code')||'',req.headers.get('authorization')?.replace('Bearer ','')||'',u.searchParams.get('visible')!=='0'); }
 catch(e) { console.error(e); return json({error:'连接暂时中断，请稍后重试'},503); }
}
export async function POST(req:Request) {
 try {
 const origin=req.headers.get('origin'); if(origin && origin!==new URL(req.url).origin) return json({error:'请求来源无效'},403);
 if(Number(req.headers.get('content-length')||0)>8000) return json({error:'内容过长'},413);
 const bodyText=await req.text(); if(bodyText.length>8000) return json({error:'内容过长'},413);
 const b=JSON.parse(bodyText); const d=await db(); const now=Date.now();
 const token=req.headers.get('authorization')?.replace('Bearer ','')||''; const code=str(b.code,40);
 if(b.action==='create' || b.action==='join') {
  const name=str(b.name,12); if(!name) return json({error:'请填写你的昵称'},400);
  const newToken=id(); let roomCode=code;
  if(b.action==='create') {
   roomCode=id(); await d.batch([
    d.prepare('INSERT INTO rooms(code,created_at) VALUES(?,?)').bind(roomCode,now),
    d.prepare('INSERT INTO members(token,room,slot,name,seen) VALUES(?,?,?,?,?)').bind(newToken,roomCode,1,name,now),
   ]);
  } else {
   if(!await d.prepare('SELECT code FROM rooms WHERE code=?').bind(code).first()) return json({error:'没有找到这个房间，请检查邀请链接'},404);
   const existing=await d.prepare('SELECT slot FROM members WHERE room=? AND token=?').bind(code,token).first();
   if(existing) return await state(code,token);
   try { const r=await d.prepare('INSERT INTO members(token,room,slot,name,seen) SELECT ?,?,2,?,? WHERE NOT EXISTS(SELECT 1 FROM members WHERE room=? AND slot=2)').bind(newToken,code,name,now,code).run(); if(!r.meta.changes) return json({error:'两张座位都有主人了，请使用原来的浏览器，或新建房间'},409); }
   catch { return json({error:'两张座位都有主人了'},409); }
  }
  return json({code:roomCode,token:newToken});
 }
 const me=await d.prepare('SELECT slot FROM members WHERE room=? AND token=?').bind(code,token).first<{slot:number}>();
 if(!me) return json({error:'身份已失效，请重新加入'},401);
 const room=await d.prepare('SELECT * FROM rooms WHERE code=?').bind(code).first<any>();
 switch(b.action) {
  case 'start': await d.prepare('UPDATE rooms SET ends_at=? + remaining*1000,run_id=COALESCE(run_id,?) WHERE code=? AND ends_at IS NULL AND remaining>0').bind(now,id(),code).run(); break;
  case 'pause': await state(code,token); await d.prepare('UPDATE rooms SET remaining=MAX(0,CAST((ends_at-?+999)/1000 AS INTEGER)),ends_at=NULL WHERE code=? AND ends_at>?').bind(now,code,now).run(); break;
  case 'reset': case 'duration': case 'phase': {
   await state(code,token);
   const phase=b.action==='phase' ? (b.phase==='break'?'break':'focus') : b.action==='duration'?'focus':room.phase;
   const duration=b.action==='duration' ? ([1500,3000,5400].includes(b.duration)?b.duration:1500) : b.action==='phase' ? (phase==='break'?300:1500) : room.duration;
   await d.prepare('UPDATE rooms SET phase=?,duration=?,remaining=?,ends_at=NULL,run_id=NULL WHERE code=?').bind(phase,duration,duration,code).run(); break;
  }
  case 'task': { const title=str(b.title,100); if(!title) return json({error:'写下一个小目标吧'},400); const count=await d.prepare('SELECT COUNT(*) AS n FROM tasks WHERE room=?').bind(code).first<{n:number}>(); if((count?.n||0)>=100) return json({error:'本房间最多保存 100 个任务'},400); await d.prepare('INSERT INTO tasks(id,room,owner,title,created_at) VALUES(?,?,?,?,?)').bind(id(),code,me.slot,title,now).run(); break; }
  case 'toggle': await d.prepare('UPDATE tasks SET done=1-done WHERE id=? AND room=? AND owner=?').bind(str(b.id,40),code,me.slot).run(); break;
  case 'delete': await d.prepare('DELETE FROM tasks WHERE id=? AND room=? AND owner=?').bind(str(b.id,40),code,me.slot).run(); break;
  case 'message': { const content=str(b.content,280); if(!content) return json({error:'留言不能为空'},400); const last=await d.prepare('SELECT created_at FROM messages WHERE room=? AND owner=? ORDER BY created_at DESC LIMIT 1').bind(code,me.slot).first<{created_at:number}>(); if(last && now-last.created_at<1000) return json({error:'慢慢说，稍等一秒再发'},429); await d.prepare('INSERT INTO messages(id,room,owner,content,created_at) VALUES(?,?,?,?,?)').bind(id(),code,me.slot,content,now).run(); break; }
  case 'name': { const name=str(b.name,12); if(name) await d.prepare('UPDATE members SET name=? WHERE token=?').bind(name,token).run(); break; }
  default: return json({error:'未知操作'},400);
 }
 return await state(code,token);
 } catch(e) { console.error(e); return json({error:'操作未完成，请检查网络后重试'},503); }
}

