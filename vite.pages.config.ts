import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({base:'/tongzhuo-study-room/',plugins:[react(),{name:'pages-entry',transformIndexHtml:{order:'pre',handler(html){return html.replace('/web/main.tsx','/web/pages.tsx')}}}],build:{outDir:'pages-dist'},server:{host:'127.0.0.1'}});
