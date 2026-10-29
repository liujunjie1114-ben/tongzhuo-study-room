# 同桌 · 两个人的自习室

隔着距离，也能并肩。为两位异地学习搭子制作的沉浸式网页 App。

**在线使用：** https://tongzhuo-study-room.shuizhuzaocha.chatgpt.site

## 怎么使用

1. 打开网站，创建双人房间，填写昵称。
2. 复制房间邀请链接，发给另一位学习搭子。
3. 对方填写昵称入座，就可以一起专注、查看任务、互相留言。
4. 手机浏览器菜单选择「添加到主屏幕」，可以像 App 一样打开。

房间最多两人，链接中的随机房间码用于邀请。座位身份保存在当前浏览器，刷新或关闭页面后可恢复；清除浏览器数据、无痕模式结束或更换设备后，不能自动找回原座位。请只向自己的搭子分享邀请链接。

## 功能

- 两人房间、在线/离开页面/离线状态，每 4 秒同步
- 25/50/90 分钟共同番茄钟，5 分钟休息，可由双方开始和暂停
- 各自管理学习任务，查看搭子的计划与完成状态
- 鼓励留言、快捷便利贴
- 日落图书馆、窗边听雨、午夜书房三种视觉氛围
- 本地合成的雨声与棕噪音，可调音量
- 沉浸模式、移动端布局、主屏幕图标
- 完整专注结束自动记录，学习足迹保留最近 100 轮

这里没有摄像头或屏幕监控；「专注中」表示页面在线且共享计时正在运行，不代表验证了真实学习行为。

## 技术

React 19、TypeScript、Vinext / Vite、Cloudflare Workers、D1 / SQLite、Drizzle。

**GitHub 存放开源代码；线上网站另外运行在支持 Worker 和数据库的托管服务。** GitHub Pages 只能托管静态页面，不能单独运行此项目的房间同步后端。

## 本地运行（Windows PowerShell）

需要 Node.js 22.13+，推荐 Node.js 24。

```powershell
git clone https://github.com/liujunjie1114-ben/tongzhuo-study-room.git
cd tongzhuo-study-room
npm install
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_bent_butterfly.sql
npm run dev
```

打开终端显示的 Local 地址。两位访客需要不同浏览器配置或无痕窗口来模拟两个身份。`127.0.0.1` 只能在自己的电脑上使用，异地访问请部署公网服务。

## 自行部署到 Cloudflare

线上数据和本地测试数据库彼此独立。使用你自己的 Cloudflare 账号和数据库，不需要使用演示站的身份或数据。

```powershell
npx wrangler login
npx wrangler d1 create tongzhuo-db
```

从创建结果复制 database_id，然后执行：

```powershell
$env:TONGZHUO_D1_ID = '这里填写你的 database_id'
npm run build
node scripts/configure-cloudflare.mjs
npx wrangler d1 migrations apply DB --remote --config dist/server/wrangler.json
npx wrangler deploy --config dist/server/wrangler.json
```

最后一条命令会返回你的公网网址。每次重新构建后，应再次运行 `configure-cloudflare.mjs`，因为构建会重新生成部署配置。此配置脚本只修改生成的 `dist/`，不会上传账号凭证。可以通过 `TONGZHUO_WORKER_NAME` 和 `TONGZHUO_D1_NAME` 自定义服务和数据库名称。

## 关键文件

| 文件 | 用途 |
| --- | --- |
| `app/page.tsx` | 自习室界面、计时展示、客户端同步、声音与弹窗 |
| `app/globals.css` | 桌面/手机布局、沉浸模式、三种场景样式 |
| `app/api/room/route.ts` | 创建/加入房间、座位鉴权、计时、任务、留言 API |
| `db/schema.ts` | 五张数据表及座位唯一约束 |
| `drizzle/` | 数据库迁移 |
| `public/` | 场景图片、图标、Web App Manifest |
| `scripts/configure-cloudflare.mjs` | 自部署时生成 Cloudflare 配置 |

API 在服务端检查座位身份；一个房间最多两个固定座位，任务只能由主人修改。计时以服务端结束时间为准；完成记录用唯一运行 ID 去重。前端页面未打开时计时仍会继续，下次同步会补记已完成的轮次。

## 验证

已完成 TypeScript 检查和生产构建，并使用桌面与手机浏览器独立身份验证：创建/加入房间、第三人拦截、任务归属、跨端任务/留言/计时同步、无横向溢出。还验证了完成专注时并发请求不会重复记录。

## 许可与素材

原创应用代码采用 MIT 许可证。依赖和保留的第三方构建脚本遵循各自许可证。背景照片来自 Unsplash（图片资源：https://images.unsplash.com/photo-1507842217343-583bb7270b66），不纳入原创代码 MIT 授权范围。
