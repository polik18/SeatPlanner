(function(){
  'use strict';const SM=window.SeatMaster;
  function signature(state){return JSON.stringify({version:1,geometry:SM.seatingConstraints.signature(state),roster:SM.engine.studentsRequiringSeats(state.config).map(s=>[s.number,s.gender]),identities:state.rosterIdentity.map(s=>[s.studentId,s.number]),seats:state.seats.map(s=>[s.id,s.type,s.pin]),rules:state.seatingConstraints,edges:state.seatTopology?.edges});}
  async function prepare(source,{signal,onProgress=()=>{}}={}){
    const state=SM.drawingScene.clone(source);delete state.layoutDraft;
    onProgress('檢查教室形狀與物件…');
    const errors=SM.drawingScene.issues(state);
    if(state.pendingSeatPins?.length)errors.push('預排尚未重新指定位置：'+state.pendingSeatPins.join('、')+' 號。');
    if(state.genderPlan?.source==='teacher-pattern'){
      const pattern=state.genderPlan.strategy,result=SM.engine.applyGenderPattern(state.config,state.seats,pattern,SM.drawingScene.genderOrder(state));
      const pins=new Map(state.seats.filter(s=>s.pin).map(s=>[s.id,s.pin]));
      state.seats=result.seats.map(s=>({...s,pin:pins.get(s.id)||null}));
    }
    const report=SM.engine.validate(state);errors.push(...report.errors);
    if(errors.length)return{status:'invalid',errors};
    if(signal?.aborted)return{status:'cancelled'};
    onProgress('計算座位鄰接與同儕分開條件…');
    state.seatTopology=SM.seatingConstraints.refreshTopology(state);
    const roster=SM.engine.studentsRequiringSeats(state.config),byNumber=new Map(roster.map(s=>[s.number,s]));
    const preferences={},remaining={male:roster.filter(s=>s.gender==='male').length,female:roster.filter(s=>s.gender==='female').length};
    for(const seat of state.seats)if(seat.pin){const gender=byNumber.get(seat.pin)?.gender;if(gender){preferences[seat.id]=gender;remaining[gender]--;}}
    const order=SM.drawingScene.objects(state).filter(o=>o.kind==='seat').sort((a,b)=>a.y-b.y||a.x-b.x),groups=new Map(),counts=new Map();
    const group=o=>o.tableId||'single:'+o.id;
    for(const o of order){const key=group(o);if(!groups.has(key)){groups.set(key,[]);counts.set(key,{male:0,female:0});}const s=state.seats.find(s=>s.id===o.id);if(s.pin){const gender=byNumber.get(s.pin)?.gender;if(gender)counts.get(key)[gender]++;}else if(['male','female'].includes(s.type)){preferences[o.id]=s.type;if(remaining[s.type]>0){remaining[s.type]--;counts.get(key)[s.type]++;}}else groups.get(key).push(o);}
    let last='female',active=true;while(active){active=false;for(const [key,items]of groups){const o=items.shift();if(!o)continue;active=true;const c=counts.get(key),desired=c.male>c.female?'female':c.female>c.male?'male':remaining.male>remaining.female?'male':remaining.female>remaining.male?'female':last==='male'?'female':'male';const gender=remaining[desired]>0?desired:remaining.male>0?'male':remaining.female>0?'female':null;if(gender){preferences[o.id]=gender;remaining[gender]--;c[gender]++;last=gender;}}}
    state.genderPlan=state.genderPlan?.source==='teacher-pattern'?{...state.genderPlan,preferences}:{version:1,source:'automatic-preference',strategy:'balanced',preferences};
    onProgress('檢查男女配置、預排與分開規則是否可同時滿足…');
    const result=await SM.constrainedArranger.solve(state,{signal});
    if(result.status!=='solved')return result;
    const available=new Set(state.seats.map(s=>s.id));const existing=Object.fromEntries(Object.entries(state.assignment||{}).filter(([id])=>available.has(id)));
    const complete=state.hasDrawn&&SM.seatingConstraints.validateAssignment(state,existing).valid&&state.seats.every(s=>existing[s.id]==null||SM.engine.isCompatible(s,byNumber.get(existing[s.id]))&&(!s.pin||s.pin===existing[s.id]));
    if(complete)state.assignment=existing;
    else{const draft={...state.manualDraft,...existing};state.manualDraft=Object.fromEntries(Object.entries(draft).filter(([id,n])=>available.has(id)&&byNumber.has(n)));state.hasDrawn=false;state.assignment={};}
    state.layoutCheck={version:1,signature:signature(state),status:'ready',students:roster.length,seats:state.seats.length};
    state.roomLayout.editing=false;
    onProgress('保存可用配置…');return{status:'solved',state};
  }
  SM.layoutPlanner={prepare,signature};
})();
