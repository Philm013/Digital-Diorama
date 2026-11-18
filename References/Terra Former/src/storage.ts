import { STORAGE_KEY, loadProject, serializeProject, validateProject } from './studio';
import type { ProjectState, WorldDocument } from './studio';

let database: Promise<IDBDatabase> | null = null;
function openDatabase() {
  if(!database)database=new Promise<IDBDatabase>((resolve,reject)=>{
    if(!globalThis.indexedDB){reject(new Error('Browser database is unavailable.'));return;}
    const request=indexedDB.open('terra-worlds',1);
    request.onupgradeneeded=()=>{request.result.createObjectStore('worlds',{keyPath:'id'});request.result.createObjectStore('meta');};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('Close older Terra tabs to unlock saving.'));
  });
  return database;
}
type Stored = { id:string; name:string; updatedAt:string; json:string };
export async function saveWorld(name:string,state:ProjectState) {
  const json=serializeProject(name,state);
  try{
    const db=await openDatabase();
    await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['worlds','meta'],'readwrite');tx.objectStore('worlds').put({id:state.id,name,updatedAt:new Date().toISOString(),json} satisfies Stored);tx.objectStore('meta').put(state.id,'active');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
    try{const recovery=localStorage.getItem(STORAGE_KEY);if(!recovery||String(JSON.parse(recovery).updatedAt)<=String(JSON.parse(json).updatedAt))localStorage.removeItem(STORAGE_KEY);}catch{/* The IndexedDB transaction is already durable. */}
  }catch(error){
    try{localStorage.setItem(`terra-archive:${state.id}`,json);localStorage.setItem(STORAGE_KEY,json);}catch{throw new Error(error instanceof Error?`${error.message} Export a copy to save your work.`:'Storage is full. Export your world to keep it.');}
  }
}
export function emergencySave(name:string,state:ProjectState){try{localStorage.setItem(STORAGE_KEY,serializeProject(name,state));return true;}catch{return false;}}
export async function restoreWorld(fallback:WorldDocument=loadProject()):Promise<WorldDocument>{
  try{
    const db=await openDatabase();
    const stored=await new Promise<Stored|undefined>((resolve,reject)=>{const tx=db.transaction(['worlds','meta'],'readonly');const meta=tx.objectStore('meta').get('active');meta.onsuccess=()=>{if(!meta.result){resolve(undefined);return;}const request=tx.objectStore('worlds').get(meta.result);request.onsuccess=()=>resolve(request.result as Stored|undefined);request.onerror=()=>reject(request.error);};meta.onerror=()=>reject(meta.error);});
    if(stored){const doc=validateProject(JSON.parse(stored.json));if(fallback.updatedAt&&fallback.updatedAt>(doc.updatedAt||''))return fallback;return doc;}
  }catch{/* Local recovery snapshot remains usable if IndexedDB is blocked. */}
  return fallback;
}
export async function savedWorlds():Promise<Stored[]>{
  const records=new Map<string,Stored>();
  try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith('terra-archive:'))continue;const json=localStorage.getItem(key);if(!json)continue;const doc=validateProject(JSON.parse(json));records.set(doc.state.id,{id:doc.state.id,name:doc.name,updatedAt:doc.updatedAt||'',json});}}catch{/* Ignore an unavailable fallback store. */}
  try{const db=await openDatabase();const rows=await new Promise<Stored[]>((resolve,reject)=>{const r=db.transaction('worlds','readonly').objectStore('worlds').getAll();r.onsuccess=()=>resolve(r.result as Stored[]);r.onerror=()=>reject(r.error);});for(const row of rows)if(!records.has(row.id)||row.updatedAt>records.get(row.id)!.updatedAt)records.set(row.id,row);}catch{/* Saved local copies are still listed. */}
  return [...records.values()].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
}