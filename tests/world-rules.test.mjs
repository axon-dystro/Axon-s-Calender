import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCalendarConfig, NEUTRAL_PRESET } from "../scripts/calendar-config.js";
import { dateToOrdinal, ordinalToDate, advanceDay, retreatDay, weekdayIndex, solarPhase, seasonsOn, dateKey, parseDateKey, absoluteMinute, stateFromAbsoluteMinute } from "../scripts/calendar-engine.js";
import { eventColor, validateExtensions } from "../scripts/world-rules.js";
import { publicConfig } from "../scripts/public-config.js";
import { authorizedPatch } from "../scripts/rules-permissions.js";
import { timerStep } from "../scripts/clock.js";
const base=()=>normalizeCalendarConfig(NEUTRAL_PRESET);
const regular=(day,year=1)=>({year,season:1,month:1,day,specialDay:null});

test("multiple independent special days round-trip across negative years, month edges and week resets",()=>{
  const config=normalizeCalendarConfig({...base(),specialDays:[
    {slot:7,name:"Before",season:1,month:1,afterDay:0},
    {slot:2,name:"Mid",season:1,month:1,afterDay:7},
    {slot:19,name:"Mid 2",season:1,month:1,afterDay:7},
    {slot:6,name:"After",season:1,month:1,afterDay:30}
  ]});
  for(let n=-75;n<110;n++)assert.equal(dateToOrdinal(ordinalToDate(n,config),config),n);
  const first=advanceDay(regular(7),config);
  assert.equal(first.specialDay,-2);
  assert.equal(advanceDay(first,config).specialDay,-19);
  assert.equal(advanceDay(advanceDay(first,config),config).day,8);
  assert.equal(retreatDay(regular(1),config).specialDay,-7);
  assert.equal(weekdayIndex(regular(8),config),0);
  const advancing=normalizeCalendarConfig({...config,week:{...config.week,specialDaysAdvance:true}});
  assert.equal(weekdayIndex(regular(8),advancing),3);
  assert.equal(parseDateKey(dateKey(first,config),config).specialDay,-2);
  const reordered=normalizeCalendarConfig({...config,specialDays:[...config.specialDays].reverse()});
  assert.equal(parseDateKey(dateKey(first,config),reordered).specialDay,-2);
});
test("sun stays up from Monday morning until Thursday evening without midnight reset",()=>{
  const config=normalizeCalendarConfig({...base(),sun:{mode:"cycle",cycleDays:7,phases:[
    {name:"Licht",startMinute:360,darkness:0}, {name:"Dunkel",startMinute:3*1440+1080,darkness:1}
  ]}});
  const state=(day,minuteOfDay)=>({...regular(day),minuteOfDay});
  assert.equal(solarPhase(state(1,359),config).darkness,1);
  assert.equal(solarPhase(state(1,360),config).darkness,0);
  assert.equal(solarPhase(state(3,0),config).darkness,0);
  assert.equal(solarPhase(state(4,1079),config).darkness,0);
  assert.equal(solarPhase(state(4,1080),config).darkness,1);
  assert.equal(solarPhase(state(8,360),config).darkness,0);
  const start=absoluteMinute(state(1,360),config);
  assert.equal(solarPhase(stateFromAbsoluteMinute(start+35*1440,config),config).darkness,0);
});
test("season ranges cross year boundary and exact-date solar rules override weekday rules",()=>{
  const config=normalizeCalendarConfig({...base(),seasonRanges:[{id:"winter",name:"Winter",startDay:25,endDay:5}],sun:{mode:"rules",rules:[
    {kind:"season",match:"winter",sunrise:600,sunset:700},
    {kind:"weekday",match:"1",sunrise:360,sunset:1000},
    {kind:"date",match:dateKey(regular(1),base()),sunrise:800,sunset:1100}
  ]}});
  assert.equal(seasonsOn(regular(30),config)[0].id,"winter");
  assert.equal(seasonsOn(regular(10),config).length,0);
  assert.equal(solarPhase({...regular(1),minuteOfDay:500},config).darkness,1);
  assert.equal(solarPhase({...regular(1),minuteOfDay:900},config).darkness,0);
  assert.deepEqual(validateExtensions(config),[]);
});
test("category lock and forced palette are applied to untrusted colors",()=>{
  const config=base();config.eventColors.mode="free";
  assert.equal(eventColor({category:"quest",color:"#ffffff"},config),"#408cff");
  config.eventColors.mode="fixed";config.eventColors.fixed="#112233";
  assert.equal(eventColor({category:"quest",color:"#ffffff"},config),"#112233");
  config.eventColors.mode="palette";
  assert.equal(eventColor({category:"note",color:"javascript:bad"},config),config.eventColors.palette[0]);
});
test("permission enforcement rejects forbidden fields, changed grants and stale writes",()=>{
  const config=base();const player={isGM:false};
  let next=structuredClone(config);next.sun.mode="rules";
  assert.throws(()=>authorizedPatch(config,config,next,player),/Keine Änderungsberechtigung/);
  config.permissions.sun="edit";next=structuredClone(config);next.sun.mode="rules";
  assert.equal(authorizedPatch(config,config,next,player).sun.mode,"rules");
  next.permissions.timer="edit";
  assert.throws(()=>authorizedPatch(config,config,next,player),/Nur GMs/);
  next=structuredClone(config);next.sun.offsetMinutes=100;
  const current=structuredClone(config);current.sun.offsetMinutes=60;
  assert.throws(()=>authorizedPatch(current,config,next,player),/inzwischen/);
});
test("public projection strips hidden solar rules and secret calendar names",()=>{
  const config=normalizeCalendarConfig({...base(),permissions:{sun:"hidden",structure:"hidden",specialDays:"hidden",seasonRanges:"hidden"},
    name:"Secret world",sun:{mode:"cycle",phases:[{name:"Secret sun",startMinute:0}]},
    specialDays:[{name:"Secret feast",description:"Secret plot",afterDay:1}],seasonRanges:[{name:"Secret season",startDay:1,endDay:4}]});
  const safe=publicConfig(config);
  assert.equal(JSON.stringify(safe).includes("Secret"),false);
  assert.equal(safe.sun.phases.length,0);
  assert.equal(dateToOrdinal(regular(3),safe),dateToOrdinal(regular(3),config));
});
test("timer handles fractional speed, delayed ticks and exact boundary without overshoot",()=>{
  let step=timerStep(1,0.1,0,5);assert.equal(step.minutes,0);
  step=timerStep(9,0.1,step.remainder,5);assert.equal(step.minutes,1);
  step=timerStep(45,10,0.4,7);assert.equal(step.minutes,7);assert.equal(step.complete,true);
});

test("legacy special-day settings cannot bypass their permission through the structure editor",()=>{
  const current=base();current.permissions.structure="edit";current.permissions.specialDays="fixed";
  const next=structuredClone(current);next.seasons[0].specialDay.enabled=true;
  assert.throws(()=>authorizedPatch(current,current,next,{isGM:false}),/Sondertage/);
});
