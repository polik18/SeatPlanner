(function () {
  'use strict';
  const SM = window.SeatMaster, clone = value => JSON.parse(JSON.stringify(value));
  const rotate = (x, y, angle) => { const a = angle * Math.PI / 180; return { x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) }; };
  const angle = n => (n % 360 + 360) % 360;
  function upgrade(state) {
    const c = SM.classroomGeometry.ensure(state).content;
    if(state.roomLayout?.version===3&&state.seatTopology?.confirmed&&!state.seatTopology.overrides){state.seatTopology=SM.seatingConstraints.refreshTopology(state);}
    if (state.roomLayout?.version === 3) return;
    if (state.roomLayout) {
      state.roomLayout.version = 3; state.roomLayout.looseSeats = [];
      state.roomLayout.tables.forEach(t => { t.seatPositions = SM.roomLayout.seatPoints(t,t.seatIds.length).map(p => ({...p,angle:p.angle||0,width:p.width || 42,height:p.height || 32})); });
      state.roomLayout.paths.forEach(p=>{p.rotation ||= 0;});
    } else {
      state.roomLayout = { version:3,template:'drawing',editing:false,tables:[],paths:[],looseSeats:state.seats.filter(s=>s.type!=='aisle').map(s=>({id:s.id,x:(s.col+.5)*100/state.config.cols,y:(s.row+.5)*100/state.config.rows,width:42,height:32,angle:0})),nextSeatId:1,nextTableId:1 };
      state.seats.filter(s=>s.type==='aisle').forEach(s=>state.roomLayout.paths.push({id:'aisle-'+s.id,x:s.col*100/state.config.cols,y:s.row*100/state.config.rows,width:100/state.config.cols,height:100/state.config.rows,rotation:0,label:'走道'}));
      state.seats=state.seats.filter(s=>s.type!=='aisle');
    }
    state.roomLayout.editing = false;
    state.pendingSeatPins ||= [];
    return c;
  }
  function tableBox(state,t) { const c=state.classroomGeometry.content;return {x:c.x+c.width*t.x/100,y:c.y+c.height*t.y/100,width:c.width*t.width/100,height:c.height*t.height/100,rotation:t.rotation||0}; }
  function objects(state) {
    const c=state.classroomGeometry.content,l=state.roomLayout,result=[];
    if (!l) return result;
    for(const t of l.tables){
      const b=tableBox(state,t);result.push({kind:'table',id:t.id,...b});
      for(const p of t.seatPositions){const q=rotate((p.x-50)*b.width/100,(p.y-50)*b.height/100,b.rotation);result.push({kind:'seat',id:p.id,tableId:t.id,x:b.x+q.x,y:b.y+q.y,width:p.width||42,height:p.height||32,rotation:angle(b.rotation+(p.angle||0))});}
    }
    for(const p of l.looseSeats||[])result.push({kind:'seat',id:p.id,x:c.x+c.width*p.x/100,y:c.y+c.height*p.y/100,width:p.width||42,height:p.height||32,rotation:p.angle||0});
    for(const p of l.paths)result.push({kind:'path',id:p.id,x:c.x+c.width*(p.x+p.width/2)/100,y:c.y+c.height*(p.y+p.height/2)/100,width:c.width*p.width/100,height:c.height*p.height/100,rotation:p.rotation||0});
    for(const m of state.classroomGeometry.markers.filter(m=>m.visible))result.push({kind:'marker',...m});
    return result;
  }
  function box(state,ref){return objects(state).find(o=>o.kind===ref.kind&&o.id===ref.id);}
  function setBox(state,ref,b){
    b={...b,x:GClamp(b.x,-3999,7999),y:GClamp(b.y,-3999,7999),width:GClamp(b.width,ref.kind==='marker'?20:12,ref.kind==='marker'?4000:2000),height:GClamp(b.height,ref.kind==='marker'?20:12,ref.kind==='marker'?4000:2000)};
    const l=state.roomLayout,c=state.classroomGeometry.content;
    if(ref.kind==='table'){const t=l.tables.find(t=>t.id===ref.id);Object.assign(t,{x:(b.x-c.x)*100/c.width,y:(b.y-c.y)*100/c.height,width:b.width*100/c.width,height:b.height*100/c.height,rotation:angle(b.rotation)});}
    if(ref.kind==='marker'){const m=state.classroomGeometry.markers.find(m=>m.id===ref.id);Object.assign(m,{x:b.x,y:b.y,width:b.width,height:b.height,rotation:angle(b.rotation),wall:null});}
    if(ref.kind==='path'){const p=l.paths.find(p=>p.id===ref.id);Object.assign(p,{x:(b.x-c.x-b.width/2)*100/c.width,y:(b.y-c.y-b.height/2)*100/c.height,width:b.width*100/c.width,height:b.height*100/c.height,rotation:angle(b.rotation)});}
    if(ref.kind==='seat'){
      const t=l.tables.find(t=>t.seatIds.includes(ref.id));let p;
      if(t){p=t.seatPositions.find(p=>p.id===ref.id);const tb=tableBox(state,t),q=rotate(b.x-tb.x,b.y-tb.y,-tb.rotation);Object.assign(p,{x:50+q.x*100/tb.width,y:50+q.y*100/tb.height,angle:angle(b.rotation-tb.rotation)});}
      else{p=l.looseSeats.find(p=>p.id===ref.id);Object.assign(p,{x:(b.x-c.x)*100/c.width,y:(b.y-c.y)*100/c.height,angle:angle(b.rotation)});}
      Object.assign(p,{width:b.width,height:b.height});
    }
  }
  function reparentSeat(state,id,tableId){
    const b=box(state,{kind:'seat',id}),l=state.roomLayout;
    for(const t of l.tables){t.seatIds=t.seatIds.filter(i=>i!==id);t.seatPositions=t.seatPositions.filter(p=>p.id!==id);}
    l.looseSeats=l.looseSeats.filter(p=>p.id!==id);
    const t=l.tables.find(t=>t.id===tableId);
    if(t){t.seatIds.push(id);t.seatPositions.push({id,x:50,y:50,width:b.width,height:b.height,angle:0});}
    else l.looseSeats.push({id,x:0,y:0,width:b.width,height:b.height,angle:0});
    setBox(state,{kind:'seat',id},b);
  }
  function cleanSelection(state,refs){const tables=new Set(refs.filter(r=>r.kind==='table').map(r=>r.id));return refs.filter((r,i)=>refs.findIndex(x=>x.kind===r.kind&&x.id===r.id)===i&&(r.kind!=='seat'||!state.roomLayout.tables.some(t=>tables.has(t.id)&&t.seatIds.includes(r.id))));}
  function remove(state,refs){
    refs=cleanSelection(state,refs);const l=state.roomLayout,removed=new Set(refs.filter(r=>r.kind==='seat').map(r=>r.id));
    for(const r of refs){if(r.kind==='table')l.tables.find(t=>t.id===r.id)?.seatIds.forEach(id=>removed.add(id));if(r.kind==='marker')state.classroomGeometry.markers.find(m=>m.id===r.id).visible=false;}
    for(const s of state.seats.filter(s=>removed.has(s.id)))if(s.pin&&!state.pendingSeatPins.includes(s.pin))state.pendingSeatPins.push(s.pin);
    state.seats=state.seats.filter(s=>!removed.has(s.id));
    l.tables=l.tables.filter(t=>!refs.some(r=>r.kind==='table'&&r.id===t.id));
    for(const t of l.tables){t.seatIds=t.seatIds.filter(id=>!removed.has(id));t.seatPositions=t.seatPositions.filter(p=>!removed.has(p.id));}
    l.looseSeats=l.looseSeats.filter(p=>!removed.has(p.id));l.paths=l.paths.filter(p=>!refs.some(r=>r.kind==='path'&&r.id===p.id));
  }
  function nextSeat(state){let id;do{id='free-'+state.roomLayout.nextSeatId++;}while(state.seats.some(s=>s.id===id));state.seats.push({id,row:0,col:state.seats.length,type:'general',pin:null});return id;}
  function addSeat(state,tableId,position){
    const id=nextSeat(state),l=state.roomLayout,t=l.tables.find(t=>t.id===tableId);
    if(t){let points=[{x:8,y:50},{x:50,y:8},{x:92,y:50},{x:50,y:92}];for(const v of [20,35,65,80])points.push({x:8,y:v},{x:92,y:v},{x:v,y:8},{x:v,y:92});if(t.type==='u'){const opening=t.geometry?.opening||'bottom';points=points.filter(p=>!(opening==='bottom'&&p.y===92||opening==='top'&&p.y===8||opening==='left'&&p.x===8||opening==='right'&&p.x===92));}const b=tableBox(state,t);const distance=p=>t.seatPositions.length?Math.min(...t.seatPositions.map(q=>Math.hypot((p.x-q.x)*b.width/100,(p.y-q.y)*b.height/100))):0;const p=position||points.sort((a,b)=>distance(b)-distance(a))[0];t.seatIds.push(id);t.seatPositions.push({id,...p,width:42,height:32,angle:0});}
    else{const c=state.classroomGeometry.content,existing=objects(state),candidates=[];for(let y=10;y<=90;y+=10)for(let x=10;x<=90;x+=10)candidates.push({x,y});candidates.sort((a,b)=>Math.hypot(a.x-50,a.y-50)-Math.hypot(b.x-50,b.y-50));const p=candidates.find(p=>existing.every(o=>{const e=SM.classroomGeometry.extents(o);return Math.abs(c.x+c.width*p.x/100-o.x)>e.x+25||Math.abs(c.y+c.height*p.y/100-o.y)>e.y+20;}))||{x:50,y:50};l.looseSeats.push({id,...p,width:42,height:32,angle:0});}
    return {kind:'seat',id};
  }
  function addTable(state,type='rect'){
    let id;do{id='table-'+state.roomLayout.nextTableId++;}while(state.roomLayout.tables.some(t=>t.id===id));
    const t={id,type,x:50,y:50,width:22,height:24,rotation:0,seatIds:[],seatPositions:[],geometry:{opening:'bottom',armThickness:12,seatRadius:44,startAngle:-90},edgeCounts:null};state.roomLayout.tables.push(t);
    if(type==='round')t.height=t.width*state.classroomGeometry.content.width/state.classroomGeometry.content.height;
    for(let i=0;i<4;i++)addSeat(state,id);
    return {kind:'table',id};
  }
  function duplicate(state,refs){const selected=cleanSelection(state,refs),out=[];
    for(const ref of selected){const b=box(state,ref);if(!b)continue;
      if(ref.kind==='table'){const original=clone(state.roomLayout.tables.find(t=>t.id===ref.id)),r=addTable(state,original.type),t=state.roomLayout.tables.find(t=>t.id===r.id);remove(state,t.seatIds.map(id=>({kind:'seat',id})));Object.assign(t,original,{id:r.id,seatIds:[],seatPositions:[]});for(const p of original.seatPositions){const id=nextSeat(state);t.seatIds.push(id);t.seatPositions.push({...p,id});}out.push(r);setBox(state,r,{...b,x:b.x+30,y:b.y+30});}
      if(ref.kind==='seat'){const r=addSeat(state);setBox(state,r,{...b,x:b.x+30,y:b.y+30});out.push(r);}
      if(ref.kind==='path'){const p=clone(state.roomLayout.paths.find(p=>p.id===ref.id));p.id='path-'+SM.classData.id();state.roomLayout.paths.push(p);const r={kind:'path',id:p.id};setBox(state,r,{...b,x:b.x+30,y:b.y+30});out.push(r);}
      if(ref.kind==='marker'){const m=clone(state.classroomGeometry.markers.find(m=>m.id===ref.id));m.id=m.type+'-'+SM.classData.id();m.x+=30;m.y+=30;m.wall=null;state.classroomGeometry.markers.push(m);out.push({kind:'marker',id:m.id});}
    }return out;
  }
  function valid(state){const l=state.roomLayout;if(l?.version!==3)return true;
    if(!Array.isArray(l.tables)||!Array.isArray(l.paths)||!Array.isArray(l.looseSeats))return false;
    const ids=new Set(state.seats.filter(s=>s.type!=='aisle').map(s=>s.id)),used=new Set(),tableIds=new Set(),pathIds=new Set();
    const finite=(...ns)=>ns.every(Number.isFinite),claim=id=>ids.has(id)&&!used.has(id)&&!!used.add(id);
    const seat=p=>p&&typeof p.id==='string'&&finite(p.x,p.y,p.width,p.height,p.angle)&&p.width>=12&&p.height>=12&&p.width<=2000&&p.height<=2000&&Math.abs(p.x)<=10000&&Math.abs(p.y)<=10000;
    for(const t of l.tables){if(!t||typeof t.id!=='string'||tableIds.has(t.id)||!['rect','round','u'].includes(t.type)||!finite(t.x,t.y,t.width,t.height,t.rotation)||t.width<=0||t.height<=0||!Array.isArray(t.seatIds)||!Array.isArray(t.seatPositions)||t.seatPositions.length!==t.seatIds.length)return false;tableIds.add(t.id);if(t.seatIds.some(id=>!claim(id))||new Set(t.seatPositions.map(p=>p.id)).size!==t.seatIds.length||t.seatPositions.some(p=>!seat(p)||!t.seatIds.includes(p.id)))return false;}
    if(l.looseSeats.some(p=>!seat(p)||!claim(p.id)))return false;
    for(const p of l.paths){if(!p||typeof p.id!=='string'||pathIds.has(p.id)||!finite(p.x,p.y,p.width,p.height,p.rotation)||p.width<=0||p.height<=0)return false;pathIds.add(p.id);}
    return used.size===ids.size;
  }
  function normalize(layout){return clone({...layout,editing:false,nextSeatId:Math.max(1,layout.nextSeatId||1),nextTableId:Math.max(1,layout.nextTableId||1)});}
  function edges(state){
    let nodes=objects(state).filter(o=>o.kind==='seat');const result=new Map();
    let cos=0,sin=0,firstAngle=0,found=false;
    for(const a of nodes){const closest=nodes.filter(b=>b.id!==a.id).map(b=>({b,d:Math.hypot(b.x-a.x,b.y-a.y)})).filter(o=>o.d>1e-6).sort((l,r)=>Math.abs(l.d-r.d)<1e-6?l.b.id.localeCompare(r.b.id):l.d-r.d)[0];if(!closest)continue;const angle=Math.atan2(closest.b.y-a.y,closest.b.x-a.x);if(!found){firstAngle=angle;found=true;}cos+=Math.cos(4*angle);sin+=Math.sin(4*angle);}
    const basis=(Math.hypot(cos,sin)<1e-6?firstAngle:Math.atan2(sin,cos)/4)*180/Math.PI;
    nodes=nodes.map(o=>({...o,...rotate(o.x,o.y,-basis)}));
    const median=values=>{values=values.filter(Number.isFinite).sort((a,b)=>a-b);return values[Math.floor(values.length/2)]||60;};
    const sx=median(nodes.map(a=>Math.min(...nodes.filter(b=>b.id!==a.id&&Math.abs(b.y-a.y)<Math.max(a.height,b.height)).map(b=>Math.abs(b.x-a.x)).filter(d=>d>1))));
    const sy=median(nodes.map(a=>Math.min(...nodes.filter(b=>b.id!==a.id&&Math.abs(b.x-a.x)<Math.max(a.width,b.width)).map(b=>Math.abs(b.y-a.y)).filter(d=>d>1))));
    for(const a of nodes){const sectors=new Map();for(const b of nodes){if(a.id===b.id)continue;const dx=(b.x-a.x)/sx,dy=(b.y-a.y)/sy,d=Math.hypot(dx,dy),sector=Math.round(Math.atan2(dy,dx)/(Math.PI/4));if(d<=1.65&&(!sectors.has(sector)||d<sectors.get(sector).d))sectors.set(sector,{b,d});}for(const {b}of sectors.values()){const pair=[a.id,b.id].sort();result.set(JSON.stringify(pair),pair);}}
    return [...result.values()];
  }
  function issues(state){const errors=[],g=state.classroomGeometry; if(!valid(state))return ['物件資料不完整。'];
    if(SM.classroomGeometry.overflow(g).length)errors.push('有內容超出教室形狀。');
    const obs=objects(state), seats=obs.filter(o=>o.kind==='seat');
    for(const o of obs){const e=SM.classroomGeometry.extents(o);if(o.x-e.x<-.1||o.y-e.y<-.1||o.x+e.x>g.bounds.width+.1||o.y+e.y>g.bounds.height+.1)errors.push('物件超出教室：'+o.id);}
    const normalized=o=>({...o,x:o.x/g.bounds.width*100,y:o.y/g.bounds.height*100,width:o.width/g.bounds.width*100,height:o.height/g.bounds.height*100});
    const chair=o=>normalized({...o,width:o.width*.95,height:o.height*.95});
    for(let i=0;i<seats.length;i++)for(let j=i+1;j<seats.length;j++)if(SM.roomLayout.tablesIntersect(chair(seats[i]),chair(seats[j]),g.bounds))errors.push('座位重疊：'+seats[i].id+'、'+seats[j].id);
    const tables=obs.filter(o=>o.kind==='table'&&state.roomLayout.tables.find(t=>t.id===o.id).type!=='u').map(o=>{const round=state.roomLayout.tables.find(t=>t.id===o.id).type==='round';return{...o,width:o.width*(round ? .54 : .48),height:o.height*(round ? .54 : .52)};});
    for(let i=0;i<tables.length;i++)for(let j=i+1;j<tables.length;j++)if(SM.roomLayout.tablesIntersect(normalized(tables[i]),normalized(tables[j]),g.bounds))errors.push('桌面重疊：'+tables[i].id+'、'+tables[j].id);
    for(const t of tables)for(const p of obs.filter(o=>o.kind==='path'))if(SM.roomLayout.tablesIntersect(normalized(t),normalized(p),g.bounds))errors.push('桌面占用通道：'+t.id+'、'+p.id);
    for(const s of seats)for(const p of obs.filter(o=>o.kind==='path'))if(SM.roomLayout.tablesIntersect(chair(s),normalized(p),g.bounds))errors.push('座位占用通道：'+s.id+'、'+p.id);
    return [...new Set(errors)];
  }
  function logicalCells(state) {
    const nodes=objects(state).filter(o=>o.kind==='seat');
    const median=xs=>{xs.sort((a,b)=>a-b);return xs[Math.floor((xs.length-1)/2)]||1;};
    function axis(key,size){
      const tolerance=median(nodes.map(o=>o[size]))*.65,groups=[];
      for(const o of [...nodes].sort((a,b)=>a[key]-b[key]||a.id.localeCompare(b.id))){
        const last=groups[groups.length-1];
        if(last&&o[key]-last.min<=tolerance){last.items.push(o);last.center=last.items.reduce((n,p)=>n+p[key],0)/last.items.length;}
        else groups.push({min:o[key],center:o[key],items:[o]});
      }
      const gaps=groups.slice(1).map((g,i)=>g.center-groups[i].center);
      const originalPitch=state.roomLayout.template==='drawing'?state.classroomGeometry.content[key==='x'?'width':'height']/state.config[key==='x'?'cols':'rows']:Infinity;
      const pitch=Math.min(median(gaps),originalPitch),result=new Map();
      let index=0;groups.forEach((g,i)=>{if(i)index+=Math.max(1,Math.round((g.center-groups[i-1].center)/pitch));g.items.forEach(o=>result.set(o.id,index));});
      return result;
    }
    const rows=axis('y','height'),cols=axis('x','width');
    return Object.fromEntries(nodes.map(o=>[o.id,{row:rows.get(o.id),col:cols.get(o.id)}]));
  }
  function genderOrder(state){
    const result=logicalCells(state);
    for(const t of state.roomLayout.tables){
      const ordered=[...t.seatPositions].sort((a,b)=>Math.atan2(a.y-50,a.x-50)-Math.atan2(b.y-50,b.x-50)||a.id.localeCompare(b.id));
      ordered.forEach((p,index)=>{result[p.id].index=index;});
    }
    const loose=(state.roomLayout.looseSeats||[]).slice().sort((a,b)=>result[a.id].row-result[b.id].row||result[a.id].col-result[b.id].col||a.id.localeCompare(b.id));
    loose.forEach((p,index)=>{result[p.id].index=index;});return result;
  }
  function GClamp(n,min,max){return Math.max(min,Math.min(max,n));}
  SM.drawingScene={upgrade,objects,box,setBox,rotate,angle,reparentSeat,cleanSelection,remove,addSeat,addTable,duplicate,valid,normalize,edges,issues,clone,tableBox,logicalCells,genderOrder};
})();
