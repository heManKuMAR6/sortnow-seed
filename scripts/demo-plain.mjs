// Static server for the plain HTML example: no bundler, no framework. Serves dist/seed-element.js as-is.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const dir='examples/plain-html', port=Number(process.env.PORT)||4176;
const routes={
  '/':[`${dir}/index.html`,'text/html'],'/style.css':[`${dir}/style.css`,'text/css'],'/demo-controls.js':[`${dir}/demo-controls.js`,'text/javascript'],
  '/seed-element.js':['dist/seed-element.js','text/javascript'],'/favicon.svg':[`${dir}/favicon.svg`,'image/svg+xml'],'/favicon.ico':[`${dir}/favicon.svg`,'image/svg+xml'],
  '/seed/seed.bundle.json':[`${dir}/seed/seed.bundle.json`,'application/json'],'/seed/approvals.json':[`${dir}/seed/approvals.json`,'application/json'],'/seed/brand.json':[`${dir}/seed/brand.json`,'application/json'],
};
const csp="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
createServer(async(req,res)=>{const route=routes[req.url];if(!route){res.writeHead(404);res.end('Not found');return;}try{res.writeHead(200,{'Content-Type':route[1],'X-Content-Type-Options':'nosniff','Content-Security-Policy':csp});res.end(await readFile(route[0]));}catch{res.writeHead(500);res.end('Unable to serve demo');}}).listen(port,'127.0.0.1',()=>console.log('SEED plain HTML: http://127.0.0.1:'+port));
