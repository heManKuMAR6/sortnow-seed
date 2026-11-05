import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
await mkdir('.demo',{recursive:true});
await build({entryPoints:['examples/playground/app.jsx'],bundle:true,format:'esm',outfile:'.demo/app.js'});
const routes={'/favicon.svg':['examples/playground/favicon.svg','image/svg+xml'],'/favicon.ico':['examples/playground/favicon.svg','image/svg+xml'],'/':['examples/playground/index.html','text/html'],'/app.js':['.demo/app.js','text/javascript'],'/style.css':['examples/playground/style.css','text/css']};
createServer(async(req,res)=>{const route=routes[req.url];if(!route){res.writeHead(404);res.end('Not found');return;}try{res.writeHead(200,{'Content-Type':route[1],'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(await readFile(route[0]));}catch{res.writeHead(500);res.end('Unable to serve demo');}}).listen(4173,'127.0.0.1',()=>console.log('SEED playground: http://127.0.0.1:4173'));
