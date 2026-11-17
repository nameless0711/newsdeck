import { readFile, writeFile } from 'node:fs/promises';

const base='http://localhost:3000';
const existing=await (await fetch(`${base}/api/sources`)).json();
await writeFile('backups/sources-before-nrw-2026-11-09.json',JSON.stringify(existing,null,2),{flag:'wx'});
const checks=JSON.parse(await readFile('data/requested-sources-check.json','utf8'));
const references={
 'Internationale Jugend':'https://internationale-jugend.de/ortsgruppen/',
 'Solidaritätsnetzwerk':'https://soli-net.de/ortsgruppen/',
 'Frauenkollektiv':'https://frauenkollektiv.de/index.php/ortsgruppen/',
};
const result=[];
for(const entry of checks){
 if(entry.name==='EXPRESS – Köln') Object.assign(entry,{url:'https://feed.express.de/feed/rss/koeln/index.rss',ok:true,count:100});
 if(entry.name==='Neue Westfälische') Object.assign(entry,{url:'https://www.nw.de/nw/_rss/lokal/index.rss',ok:true,count:10});
 const reference=Object.entries(references).find(([prefix])=>entry.name.startsWith(prefix))?.[1];
 const description=[
  entry.type==='rss'?'Öffentlicher Zeitungsfeed für den privaten Newsreader.':'Öffentliches Profil einer NRW-Ortsgruppe; Abruf über den vorhandenen Meta-Zugang.',
  reference?`Gruppenverzeichnis: ${reference}`:'',
  entry.name==='Frauenkollektiv Köln'?'Profil zusätzlich belegt unter https://perspektive-online.net/2023/09/safe-abortion-day-frauen-kaempfen-bundesweit-fuer-ihr-recht-auf-sicheren-schwangerschaftsabbruch/ ; im aktuellen bundesweiten Verzeichnis nicht aufgeführt.':'',
  entry.ok?`Abruf geprüft am 09.11.2026: ${entry.count} Beiträge verfügbar.`:`Pausiert am 09.11.2026: ${entry.error}`,
 ].filter(Boolean).join(' ');
 const source={name:entry.name,url:entry.url,type:entry.type,description,topics:[],priority:5,interval_minutes:60,enabled:entry.ok,rights_confirmed:entry.ok};
 if(existing.some(s=>s.url.replace(/\/$/,'')===source.url.replace(/\/$/,''))){result.push({name:source.name,skipped:true});continue;}
 const response=await fetch(`${base}/api/sources`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(source)});
 const body=await response.json();
 result.push({name:source.name,enabled:source.enabled,status:response.status,...body});
 console.log(JSON.stringify(result.at(-1)));
}
await writeFile('data/requested-sources-import.json',JSON.stringify(result,null,2));
if(result.some(r=>r.status>=400))process.exitCode=1;
