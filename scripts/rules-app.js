import { MODULE_ID } from "./constants.js";
import { getCalendarConfig, setCalendarConfig } from "./settings.js";
import { RULE_SECTIONS, ACCESS_MODES, canChange, canView, validateExtensions } from "./world-rules.js";
import { THEME_PRESETS } from "./theme.js";
import { submitRules } from "./rules-permissions.js";
import { CalendarClock, primaryGM } from "./clock.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const field = (key,label,type="text",extra={}) => ({ key,label,type,...extra });
const select = (key,label,options) => field(key,label,"select",{options});
const choice = object => Object.entries(object).map(([value,label])=>({value,label}));
const accessFields = Object.entries(RULE_SECTIONS).map(([key,label])=>select(key,label,choice(ACCESS_MODES)));
export function ruleSchema(config) {
  const monthChoices = config.seasons.flatMap((s,si)=>s.months.map((m,mi)=>({value:`${si+1}:${mi+1}`,label:`${s.name} · ${m.name}`})));
  return [
    { key:"specialDays", title:"Sondertage", array:true, hint:"Position: 0 = vor dem ersten Tag, sonst nach dem gewählten regulären Tag. Mehrere Sondertage an derselben Position folgen der Listenreihenfolge. Ein Monatsende oder eine Wochengrenze ist ebenfalls eine mögliche Position.",
      fields:[field("name","Name"),select("anchor","Monat",monthChoices),field("afterDay","Nach Tag (0 = davor)","number",{min:0,max:999}),field("color","Farbe","color"),field("description","Beschreibung"),field("outsideYear","Zwischen den Jahren","checkbox")] },
    { key:"seasonRanges", title:"Freie Jahreszeiten", array:true, hint:"Unabhängig von den Monatsgruppen im bisherigen Designer. Positionen zählen alle Kalendertage inklusive Sondertagen, beginnend bei 1. Ende vor Beginn bedeutet einen Zeitraum über den Jahreswechsel. Überlappungen sind erlaubt; bei mehreren passenden Sonnenregeln gilt innerhalb derselben Regelart die letzte.",
      fields:[field("name","Name"),field("startDay","Erster Jahrestag","number",{min:1}),field("endDay","Letzter Jahrestag","number",{min:1}),field("color","Farbe","color")] },
    { key:"sun", title:"Sonnenzyklus", hint:"Täglich verwendet die vorhandenen Tagesphasen. Tagesregeln überschreiben diese nach Jahreszeit, Monat, Wochentag oder genauem Datum (in dieser Priorität). Ein fortlaufender Zyklus läuft unabhängig von Mitternacht und Jahreswechsel weiter; Start ist Jahr 1, erster Kalendertag, 00:00. Regeln mit gleichem Auf- und Untergang bedeuten dauerhafte Nacht.",
      fields:[select("mode","Modell",choice({daily:"Täglich: vorhandene Tagesphasen",rules:"Täglich mit Ausnahmen",cycle:"Fortlaufender mehrtägiger Zyklus"})),field("cycleDays","Zykluslänge in Tagen","number",{min:1,max:10000}),field("offsetMinutes","Versatz zum Zyklusstart (Minuten)","number")] },
    { key:"sun.phases", permission:"sun", title:"Individuelle Sonnenphasen", array:true, hint:"Beginn in Ingame-Minuten ab Zyklusstart. Bei 24 × 60 Minuten: Montag 06:00 = 360; Donnerstag 18:00 = 5400. Jede Phase hält bis zur nächsten an, auch über mehrere Tage. Dunkelheit: 0 = hell, 1 = dunkel.",
      fields:[field("name","Name"),field("startMinute","Beginn im Zyklus (Minuten)","number",{min:0}),field("icon","Symbol"),field("color","Farbe","color"),field("darkness","Dunkelheit","number",{min:0,max:1,step:0.05})] },
    { key:"sun.rules", permission:"sun", title:"Sonnenzeiten nach Datum", array:true, hint:"Auf- und Untergang in Minuten seit Mitternacht (06:00 = 360 bei 60 Minuten/Stunde). Ein genaues Datum wählst du über die Datumskennung unterhalb des ausgewählten Tages im Kalender.",
      fields:[select("kind","Gilt für",choice({weekday:"Wochentag",month:"Monat",season:"Jahreszeit",date:"Genaues Datum"})),field("match","Ziel","ruleTarget"),field("sunrise","Sonnenaufgang (Minuten)","number",{min:0}),field("sunset","Sonnenuntergang (Minuten)","number",{min:0}),field("color","Tagesfarbe","color")] },
    { key:"timer", title:"Tages-Timer", hint:"Geschwindigkeit in Ingame-Minuten pro echter Sekunde. Start setzt die Uhr auf den Beginn. Ende ≤ Beginn liegt am Folgetag. Ohne Stopp läuft die Zeit fortlaufend. Der Timer läuft nur solange der Haupt-GM verbunden ist und stoppt bei einem Neuladen; Offline-Zeit wird nicht nachgeholt.",
      fields:[field("rate","Ingame-Minuten pro Sekunde","number",{min:0.01,max:10000,step:0.01}),field("startMinute","Beginn (Minuten seit Mitternacht)","number",{min:0}),field("endMinute","Ende (Minuten seit Mitternacht)","number",{min:0}),field("stopAtEnd","Am Endzeitpunkt stoppen","checkbox"),field("pauseWithGame","Bei Spielpause pausieren","checkbox")] },
    { key:"theme", title:"Theme", fields:[...Object.keys(THEME_PRESETS.crystal).filter(k=>k!=="name").map(key=>field(key,({primary:"Primärfarbe",secondary:"Sekundärfarbe",background:"Hintergrund",surface:"Flächen",text:"Text",border:"Rahmen"})[key],"color"))] },
    { key:"colors", title:"Kalenderfarben", fields:[field("day","Tage","color"),field("week","Wochenüberschriften","color"),field("special","Standardfarbe Sondertage","color")] },
    { key:"colors.weekdays", permission:"colors", title:"Einzelne Wochentage", array:true, fixedRows:true, hint:"Eine eigene Farbe für jeden Wochentag.",fields:[field("color","Farbe","color")] },
    { key:"categories", title:"Ereigniskategorien", array:true, hint:"Eine gesperrte Kategoriefarbe gilt verbindlich, auch bei freier Farbwahl. Die globale feste Farbe hat Vorrang. Kennungen bestehender Kategorien bleiben erhalten.", fields:[field("name","Name"),field("color","Farbe","color"),field("locked","Kategoriefarbe verbindlich","checkbox")] },
    { key:"eventColors", title:"Eintragsfarben", hint:"Bei freier Farbwahl können Spieler nur dann Farben ändern, wenn sie hier das Änderungsrecht erhalten. Andernfalls bleibt bei Einträgen die Kategoriefarbe maßgeblich.",fields:[select("mode","Farbregel",choice({free:"Freie Farbwahl",palette:"Nur Palette",category:"Kategorie bestimmt Farbe",fixed:"Alle Einträge feste Farbe"})),field("fixed","Feste Farbe","color"),field("palette","Palette (Hexfarben, Komma getrennt)")] },
    { key:"permissions", title:"Spielerberechtigungen", gmOnly:true, hint:"GM-Vorgaben und Nur ansehen sind schreibgeschützt. Verborgene Bereiche erscheinen nicht im Spieler-Designer. Verborgene Namen und Sonnenregeln bleiben im geschützten GM-Journal. Anonyme Kalenderlängen sowie sichtbare Farben bleiben für die Darstellung auf Spielergeräten notwendig. Geheime Ereignisse gehören in die geschützte GM-Planung. Freigegebene Weltregeln gelten für alle und werden vom verbundenen Haupt-GM geprüft und übernommen.",fields:accessFields }
  ];
}
function get(obj,path) { return path.split('.').reduce((v,k)=>v?.[k],obj); }
function set(obj,path,value) { const parts=path.split('.'); const key=parts.pop(); let target=obj; for(const part of parts) target=target[part]; target[key]=value; }
function targetOptions(row,config) {
  if(row.kind==="weekday") return config.weekdays.map((name,i)=>({value:String(i+1),label:name}));
  if(row.kind==="month") return config.seasons.flatMap(s=>s.months.map(m=>({value:m.id,label:`${s.name} · ${m.name}`})));
  if(row.kind==="season") return (config.seasonRanges.length?config.seasonRanges:config.seasons).map(s=>({value:s.id,label:s.name}));
  return null;
}
export class WorldRulesApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = { id:`${MODULE_ID}-world-rules`,classes:[MODULE_ID,"axon-calendar-config"],tag:"section",
    window:{title:"Weltregeln · Kalender, Sonne & Rechte",resizable:true},position:{width:980,height:850} };
  static PARTS = { main:{template:`modules/${MODULE_ID}/templates/world-rules.hbs`} };
  constructor(options={}) { super(options); this.draft=getCalendarConfig(); this.base=structuredClone(this.draft); }
  async _prepareContext() {
    const config=this.draft;
    return { isGM:game.user.isGM, canTimer:canChange(config,"timer",game.user), running:CalendarClock.running,
      themes:Object.entries(THEME_PRESETS).map(([id,t])=>({id,name:t.name})),canTheme:canChange(config,"theme",game.user),
      sections:ruleSchema(config).filter(s=>s.gmOnly?game.user.isGM:canView(config,s.permission??s.key,game.user)).map(section=>{
        const disabled=!game.user.isGM && (section.key==="eventColors" || !canChange(config,section.permission??section.key,game.user));
        let values=section.array?get(config,section.key):[get(config,section.key)];
        if(section.key==="colors.weekdays") values=config.weekdays.map((name,i)=>({name,color:config.colors.weekdays[i]??config.colors.day}));
        return {...section,disabled,canAdd:section.array&&!disabled&&!section.fixedRows,rows:values.map((raw,index)=>{
          const row={...raw};
          if(section.key==="specialDays") row.anchor=`${row.season}:${row.month}`;
          if(section.key==="eventColors") row.palette=row.palette.join(", ");
          return {index,name:row.name,canRemove:section.array&&!disabled&&!section.fixedRows,fields:section.fields.map(f=>{
            const options=f.type==="ruleTarget"?targetOptions(row,config):f.options;
            const value=row[f.key]??"";
            return {...f,name:`${section.key}/${index}/${f.key}`,value,disabled,checkbox:f.type==="checkbox",isSelect:!!options,
              type:f.type==="ruleTarget"?"text":f.type,options:options?.map(o=>({...o,selected:String(o.value)===String(value)}))};
          })};
        })};
      })};
  }
  _onRender(context,options) {
    super._onRender(context,options);
    const root=this.element;
    root.querySelector("form").addEventListener("submit",e=>{e.preventDefault();this.save().catch(error=>ui.notifications.error(error.message));});
    root.querySelectorAll("[data-add]").forEach(b=>b.addEventListener("click",()=>{
      this.capture(); const key=b.dataset.add; const list=get(this.draft,key); const unique=foundry.utils.randomID();
      const defaults={id:`custom-${unique}`,name:"Neuer Eintrag",color:"#a765ff",season:1,month:1,afterDay:0,startDay:1,endDay:30,
        slot:Math.max(0,...this.draft.specialDays.map(s=>s.slot))+1,kind:"weekday",match:"1",sunrise:360,sunset:1080,startMinute:0,icon:"☀️",darkness:0,locked:false};
      list.push(defaults);this.render({force:true});
    }));
    root.querySelectorAll("[data-remove]").forEach(b=>b.addEventListener("click",()=>{
      this.capture(); const list=get(this.draft,b.dataset.remove);
      if(b.dataset.remove==="categories"&&list.length===1) return ui.notifications.warn("Mindestens eine Kategorie muss bleiben.");
      list.splice(Number(b.dataset.index),1);this.render({force:true});
    }));
    root.querySelectorAll("[name$='/kind']").forEach(input=>input.addEventListener("change",()=>{this.capture();this.render({force:true});}));
    root.querySelectorAll("[data-theme]").forEach(b=>b.addEventListener("click",()=>{this.capture();this.draft.theme={...THEME_PRESETS[b.dataset.theme]};this.render({force:true});}));
    root.querySelector("[data-clock-start]")?.addEventListener("click",()=>this.clock("start"));
    root.querySelector("[data-clock-stop]")?.addEventListener("click",()=>this.clock("stop"));
  }
  capture() {
    const data=new FormData(this.element.querySelector("form"));
    for(const section of ruleSchema(this.draft)) {
      if(section.gmOnly&&!game.user.isGM) continue;
      if(!game.user.isGM&&(section.key==="eventColors" || !canChange(this.base,section.permission??section.key,game.user))) continue;
      let values=section.array?get(this.draft,section.key):[get(this.draft,section.key)];
      if(section.key==="colors.weekdays") values=this.draft.weekdays.map((_,i)=>({color:this.draft.colors.weekdays[i]??this.draft.colors.day}));
      values.forEach((row,i)=>section.fields.forEach(f=>{
        const key=`${section.key}/${i}/${f.key}`;
        if(!data.has(key)&&f.type!=="checkbox")return;
        row[f.key]=f.type==="checkbox"?data.has(key):f.type==="number"?Number(data.get(key)):String(data.get(key));
      }));
      if(section.key==="specialDays") values.forEach(row=>{[row.season,row.month]=String(row.anchor).split(":").map(Number);delete row.anchor;});
      if(section.key==="colors.weekdays") set(this.draft,section.key,values.map(r=>r.color));
      if(section.key==="eventColors"&&typeof values[0].palette==="string") values[0].palette=values[0].palette.split(",").map(c=>c.trim()).filter(Boolean);
    }
  }
  async save() {
    this.capture();
    if(game.user.isGM && JSON.stringify(this.base)!==JSON.stringify(getCalendarConfig())) throw new Error("Die Weltregeln wurden inzwischen geändert. Bitte neu öffnen.");
    const errors=validateExtensions(this.draft);
    if(errors.length) throw new Error(errors.join(" "));
    if(game.user.isGM) { CalendarClock.stop(); await setCalendarConfig(this.draft); ui.notifications.info("Weltregeln gespeichert."); }
    else { await submitRules(this.base,this.draft); ui.notifications.info("Änderungen zur Prüfung an den verbundenen Haupt-GM übergeben."); }
    await this.close();
  }
  async clock(action) {
    try {
      if(game.user.isGM && primaryGM()?.id===game.user.id) { if(action==="start") await this.save(); await CalendarClock[action](); }
      else await submitRules(this.base,this.base,{clock:action});
      this.render({force:true});
    } catch(error) { ui.notifications.error(error.message); }
  }
}
