(function () {
  'use strict';
  const SM=window.SeatMaster,S=SM.drawingScene,G=SM.classroomGeometry,C=SM.classroomCamera;
  function create(api){
    let refs=[],drag=null,marquee=null,pin=null;
    const read=api.read, copy=()=>S.clone(read());
    function restore(snapshot){const state=read();for(const key of Object.keys(state))if(!(key in snapshot))delete state[key];Object.assign(state,S.clone(snapshot));}
    function select(next,notify=true){refs=S.cleanSelection(read(),next).filter(r=>r.kind==='bounds'||S.box(read(),r));const r=refs[0],l=read().roomLayout;l.selectedTableId=r?.kind==='table'?r.id:r?.kind==='seat'?S.box(read(),r)?.tableId:null;l.selectedSeatId=r?.kind==='seat'?r.id:null;l.selectedPathId=r?.kind==='path'?r.id:null;if(notify)api.selected(refs);}
    function change(fn){api.history.record();fn();read().layoutCheck=null;api.changed();api.selected(refs);}
    function groupBox(){
      if(refs.length===1&&refs[0].kind==='bounds'){const b=read().classroomGeometry.bounds;return{x:b.width/2,y:b.height/2,width:b.width,height:b.height,rotation:0};}
      const boxes=refs.map(r=>S.box(read(),r)).filter(Boolean);if(!boxes.length)return null;if(boxes.length===1)return boxes[0];
      let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;for(const b of boxes){const e=G.extents(b);left=Math.min(left,b.x-e.x);right=Math.max(right,b.x+e.x);top=Math.min(top,b.y-e.y);bottom=Math.max(bottom,b.y+e.y);}return{x:(left+right)/2,y:(top+bottom)/2,width:right-left,height:bottom-top,rotation:0};
    }
    function hit(target){const m=target.closest('[data-marker-id]');if(m)return{kind:'marker',id:m.dataset.markerId};const n=target.closest('[data-drawing-kind]');return n?{kind:n.dataset.drawingKind,id:n.dataset.drawingId}:null;}
    function down(event,point){
      const handle=event.target.closest('[data-geometry-handle]')?.dataset.geometryHandle,ref=hit(event.target);
      if(pin&&ref?.kind==='seat'){const number=pin;pin=null;change(()=>{const seat=read().seats.find(s=>s.id===ref.id);if(seat.pin&&seat.pin!==number)read().pendingSeatPins.push(seat.pin);read().seats.forEach(s=>{if(s.pin===number)s.pin=null;});seat.pin=number;read().pendingSeatPins=read().pendingSeatPins.filter(n=>n!==number);});select([ref]);return;}
      if(ref&&!handle){if(event.shiftKey){const found=refs.some(r=>r.kind===ref.kind&&r.id===ref.id);select(found?refs.filter(r=>r.kind!==ref.kind||r.id!==ref.id):[...refs,ref]);return;}if(!refs.some(r=>r.kind===ref.kind&&r.id===ref.id))select([ref]);}
      if(ref?.kind==='bounds'&&!handle){select([ref]);api.paint();return;}
      if(!ref&&!handle){select([]);marquee={start:point,end:point};api.paint();return;}
      const box=groupBox();if(!box)return;
      drag={before:copy(),start:point,box,kind:handle||'move',items:refs.map(r=>({ref:{...r},box:S.box(read(),r)})),lock:document.getElementById('canvasLock')?.checked||event.shiftKey};api.paint();
    }
    function move(point,event){
      if(marquee){marquee.end=point;api.paint();return;}
      if(!drag)return;const d=drag;restore(d.before);const dx=point.x-d.start.x,dy=point.y-d.start.y,b=d.box;
      if(refs[0]?.kind==='bounds'){
        let w=b.width+(/[ew]/.test(d.kind)?dx*(d.kind.includes('w')?-1:1):0),h=b.height+(/[ns]/.test(d.kind)?dy*(d.kind.includes('n')?-1:1):0);
        if(d.lock){if(/[ew]/.test(d.kind))h=w*b.height/b.width;else w=h*b.width/b.height;}G.resize(read().classroomGeometry,w,h);
      }else if(d.kind==='move'){
        for(const item of d.items)if(item.box){const next={...item.box,x:item.box.x+dx,y:item.box.y+dy};S.setBox(read(),item.ref,next);if(item.ref.kind==='marker'){const original=d.before.classroomGeometry.markers.find(m=>m.id===item.ref.id),m=read().classroomGeometry.markers.find(m=>m.id===item.ref.id);if(original.wall&&refs.length===1){const bounds=read().classroomGeometry.bounds,sides=[['left',m.x],['right',bounds.width-m.x],['top',m.y],['bottom',bounds.height-m.y]].sort((a,b)=>a[1]-b[1]);m.wall=sides[0][0];m.wallT=G.clamp(['left','right'].includes(m.wall)?m.y/bounds.height:m.x/bounds.width,0,1);if(original.wall!==m.wall)m.rotation=['left','right'].includes(m.wall)?90:0;G.pinWall(m,bounds);}}}
      }else if(d.kind==='rotate'){
        const da=(Math.atan2(point.y-b.y,point.x-b.x)-Math.atan2(d.start.y-b.y,d.start.x-b.x))*180/Math.PI;
        const delta=event.altKey?da:Math.abs(S.angle(b.rotation+da)-Math.round(S.angle(b.rotation+da)/90)*90)<6?Math.round(S.angle(b.rotation+da)/90)*90-b.rotation:da;
        for(const item of d.items)if(item.box){const q=S.rotate(item.box.x-b.x,item.box.y-b.y,delta);S.setBox(read(),item.ref,{...item.box,x:b.x+q.x,y:b.y+q.y,rotation:S.angle(item.box.rotation+delta)});}
      }else if(d.kind==='opening'||d.kind==='thickness'||d.kind==='radius'){
        const t=read().roomLayout.tables.find(t=>t.id===refs[0]?.id);if(t){const local=S.rotate(point.x-b.x,point.y-b.y,-b.rotation);if(d.kind==='opening'){t.geometry.opening=Math.abs(local.x)>Math.abs(local.y)?(local.x>0?'right':'left'):(local.y>0?'bottom':'top');const sizes=new Map(t.seatPositions.map(p=>[p.id,p]));t.seatPositions=SM.roomLayout.autoSeatPositions(t,t.seatIds).map(p=>({...p,width:sizes.get(p.id).width,height:sizes.get(p.id).height}));}if(d.kind==='thickness')t.geometry.armThickness=G.clamp(Math.abs(local.x)*100/b.width,6,28);if(d.kind==='radius'){const radius=G.clamp(Math.hypot(local.x*100/b.width,local.y*100/b.height),28,49);t.geometry.seatRadius=radius;t.seatPositions=SM.roomLayout.autoSeatPositions(t,t.seatIds).map(p=>({...p,width:42,height:32}));}}
      }else{
        const q=S.rotate(dx,dy,-b.rotation);let w=Math.max(12,b.width+(d.kind.includes('e')?q.x:d.kind.includes('w')?-q.x:0)),h=Math.max(12,b.height+(d.kind.includes('s')?q.y:d.kind.includes('n')?-q.y:0));
        const round=refs.length===1&&refs[0].kind==='table'&&read().roomLayout.tables.find(t=>t.id===refs[0].id)?.type==='round';
        if(d.lock||round||refs.length>1){if(/[ew]/.test(d.kind))h=w*b.height/b.width;else w=h*b.width/b.height;}
        const offset=S.rotate((w-b.width)/2*(d.kind.includes('w')?-1:d.kind.includes('e')?1:0),(h-b.height)/2*(d.kind.includes('n')?-1:d.kind.includes('s')?1:0),b.rotation);
        for(const item of d.items)if(item.box){const local=S.rotate(item.box.x-b.x,item.box.y-b.y,-b.rotation),next=S.rotate(local.x*w/b.width,local.y*h/b.height,b.rotation);S.setBox(read(),item.ref,{...item.box,x:b.x+offset.x+next.x,y:b.y+offset.y+next.y,width:Math.max(item.ref.kind==='marker'?20:12,item.box.width*w/b.width),height:Math.max(item.ref.kind==='marker'?20:12,item.box.height*h/b.height)});if(refs.length>1&&item.ref.kind==='table')for(const p of read().roomLayout.tables.find(t=>t.id===item.ref.id).seatPositions){p.width=G.clamp(p.width*w/b.width,12,2000);p.height=G.clamp(p.height*h/b.height,12,2000);}}
      }
      api.paint();
    }
    function up(point){
      if(marquee){const a=marquee.start,b=marquee.end;marquee=null;select(S.objects(read()).filter(o=>o.x>=Math.min(a.x,b.x)&&o.x<=Math.max(a.x,b.x)&&o.y>=Math.min(a.y,b.y)&&o.y<=Math.max(a.y,b.y)).map(o=>({kind:o.kind,id:o.id})));api.paint();return;}
      if(!drag)return;const d=drag;
      const after=copy();drag=null;
      if(JSON.stringify(d.before)!==JSON.stringify(after)){restore(d.before);api.history.record();restore(after);read().layoutCheck=null;api.changed();}
      select(refs);api.paint();
    }
    function cancel(){if(drag){restore(drag.before);drag=null;}marquee=null;api.paint();}
    function action(name,value){
      if(name==='seat-table'){
        const ref=refs.length===1&&refs[0].kind==='seat'?refs[0]:null;
        if(ref&&(value===''||read().roomLayout.tables.some(t=>t.id===value))){change(()=>S.reparentSeat(read(),ref.id,value||null));select([ref]);}return true;
      }
      if(name==='select-all'){select(S.objects(read()).map(o=>({kind:o.kind,id:o.id})));return true;}
      if(name==='pending-pin'){pin=Number(value);api.selected(refs);return true;}
      if(name==='delete'){if(!refs.length||refs[0].kind==='bounds')return true;change(()=>S.remove(read(),refs));select([]);api.feedback('已移除所選物件，可使用「復原」還原。');return true;}
      if(name==='duplicate'){change(()=>{refs=S.duplicate(read(),refs);});select(refs);return true;}
      if(name==='detach-table'){change(()=>{for(const ref of refs.filter(r=>r.kind==='table')){const ids=[...read().roomLayout.tables.find(t=>t.id===ref.id).seatIds];ids.forEach(id=>S.reparentSeat(read(),id,null));S.remove(read(),[ref]);}});select([]);return true;}
      if(name==='add-seat'){change(()=>{refs=[S.addSeat(read(),refs.find(r=>r.kind==='table')?.id)];});select(refs);return true;}
      if(['add-table','add-round','add-u'].includes(name)){change(()=>{refs=[S.addTable(read(),name==='add-round'?'round':name==='add-u'?'u':'rect')];});select(refs);api.reveal();return true;}
      if(name==='add-path'){change(()=>{const id='path-'+SM.classData.id();read().roomLayout.paths.push({id,x:35,y:40,width:30,height:8,rotation:0,label:'主要通道'});refs=[{kind:'path',id}];});select(refs);return true;}
      if(name==='restore-marker'){change(()=>{const m=read().classroomGeometry.markers.find(m=>m.id===value);if(m)m.visible=true;refs=[{kind:'marker',id:value}];});select(refs);api.reveal();return true;}
      if(name==='locate-issue'){const error=S.issues(read())[0]||'',o=S.objects(read()).find(o=>error.includes(o.id));if(o){select([{kind:o.kind,id:o.id}]);api.reveal();}return true;}
      if(name==='auto-seats'){change(()=>{for(const r of refs.filter(r=>r.kind==='table')){const t=read().roomLayout.tables.find(t=>t.id===r.id);t.seatPositions=SM.roomLayout.autoSeatPositions(t,t.seatIds).map(p=>({...p,width:42,height:32}));}});return true;}
      if(name==='left'||name==='right'){if(!refs.length||refs[0].kind==='bounds')return false;change(()=>{const b=groupBox(),da=name==='left'?-90:90;for(const r of refs){const o=S.box(read(),r),p=S.rotate(o.x-b.x,o.y-b.y,da);S.setBox(read(),r,{...o,x:b.x+p.x,y:b.y+p.y,rotation:S.angle(o.rotation+da)});}});return true;}
      if(name==='align-x'||name==='align-y'){if(refs.length>1)change(()=>{const b=groupBox();for(const r of refs){const o=S.box(read(),r);S.setBox(read(),r,{...o,[name==='align-x'?'x':'y']:b[name==='align-x'?'x':'y']});}});return true;}
      return false;
    }
    function key(event){if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();action('delete');return true;}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='a'){event.preventDefault();action('select-all');return true;}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='d'){event.preventDefault();action('duplicate');return true;}if(event.key==='Escape'){event.preventDefault();if(drag||marquee)cancel();else select([]);return true;}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)&&refs.length&&refs[0].kind!=='bounds'){event.preventDefault();const delta=event.shiftKey?10:1;change(()=>{for(const r of refs){const b=S.box(read(),r);S.setBox(read(),r,{...b,x:b.x+(event.key==='ArrowLeft'?-delta:event.key==='ArrowRight'?delta:0),y:b.y+(event.key==='ArrowUp'?-delta:event.key==='ArrowDown'?delta:0)});}});return true;}return false;}
    function overlay(host,camera){
      const b=groupBox(),html=[];document.querySelectorAll('[data-drawing-kind]').forEach(n=>n.classList.toggle('drawing-selected',refs.some(r=>r.kind===n.dataset.drawingKind&&r.id===n.dataset.drawingId)));
      if(b){const p=C.toScreen(camera,b),small=b.width*camera.scale<85||b.height*camera.scale<65,bounds=refs[0]?.kind==='bounds',table=refs.length===1&&refs[0].kind==='table'?read().roomLayout.tables.find(t=>t.id===refs[0].id):null;
        const handles=(bounds||!small?['nw','n','ne','e','se','s','sw','w']:['se']).map(h=>`<span class="geometry-handle handle-${h}" data-geometry-handle="${h}" aria-hidden="true"></span>`).join('')+(bounds?'':'<span class="geometry-handle handle-rotate" data-geometry-handle="rotate"></span>');
        const extras=table?.type==='u'?'<span class="geometry-handle handle-opening" data-geometry-handle="opening">↧</span><span class="geometry-handle handle-thickness" data-geometry-handle="thickness"></span>':table?.type==='round'?'<span class="geometry-handle handle-radius" data-geometry-handle="radius"></span>':'';
        html.push(`<div class="canvas-selection ${bounds?'geometry-bounds-selection':''}" style="left:${p.x}px;top:${p.y}px;width:${b.width*camera.scale}px;height:${b.height*camera.scale}px;transform:translate(-50%,-50%) rotate(${b.rotation}deg)">${handles}${extras}</div>`);
        if(bounds){const ratio=Math.round(b.width/b.height*100)/100;html.push(`<div class="room-shape-hud" style="left:${Math.max(8,p.x-b.width*camera.scale/2+20)}px;top:${Math.max(8,p.y-b.height*camera.scale/2+20)}px"><strong>教室形狀 · ${Math.round(b.width)} : ${Math.round(b.height)} (${ratio}:1)</strong>${['4:3','16:9','1:1','3:4'].map(r=>`<button type="button" data-room-ratio="${r}">${r}</button>`).join('')}</div>`);}
        if(table){const q=C.toScreen(camera,{x:b.x+b.width/2,y:b.y});html.push(`<button class="drawing-add-seat" data-drawing-action="add-seat" style="left:${q.x+20}px;top:${q.y}px" title="新增座位 / Add seat">＋</button>`);}
      }
      if(marquee){const a=C.toScreen(camera,marquee.start),b=C.toScreen(camera,marquee.end);html.push(`<div class="drawing-marquee" style="left:${Math.min(a.x,b.x)}px;top:${Math.min(a.y,b.y)}px;width:${Math.abs(a.x-b.x)}px;height:${Math.abs(a.y-b.y)}px"></div>`);}
      host.innerHTML=html.join('');
    }
    function inspector(){const r=refs[0],button=(a,t)=>`<button class="button button-secondary" type="button" data-drawing-action="${a}">${t}</button>`;let html='<p class="drawing-hint">直接點選、拖拉控制點調整；Delete 刪除，Shift 多選。</p>';
      if(refs.length)html+=`<strong>${refs.length>1?'已選取 '+refs.length+' 個物件':({table:'桌組',seat:'座位',path:'主要通道',marker:'教室標記',bounds:'教室形狀'})[r.kind]}</strong>`;
      if(r?.kind!=='bounds'&&refs.length)html+=button('delete','刪除所選物件')+button('duplicate','複製')+button('left','↶ 90°')+button('right','↷ 90°');
      if(r?.kind==='table')html+=button('add-seat','＋ 新增一席')+button('auto-seats','沿桌邊平均排列')+button('detach-table','只移除桌面，保留座位');
      if(refs.length===1&&r.kind==='seat'){
        const current=S.box(read(),r)?.tableId||'',esc=SM.ui.escapeHtml;
        html+=`<label>座位歸屬 <select id="drawingSeatTable"><option value="">獨立座位</option>${read().roomLayout.tables.map((t,i)=>`<option value="${esc(t.id)}" ${current===t.id?'selected':''}>${i+1} 桌</option>`).join('')}</select></label><small>拖曳保留歸屬；在此指定轉桌或獨立席。</small>`;
      }
      if(refs.length>1)html+=button('align-x','水平置中對齊')+button('align-y','垂直置中對齊');
      if(S.issues(read()).length)html+=button('locate-issue','定位第一個幾何問題');
      const hidden=read().classroomGeometry.markers.filter(m=>!m.visible);if(hidden.length)html+='<details><summary>隱藏的教室標記</summary>'+hidden.map(m=>`<button class="button" type="button" data-drawing-action="restore-marker" data-value="${m.id}">${({board:'黑板',door:'門',teacher:'老師座位'})[m.type]}</button>`).join('')+'</details>';
      if(read().pendingSeatPins.length)html+='<p class="is-error">預排需要重新指定：先點學生，再點座位。</p>'+read().pendingSeatPins.map(n=>`<button type="button" class="button" data-drawing-action="pending-pin" data-value="${n}" aria-pressed="${pin===n}">${n} 號・待安排</button>`).join('');
      return html;
    }
    return{select,hit,down,move,up,cancel,key,action,overlay,inspector,groupBox,get refs(){return refs;},get dragging(){return !!drag||!!marquee;},get stable(){return drag?.before||null;}};
  }
  SM.drawingObjects={create};
})();
