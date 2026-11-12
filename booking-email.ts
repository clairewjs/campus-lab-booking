// EmailJS public integration identifiers. Mailbox credentials remain with EmailJS.
export async function notifyBooking(b: {lab:string;date:string;start:string;end:string;name:string;email:string;program:string;supplies:string;companions:number;id:string}) {
 const lab=b.lab==='big'?'Big Lab':'Small Lab';
 try {
  const response=await fetch('https://api.emailjs.com/api/v1.0/email/send',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),body:JSON.stringify({service_id:'service_y1au84z',template_id:'template_6rnyg5t',user_id:'yWAtpgqHril4QnMPp',template_params:{title:`${lab} | ${b.date} | ${b.start}–${b.end}`,name:b.name,email:b.email,time:new Date().toLocaleString('en-CA',{timeZone:'America/Vancouver'}),message:`Program: ${b.program}\nLab: ${lab}\nDate: ${b.date}\nTime: ${b.start}–${b.end} (Vancouver)\nAdditional students: ${b.companions}\nTotal students: ${b.companions+1}\nSupplies: ${b.supplies}\nRequest ID: ${b.id}`}})});
  return response.ok;
 } catch {return false;}
}
