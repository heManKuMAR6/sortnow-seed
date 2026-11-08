import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
const dir='examples/storefront';
const port=Number(process.env.PORT)||4175;
await mkdir('.demo',{recursive:true});
await build({entryPoints:[`${dir}/store.mjs`],bundle:true,format:'esm',outfile:'.demo/store.js'});
const routes={'/':[`${dir}/index.html`,'text/html'],'/store.js':['.demo/store.js','text/javascript'],'/style.css':[`${dir}/style.css`,'text/css'],'/favicon.svg':[`${dir}/favicon.svg`,'image/svg+xml'],'/favicon.ico':[`${dir}/favicon.svg`,'image/svg+xml']};
createServer(async(req,res)=>{const route=routes[req.url];if(!route){res.writeHead(404);res.end('Not found');return;}try{res.writeHead(200,{'Content-Type':route[1],'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(await readFile(route[0]));}catch{res.writeHead(500);res.end('Unable to serve demo');}}).listen(port,'127.0.0.1',()=>console.log('SEED storefront: http://127.0.0.1:'+port));
