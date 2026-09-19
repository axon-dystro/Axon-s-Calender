import { MODULE_ID } from "./constants.js";
import { normalizeCalendarConfig, validateCalendarConfig } from "./calendar-config.js";
import { getCalendarConfig, setCalendarConfig } from "./settings.js";
import { canChange, validateExtensions } from "./world-rules.js";
import { publicConfig } from "./public-config.js";
import { CalendarClock, primaryGM } from "./clock.js";

const REQUEST = "worldRulesRequest";
const GROUPS = { specialDays:["specialDays"],seasonRanges:["seasonRanges"],sun:["sun"],timer:["timer"],theme:["theme"],colors:["colors"],categories:["categories"],structure:["weekdays","week","seasons"],phases:["day","phases"] };
const equal = (a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function authorizedPatch(current,base,requested,user) {
  if (!base || !requested || typeof base!=="object" || typeof requested!=="object") throw new Error("Ungültige Regeländerung.");
  const next=structuredClone(current);
  const visibleCurrent=user.isGM?current:publicConfig(current);
  for(const [section,keys] of Object.entries(GROUPS)) {
    for(const key of keys) {
      if(equal(base[key],requested[key]))continue;
      if(!canChange(current,section,user)) throw new Error(`Keine Änderungsberechtigung: ${section}`);
      if(!equal(base[key],visibleCurrent[key])) throw new Error("Die Weltregeln wurden inzwischen geändert. Bitte neu öffnen.");
      if(key==="seasons" && !canChange(current,"specialDays",user)) {
        if(requested.seasons.length!==base.seasons.length && current.seasons.some(s=>s.specialDay.enabled)) throw new Error("Jahreszeiten mit festen Sondertagen dürfen nicht entfernt werden.");
        for(let i=0;i<requested.seasons.length;i++) if(!equal(requested.seasons[i].specialDay,base.seasons[i]?.specialDay)) throw new Error("Keine Änderungsberechtigung: Sondertage");
        next.seasons=requested.seasons.map((s,i)=>({...structuredClone(s),specialDay:structuredClone(current.seasons[i]?.specialDay??s.specialDay)}));
      } else next[key]=structuredClone(requested[key]);
    }
  }
  if(!equal(base.permissions,requested.permissions) || !equal(base.eventColors,requested.eventColors)) throw new Error("Nur GMs dürfen Freigaben und verbindliche Farbregeln ändern.");
  const normalized=normalizeCalendarConfig(next);
  const errors=[...validateCalendarConfig(normalized),...validateExtensions(normalized)];
  if(errors.length)throw new Error(errors.join(" "));
  return normalized;
}
export async function submitRules(base,next,extra={}) {
  if(!primaryGM()) throw new Error("Kein Haupt-GM verbunden. Änderungen wurden nicht übernommen.");
  authorizedPatch(getCalendarConfig(),base,next,game.user);
  if(extra.clock && !canChange(getCalendarConfig(),"timer",game.user))throw new Error("Keine Berechtigung für den Timer.");
  await game.user.setFlag(MODULE_ID,REQUEST,{ id:foundry.utils.randomID(),createdAt:Date.now(),base,next,...extra });
}
let queue=Promise.resolve();
export function processRulesRequest(user,changes,options,actorId) {
  // The authenticated Foundry document update supplies actorId; never trust a socket's claimed owner.
  if(!game.user.isGM || primaryGM()?.id!==game.user.id || actorId!==user.id)return;
  const request=changes.flags?.[MODULE_ID]?.[REQUEST];
  if(!request || !request.id)return;
  queue=queue.then(async()=>{
    if(primaryGM()?.id!==game.user.id)return;
    try {
      const current=getCalendarConfig();
      const next=authorizedPatch(current,request.base,request.next,user);
      if(request.clock) {
        if(!canChange(current,"timer",user) || !["start","stop"].includes(request.clock)) throw new Error("Timer-Zugriff verweigert.");
        await CalendarClock[request.clock]();
      } else if(!equal(next,current)) {
        CalendarClock.stop();
        await setCalendarConfig(next);
      }
      await user.setFlag(MODULE_ID,"worldRulesResult",{id:request.id,ok:true,message:"Weltregeln übernommen."});
    } catch(error) {
      await user.setFlag(MODULE_ID,"worldRulesResult",{id:request.id,ok:false,message:error.message});
      ui.notifications.warn(`Kalenderänderung von ${user.name} abgelehnt: ${error.message}`);
    }
  }).catch(error=>console.error(`${MODULE_ID} | Regelanfrage fehlgeschlagen`,error));
  return queue;
}
export function showRulesResult(user,changes) {
  const result=changes.flags?.[MODULE_ID]?.worldRulesResult;
  if(user.id===game.user.id&&result) ui.notifications[result.ok?"info":"error"](result.message);
}
