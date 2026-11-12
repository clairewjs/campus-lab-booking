import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
export const dynamic='force-dynamic';
const adminEmail='claire.song@sprottshaw.com';
function db(){return (env as any).DB;}
const json=(v:any,s=200)=>Response.json(v,{status:s,headers:{'Cache-Control':'no-store'}});
const allowedOrigin='https://clairewjs.github.io';
function instructor(u:any){return !!u && [adminEmail,(env as any).ADMIN_EMAIL].filter(Boolean).some(e=>e.toLowerCase()===u.email.toLowerCase());}
function cors(response:Response,req:Request){const h=new Headers(response.headers);if(req.headers.get('origin')===allowedOrigin){h.set('Access-Control-Allow-Origin',allowedOrigin);h.set('Vary','Origin');}h.set('Cache-Control','no-store');return new Response(response.body,{status:response.status,headers:h});}
export function OPTIONS(req:Request){const r=cors(new Response(null,{status:204}),req);r.headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');r.headers.set('Access-Control-Allow-Headers','Content-Type');return r;}
export async function GET(req:Request){return cors(await readBookings(),req);}
export async function POST(req:Request){return cors(await writeBooking(req),req);}

async function readBookings(){const u=await getChatGPTUser();const admin=instructor(u);const rows=await db().prepare(admin?'SELECT * FROM bookings ORDER BY date,start':"SELECT id,lab,date,start,end,title,kind,status FROM bookings WHERE status='approved' ORDER BY date,start").all();return json({bookings:rows.results,admin,emailEnabled:true});}
async function writeBooking(req:Request){
 try{if(![new URL(req.url).origin,allowedOrigin].includes(req.headers.get('origin')||''))return json({error:'Invalid origin'},403);
 if(Number(req.headers.get('content-length')||0)>10000)return json({error:'Request too large'},413);
 const raw=await req.text();if(raw.length>10000)return json({error:'Request too large'},413);const b:any=JSON.parse(raw);if(b.website)return json({error:'Invalid request'},400);const u=await getChatGPTUser();const admin=instructor(u);
 if(b.action&&!['add','edit','approve','decline','delete'].includes(b.action))return json({error:'Unknown action'},400);
 if(b.action&&(req.headers.get('origin')!==new URL(req.url).origin||!admin))return json({error:'Instructor sign-in required. Sign in with the authorized instructor account.'},403);
 if(b.action==='delete'){await db().prepare('DELETE FROM bookings WHERE id=?').bind(b.id).run();return json({ok:true});}
 if(b.action==='decline'){await db().prepare("UPDATE bookings SET status='declined' WHERE id=? AND status='pending'").bind(b.id).run();return json({ok:true});}
 if(b.action==='approve'){const row=await db().prepare('SELECT * FROM bookings WHERE id=?').bind(b.id).first();if(!row||row.status!=='pending')return json({error:'This request is no longer pending.'},409);Object.assign(b,row);}
 if(typeof b.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||!Number.isFinite(Date.parse(b.date+'T12:00:00Z'))||new Date(b.date+'T12:00:00Z').toISOString().slice(0,10)!==b.date)return json({error:'Invalid date'},400);
 if(!['big','small'].includes(b.lab)||!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.end)||b.end<=b.start)return json({error:'Choose a lab, valid date, and an end time after the start time.'},400);
 if(!b.action && b.date<new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver'}).format(new Date()))return json({error:'Choose today or a future date.'},400);
 if(!b.action && (typeof b.name!=='string'||!b.name.trim()||b.name.length>120||typeof b.email!=='string'||b.email.length>200||!/^\S+@\S+\.\S+$/.test(b.email)||!['PN','HCA'].includes(b.program)||typeof b.supplies!=='string'||!b.supplies.trim()||b.supplies.length>2000||!Number.isInteger(Number(b.companions))||Number(b.companions)<0||Number(b.companions)>100))return json({error:'Complete all requester details, supplies, and number of additional students (0–100).'},400);
 if(!b.action){
 const ip=req.headers.get('cf-connecting-ip')||req.headers.get('x-real-ip')||'unknown';
 const bucket=Math.floor(Date.now()/3600000);const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip+':'+bucket));const key=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
 const lim=await db().prepare('INSERT INTO booking_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,Date.now()+3600000).first();
 if(lim.count>10)return json({error:'Too many requests. Please try again in an hour.'},429);
 await db().prepare('DELETE FROM booking_limits WHERE expires<?').bind(Date.now()-3600000).run();
 const recent=await db().prepare('SELECT COUNT(*) AS n FROM bookings WHERE lower(email)=lower(?) AND created>?').bind(b.email,new Date(Date.now()-3600000).toISOString()).first();if(recent.n>=4)return json({error:'You have already sent several requests. Please wait before sending more.'},429);
 }
 const conflict=await db().prepare("SELECT id FROM bookings WHERE status='approved' AND lab=? AND date=? AND start<? AND end>? AND id!=?").bind(b.lab,b.date,b.end,b.start,b.id||'').first();if(conflict)return json({error:'This time overlaps an existing class or booking. Choose another slot.'},409);
 if(b.action==='approve'){const r=await db().prepare("UPDATE bookings SET status='approved' WHERE id=? AND status='pending' AND NOT EXISTS (SELECT 1 FROM bookings x WHERE x.status='approved' AND x.lab=? AND x.date=? AND x.start<? AND x.end>? AND x.id!=?)").bind(b.id,b.lab,b.date,b.end,b.start,b.id).run();if(!r.meta.changes)return json({error:'A conflicting booking was just approved. Refresh the calendar.'},409);return json({ok:true});}
 const id=b.action==='edit'?b.id:crypto.randomUUID();const status=admin&&b.action?'approved':'pending';const title=admin&&b.action?String(b.title||'Class').slice(0,120):'Open lab practice';
 const vals=[b.lab,b.date,b.start,b.end,title,admin&&b.action?(b.kind==='practice'?'practice':'class'):'practice',status,String(b.name||'Instructor').slice(0,120),String(b.email||adminEmail).slice(0,200),b.program||'PN',String(b.supplies||'').slice(0,2000),Number(b.companions||0)];
 if(b.action==='edit'){const r=await db().prepare("UPDATE bookings SET lab=?,date=?,start=?,end=?,title=?,kind=?,status=?,name=?,email=?,program=?,supplies=?,companions=? WHERE id=? AND NOT EXISTS (SELECT 1 FROM bookings x WHERE x.status='approved' AND x.lab=? AND x.date=? AND x.start<? AND x.end>? AND x.id!=?)").bind(...vals,id,b.lab,b.date,b.end,b.start,id).run();if(!r.meta.changes)return json({error:'Entry changed or slot unavailable. Refresh and try again.'},409);}
 else {const r=await db().prepare("INSERT INTO bookings (id,lab,date,start,end,title,kind,status,name,email,program,supplies,companions,created) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM bookings WHERE status='approved' AND lab=? AND date=? AND start<? AND end>?)").bind(id,...vals,new Date().toISOString(),b.lab,b.date,b.end,b.start).run();if(!r.meta.changes)return json({error:'A booking just filled this slot. Please choose another time.'},409);}
 let emailSent=false;
 if(!b.action){try{
 const response=await fetch('https://formsubmit.co/ajax/'+adminEmail,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','Referer':'https://clairewjs.github.io/campus-lab-booking/'},signal:AbortSignal.timeout(12000),body:JSON.stringify({_subject:'LabSpace booking request: '+b.date,_captcha:'false',_template:'table',_url:'https://clairewjs.github.io/campus-lab-booking/',name:b.name,email:b.email,program:b.program,lab:b.lab==='big'?'Big Lab':'Small Lab',date:b.date,start:b.start,end:b.end,additional_students:b.companions,total_students:Number(b.companions)+1,supplies:b.supplies,request_id:id,review:'https://campus-lab-booking.clairewjs.chatgpt.site/?view=instructor'})});
 const result:any=await response.json();emailSent=response.ok&&(result.success===true||result.success==='true');
 }catch{}}
 return json({ok:true,id,emailSent});
 }catch{return json({error:'Unable to save this change. Please try again.'},500);}
}
