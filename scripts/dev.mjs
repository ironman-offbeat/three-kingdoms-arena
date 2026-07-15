import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {extname,join,normalize} from 'node:path';
const root=new URL('../',import.meta.url).pathname;
const port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{try{let path=decodeURIComponent(new URL(req.url,`http://${req.headers.host}`).pathname);if(path==='/')path='/index.html';const file=normalize(join(root,path));if(!file.startsWith(normalize(root)))throw new Error('invalid path');if(!(await stat(file)).isFile())throw new Error('not file');res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(await readFile(file));}catch{res.writeHead(404);res.end('Not found');}}).listen(port,()=>console.log(`http://localhost:${port}`));
