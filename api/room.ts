import type {IncomingMessage,ServerResponse} from 'node:http';
import {roomAction,RoomError} from '../server/room-store.js';
export default async function handler(req:IncomingMessage & {body?:unknown},res:ServerResponse){
 res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
 try{
  const token=(req.headers.authorization||'').replace(/^Bearer /,'');
  if(req.method==='GET'){
   const u=new URL(req.url||'/','http://localhost');const result=await roomAction('sync',u.searchParams.get('code'),token,{},u.searchParams.get('visible')!=='0');res.end(JSON.stringify(result));return;
  }
  if(req.method!=='POST'){res.statusCode=405;res.end(JSON.stringify({error:'不支持的请求方式'}));return;}
  if(req.headers.origin && new URL(req.headers.origin).host!==req.headers.host)throw new RoomError('请求来源无效',403);
  if(Number(req.headers['content-length']||0)>8000)throw new RoomError('内容过长',413);
  let body=req.body;
  if(body===undefined){let raw='';for await(const chunk of req){raw+=chunk.toString();if(raw.length>8000)throw new RoomError('内容过长',413);}body=JSON.parse(raw);}
  if(typeof body==='string')body=JSON.parse(body);
  if(!body||typeof body!=='object'||JSON.stringify(body).length>8000)throw new RoomError('请求内容无效');
  const b=body as Record<string,unknown>;
  const result=await roomAction(String(b.action||''),b.code,token,b);res.end(JSON.stringify(result));
 }catch(e){if(e instanceof RoomError){res.statusCode=e.status;res.end(JSON.stringify({error:e.message}));}else{console.error('Room request failed',e instanceof Error?e.name:'unknown');res.statusCode=503;res.end(JSON.stringify({error:'连接暂时中断，请稍后重试'}));}}
}
