// Node 20+, no external build dependencies. Prepare a Sites Worker in the chosen checkout.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2);
function required(flag){
  const i=args.indexOf(flag);
  if(i<0||!args[i+1]||args[i+1].startsWith('--'))throw Error('Missing '+flag);
  return path.resolve(args[i+1]);
}
const checkout=required('--checkout'), assetsRoot=required('--assets'), here=path.dirname(fileURLToPath(import.meta.url));
const manifest=await fs.readFile(path.join(checkout,'.openai','hosting.json'),'utf8');
const parsed=JSON.parse(manifest.replace(/^\uFEFF/,''));
if(!parsed.project_id||parsed.static)throw Error('A registered Worker .openai/hosting.json with project_id and no static field is required');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const entries=new Set(['index.html','zhong.html','ai-worker-v4.js']), assets=Object.create(null);
for(const name of entries){
  const body=await fs.readFile(path.join(assetsRoot,name),'utf8');
  assets[name]={type:mime[path.extname(name)],body};
  if(name.endsWith('.html'))for(const match of body.matchAll(/(?:href|src)=["'](?:\.\/)?([a-zA-Z0-9_-]+\.(?:svg|js|css))(?:\?[^"']*)?["']/g))entries.add(match[1]);
}
if(!assets['ai-v3.js'])throw Error('The public application must include ai-v3.js');
const worker=await fs.readFile(path.join(here,'worker.mjs'),'utf8');
const moduleSource=worker+'\nconst embedded='+JSON.stringify(assets)+';\nconst ui=(()=>{const module={exports:{}};\n'+assets['ai-v3.js'].body+'\nreturn module.exports;})();\nexport default createWorker(embedded,ui);\n';
await fs.mkdir(path.join(checkout,'dist/server'),{recursive:true});
await fs.mkdir(path.join(checkout,'dist/.openai'),{recursive:true});
await fs.writeFile(path.join(checkout,'dist/server/index.js'),moduleSource);
await fs.writeFile(path.join(checkout,'dist/.openai/hosting.json'),manifest);
console.log('Built hosted Worker with '+entries.size+' public assets.');
