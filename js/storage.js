(function () {
  'use strict';
  const SM = window.SeatMaster, { STORAGE_KEY, VERSION } = SM.constants;
  let writeBlocked = false, loadStatus = { status: 'empty' };
  const clone = value => JSON.parse(JSON.stringify(value));
  const invalid = () => new Error(SM.i18n ? SM.i18n.t('storage.invalid') : 'Invalid workspace');
  const newId = () => SM.classData?.id() || window.crypto?.randomUUID?.() || `class-${Date.now()}-${Math.random()}`;
  function serializableState(state) {
    return clone({
      version: state.roomLayout?.version===3 || state.layoutDraft ? 7 : state.classroomGeometry ? 6 : VERSION, config: { ...state.config },
      seats: state.seats.map(seat => ({ id:seat.id,row:seat.row,col:seat.col,type:seat.type,pin:seat.pin || null })),
      assignment: state.hasDrawn ? { ...state.assignment } : {}, hasDrawn: Boolean(state.hasDrawn),
      resultSource: state.resultSource || 'draw', adminMode: state.adminMode || 'layout',
      manualDraft: state.manualDraft || null, activities: state.activities || [], roomLayout: state.roomLayout || null,
      rosterIdentity: state.rosterIdentity || [], seatingConstraints: state.seatingConstraints || { version:1,pairs:[] },
      seatTopology: state.seatTopology || null, studentDrawRound: state.studentDrawRound || null,
      ...(state.classroomGeometry ? { classroomGeometry: state.classroomGeometry } : {}),
      ...(state.pendingSeatPins ? {pendingSeatPins:state.pendingSeatPins} : {}),
      ...(state.genderPlan ? {genderPlan:state.genderPlan} : {}),
      ...(state.layoutCheck ? {layoutCheck:state.layoutCheck} : {}),
      ...(state.layoutDraft ? {layoutDraft:serializableState({...state.layoutDraft,layoutDraft:null})} : {})
    });
  }
  function isClassState(value) {
    if (!value || !value.config || typeof value.config !== 'object' || !Array.isArray(value.seats)) return false;
    const ids = new Set();
    return value.seats.every(seat => seat && typeof seat.id === 'string' && seat.id && !ids.has(seat.id) && ids.add(seat.id) && Number.isInteger(seat.row) && Number.isInteger(seat.col) && SM.constants.SEAT_TYPES.includes(seat.type) && (seat.pin == null || Number.isInteger(seat.pin)));
  }
  function validExtensions(state) {
    if(state.roomLayout?.version!==undefined&&![1,2,3].includes(state.roomLayout.version))return false;
    if(state.roomLayout?.version===3 && (!SM.drawingScene || !SM.drawingScene.valid(state)))return false;
    if(state.pendingSeatPins && (!Array.isArray(state.pendingSeatPins)||state.pendingSeatPins.some(n=>!Number.isInteger(n)||n<1)||new Set(state.pendingSeatPins).size!==state.pendingSeatPins.length))return false;
    if(state.layoutDraft && (state.layoutDraft.layoutDraft || !isClassState(state.layoutDraft) || !validExtensions(state.layoutDraft)))return false;
    if (state.classroomGeometry != null && (!SM.classroomGeometry || !SM.classroomGeometry.valid(state.classroomGeometry))) return false;
    const identity = state.rosterIdentity || [], ids = new Set(), numbers = new Set();
    if (!Array.isArray(identity)) return false;
    for (const row of identity) {
      if (!row || typeof row.studentId !== 'string' || !row.studentId || ids.has(row.studentId) || row.number !== null && (!Number.isInteger(row.number) || row.number < 1 || numbers.has(row.number))) return false;
      ids.add(row.studentId); if (row.number !== null) numbers.add(row.number);
    }
    const rules = state.seatingConstraints || {version:1,pairs:[]}, seen = new Set(), ruleIds = new Set();
    if (rules.version !== 1 || !Array.isArray(rules.pairs)) return false;
    for (const rule of rules.pairs) {
      if (!rule || typeof rule.id !== 'string' || !rule.id || ruleIds.has(rule.id) || !ids.has(rule.studentAId) || !ids.has(rule.studentBId) || rule.studentAId === rule.studentBId || !Array.isArray(rule.relations) || !rule.relations.length || rule.relations.some(value => !['notAdjacent','notSameTable'].includes(value)) || typeof rule.enabled !== 'boolean') return false;
      const key = JSON.stringify([rule.studentAId,rule.studentBId].sort());
      if (seen.has(key)) return false;
      seen.add(key); ruleIds.add(rule.id);
    }
    const top = state.seatTopology;
    if (top && (typeof top.signature !== 'string' || typeof top.confirmed !== 'boolean' || !Array.isArray(top.edges) || top.edges.some(edge => !Array.isArray(edge) || edge.length !== 2 || edge.some(id => typeof id !== 'string') || edge[0] === edge[1]))) return false;
    const edgeList=edges=>Array.isArray(edges)&&edges.length<=10000&&edges.every(e=>Array.isArray(e)&&e.length===2&&e.every(id=>typeof id==='string')&&e[0]!==e[1])&&new Set(edges.map(e=>JSON.stringify([...e].sort()))).size===edges.length;
    if(top?.autoEdges!==undefined&&!edgeList(top.autoEdges))return false;
    if(top?.overrides&&(!edgeList(top.overrides.add)||!edgeList(top.overrides.remove)))return false;
    const round = state.studentDrawRound;
    if (round && (typeof round.key !== 'string' || !Array.isArray(round.history) || round.history.some(batch => !Array.isArray(batch) || batch.some(n => !Number.isInteger(n)) || new Set(batch).size !== batch.length))) return false;
    return true;
  }
  function migrateState(source) {
    if (!isClassState(source) || ![1,2,3,4,5,6,7].includes(source.version)) return null;
    if (source.version >= 5 && !validExtensions(source)) return null;
    const state = clone(source);
    state.version=VERSION;
    state.config={...SM.constants.DEFAULT_CONFIG,...state.config,seatExcludedNumbers:source.version===1?'':source.config.seatExcludedNumbers || ''};
    state.activities=Array.isArray(state.activities)?state.activities:[];
    state.roomLayout ||= null;
    SM.classData?.ensure(state);
    if(!validExtensions(state))return null;
    return state;
  }
  function migrate(source) {
    if (!source || ![1,2,3,4,5,6,7].includes(source.version) || source.format && !['seatplanner-workspace','seatplanner-class'].includes(source.format)) return null;
    const entries = Array.isArray(source.classes) ? source.classes : [{id:'legacy',state:source}];
    if (!entries.length || Array.isArray(source.classes) && ![4,5,6,7].includes(source.version)) return null;
    const classes=[], used=new Set(), mapping=new Map();
    for (const entry of entries) {
      const state=migrateState(entry?.state);
      if (!state) return null;
      const id=source.version>=5 && typeof entry.id==='string' && entry.id ? entry.id : newId();
      if (used.has(id)) return null;
      used.add(id); mapping.set(entry.id,id);
      const records=[];
      if (entry.records != null && !Array.isArray(entry.records)) return null;
      const recordIds=new Set();
      for (const record of entry.records || []) {
        const snapshot=migrateState(record?.state);
        if (!record || typeof record.id!=='string' || recordIds.has(record.id) || typeof record.label!=='string' || !snapshot || record.savedAt !== null && !Number.isFinite(Date.parse(record.savedAt))) return null;
        recordIds.add(record.id); records.push({...record,state:snapshot});
      }
      const result={id,state,meta:{...(entry.meta || {})},records};
      SM.classData?.initializeEntry(result);
      if (source.version<5 && SM.classData) SM.classData.addRecord(result,'Legacy import baseline / 舊版載入基線',{legacy:true});
      classes.push(result);
    }
    return {format:'seatplanner-workspace',version:VERSION,activeClassId:mapping.get(source.activeClassId)||classes[0].id,classes};
  }
  function serializable(workspace) {
    const value=migrate(workspace);
    if (!value) throw invalid();
    value.classes=value.classes.map(entry=>({...entry,state:serializableState(entry.state),records:entry.records.map(record=>({...record,state:serializableState(record.state)}))}));
    if (value.classes.some(entry => entry.state.classroomGeometry || entry.records.some(record => record.state.classroomGeometry))) value.version = 6;
    if (value.classes.some(entry=>entry.state.version===7 || entry.records.some(record=>record.state.version===7)))value.version=7;
    return value;
  }
  function download(workspace, single=false) {
    const value=serializable(workspace);
    if (single) value.format='seatplanner-class';
    const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;
    link.download=`SeatPlanner-Inclusive-${single?(value.classes[0].state.config.className || 'class'):'classes'}-v${value.version}.json`;
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  SM.storage={
    serializableState,migrate,getLoadStatus:()=>loadStatus,
    save(workspace) {
      if (writeBlocked) return {ok:false,error:invalid()};
      let bytes=0;
      try {const json=JSON.stringify(serializable(workspace));bytes=json.length*2;localStorage.setItem(STORAGE_KEY,json);return {ok:true,bytes};}
      catch(error){return {ok:false,error,bytes,classes:workspace.classes?.length || 0};}
    },
    load() {
      try {
        let raw=localStorage.getItem(STORAGE_KEY), sourceKey=STORAGE_KEY;
        if (raw===null) for (const version of [4,3,2,1]) {const key=`classroom-seat-master:v${version}`,value=localStorage.getItem(key);if(value!==null){raw=value;sourceKey=key;break;}}
        if (raw===null){loadStatus={status:'empty'};return null;}
        const result=migrate(JSON.parse(raw));if(!result)throw invalid();
        if (sourceKey!==STORAGE_KEY) {
          const active=result.classes.find(entry=>entry.id===result.activeClassId).state;
          try {
            const old=JSON.parse(localStorage.getItem('classroom-seat-master:student-draw') || 'null');
            const roster=SM.engine.buildStudents(active.config),names=SM.engine.parseStudentNames(active.config.studentData,roster);
            const oldKey=JSON.stringify([active.config.className,roster.map(s=>[s.number,names.get(s.number)||''])]);
            const numbers=new Set(roster.map(student=>student.number));
            if(old?.key===oldKey && Array.isArray(old.history) && old.history.length<=999 && old.history.every(batch=>Array.isArray(batch)&&batch.length>0&&batch.length<=roster.length&&new Set(batch).size===batch.length&&batch.every(n=>numbers.has(n)))) active.studentDrawRound={key:JSON.stringify(active.rosterIdentity.filter(r=>r.number!==null).map(r=>[r.studentId,r.number])),history:old.history};
          } catch(_){  }
        }
        loadStatus={status:'loaded',sourceKey,migrated:sourceKey!==STORAGE_KEY};return result;
      } catch(error){writeBlocked=true;loadStatus={status:'error',error};return null;}
    },
    clear(){try{for(const version of [5,4,3,2,1])localStorage.removeItem(`classroom-seat-master:v${version}`);localStorage.removeItem('classroom-seat-master:student-draw');writeBlocked=false;return {ok:true};}catch(error){return {ok:false,error};}},
    export:workspace=>download(workspace),
    exportClass:entry=>download({version:VERSION,activeClassId:entry.id,classes:[entry]},true),
    async readImport(file){
      const result=migrate(JSON.parse(await file.text()));if(!result)throw invalid();
      for(const entry of result.classes) for(const state of [entry.state,...entry.records.map(record=>record.state)]){
        const ids=new Set(state.seats.filter(s=>s.type!=='aisle').map(s=>s.id));
        const students=SM.engine?new Set(SM.engine.studentsRequiringSeats(SM.engine.normalizeConfig(state.config)).map(s=>s.number)):null;
        for(const [assignment,complete] of [[state.assignment,state.hasDrawn],[state.manualDraft,false]]){
          if(assignment==null)continue;if(typeof assignment!=='object'||Array.isArray(assignment))throw invalid();const seen=new Set();
          for(const [id,number]of Object.entries(assignment)){if(!ids.has(id)||number!==null&&(!Number.isInteger(number)||seen.has(number)||students&&!students.has(number)))throw invalid();if(number!==null)seen.add(number);}
          if(complete&&students&&seen.size!==students.size)throw invalid();
        }
        if(state.roomLayout){const used=new Set();if(!Array.isArray(state.roomLayout.tables))throw invalid();for(const table of state.roomLayout.tables)if(!table||!Array.isArray(table.seatIds)||table.seatIds.some(id=>!ids.has(id)||used.has(id)||!used.add(id)))throw invalid();}
      }
      return result;
    }
  };
})();
