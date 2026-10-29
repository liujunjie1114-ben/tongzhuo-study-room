import {readFileSync, writeFileSync} from 'node:fs';
const databaseId=process.env.TONGZHUO_D1_ID;
if(!databaseId || !/^[a-f0-9-]{36}$/i.test(databaseId))throw new Error('请设置 TONGZHUO_D1_ID 为创建 D1 返回的 database_id');
const file='dist/server/wrangler.json';
const config=JSON.parse(readFileSync(file,'utf8'));
config.name=process.env.TONGZHUO_WORKER_NAME||'tongzhuo-study-room';
config.d1_databases=[{binding:'DB',database_name:process.env.TONGZHUO_D1_NAME||'tongzhuo-db',database_id:databaseId,migrations_dir:'../../drizzle'}];
writeFileSync(file,JSON.stringify(config,null,2)+'\n');
console.log('已配置你的 Cloudflare 服务。现在可应用数据库迁移并部署。');
