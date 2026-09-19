import { normalizeCalendarConfig, NEUTRAL_PRESET } from "./calendar-config.js";
// Keep only anonymous calendar geometry where clients need it to place shared events.
// Names, descriptions, solar rules and other hidden settings stay in an owner-only GM journal.
export function publicConfig(config) {
  const out=structuredClone(config);
  const hidden=key=>config.permissions[key]==="hidden";
  if(hidden("structure")) {
    out.name="Kalender";out.description="";out.eraLabel="";
    out.weekdays=out.weekdays.map((_,i)=>`Tag ${i+1}`);
    out.seasons=out.seasons.map((s,i)=>({...s,id:`season-${i+1}`,name:`Abschnitt ${i+1}`,color:"#a765ff",
      months:s.months.map((m,j)=>({...m,id:`month-${i+1}-${j+1}`,name:`Monat ${j+1}`,color:"#a765ff"})),
      specialDay:{...s.specialDay,id:`legacy-${i+1}`,name:"Sondertag",description:""}}));
  }
  if(hidden("specialDays")) {
    out.specialDays=out.specialDays.map(s=>({...s,id:`hidden-${s.slot}`,name:"Sondertag",description:"",color:"#a765ff",outsideYear:false}));
    out.seasons=out.seasons.map(s=>({...s,specialDay:{...s.specialDay,name:"Sondertag",description:"",outsideYear:false}}));
  }
  if(hidden("seasonRanges")) out.seasonRanges=[];
  if(hidden("sun")) out.sun={mode:"daily",rules:[],phases:[]};
  if(hidden("timer")) out.timer={};
  if(hidden("phases")) out.phases=structuredClone(NEUTRAL_PRESET.phases);
  if(hidden("categories")) out.categories=out.categories.map((c,i)=>({...c,name:`Kategorie ${i+1}`}));
  return normalizeCalendarConfig(out);
}
