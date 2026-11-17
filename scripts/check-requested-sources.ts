import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { connectors } from '../server/connectors.js';

const newspapers = [
 ['DER SPIEGEL','https://www.spiegel.de/schlagzeilen/index.rss'],
 ['Kölner Stadt-Anzeiger – Köln','https://feed.ksta.de/feed/rss/koeln/index.rss'],
 ['Kölnische Rundschau – Köln','https://feed.rundschau-online.de/feed/rss/koeln/index.rss'],
 ['EXPRESS – Köln','https://www.express.de/koeln/feed'],
 ['Rheinische Post – NRW','https://rp-online.de/nrw/feed.rss'],
 ['WAZ','https://www.waz.de/rss'],
 ['NRZ','https://www.nrz.de/rss'],
 ['Westfalenpost','https://www.wp.de/rss'],
 ['Westfälische Rundschau','https://www.wr.de/rss'],
 ['Neue Westfälische','https://www.nw.de/_export/site_rss/nw/index.rss'],
 ['Westfälische Nachrichten','https://www.wn.de/rss/feed'],
 ['Ruhr Nachrichten','https://www.ruhrnachrichten.de/feed/'],
 ['Westdeutsche Zeitung – NRW','https://www.wz.de/nrw/feed.rss'],
 ['General-Anzeiger Bonn','https://ga.de/feed.rss'],
 ['Westfälischer Anzeiger','https://www.wa.de/rssfeed.rdf'],
];
const instagram = [
 ['Internationale Jugend Düsseldorf','internationale_jugend_dus'],
 ['Internationale Jugend Essen','internationalejugend_essen'],
 ['Internationale Jugend Gelsenkirchen','internationalejugend_ge'],
 ['Internationale Jugend Köln','internationale_jugend_koeln'],
 ['Internationale Jugend Wuppertal','internationalejugend.wuppertal'],
 ['Solidaritätsnetzwerk Dortmund','solinetzdortmund'],
 ['Solidaritätsnetzwerk Essen','solinetzessen'],
 ['Solidaritätsnetzwerk Köln','solinetzkoeln'],
 ['Solidaritätsnetzwerk Wuppertal','solinetzwuppertal'],
 ['Frauenkollektiv Wuppertal','frauenkollektiv_wuppertal'],
 ['Frauenkollektiv Köln','frauenkollektiv_koeln'],
];
const candidates = [
 ...newspapers.map(([name,url])=>({name,url,type:'rss'})),
 ...instagram.map(([name,handle])=>({name,url:`https://www.instagram.com/${handle}/`,type:'instagram'})),
];
const results:any[]=[];
// Small batches keep the checks gentle on providers and the configured Meta access.
for(let i=0;i<candidates.length;i+=3) {
 await Promise.all(candidates.slice(i,i+3).map(async source=>{
  try { const items=await connectors[source.type].fetch(source); const result={...source,ok:true,count:items.length}; results.push(result); console.log(JSON.stringify(result)); }
  catch(e) { const result={...source,ok:false,error:(e as Error).message};results.push(result);console.log(JSON.stringify(result)); }
 }));
}
await writeFile('data/requested-sources-check.json',JSON.stringify(results,null,2));
