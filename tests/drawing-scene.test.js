const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const values=new Map(),ctx={window:{crypto:require('node:crypto').webcrypto,setTimeout},setTimeout,AbortController,localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}};vm.createContext(ctx);
for(const file of ['constants','seat-engine','class-data','classroom-geometry','room-layout','drawing-scene','storage','seating-constraints','constrained-arranger','layout-planner'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file+'.js'),'utf8'),ctx);
const SM=ctx.window.SeatMaster,S=SM.drawingScene;
function state(n=4,rows=2,cols=2){const s=SM.createDefaultState();s.config=SM.engine.normalizeConfig({...s.config,rows,cols,maxNumber:n,emptyNumbers:'',femaleStart:3});s.seats=SM.engine.buildSeatGrid(s.config,[]);SM.classData.ensure(s);S.upgrade(s);return s;}
(async()=>{
  const s=state();assert.equal(S.valid(s),true);assert.equal(S.objects(s).filter(o=>o.kind==='seat').length,4);
  const first=s.seats[0].id;s.seats[0].pin=1;S.remove(s,[{kind:'seat',id:first}]);assert.deepEqual(Array.from(s.pendingSeatPins),[1]);assert.equal(s.seats.some(x=>x.id===first),false);
  assert.equal((await SM.layoutPlanner.prepare(s)).status,'invalid','a deleted preassignment must not be silently cancelled');
  const empty=state();S.remove(empty,empty.seats.map(x=>({kind:'seat',id:x.id})));assert.equal(S.valid(empty),true);assert.equal(S.normalize(empty.roomLayout).tables.length,0);assert.equal(S.normalize(empty.roomLayout).looseSeats.length,0);
  const table=S.addTable(empty),t=empty.roomLayout.tables[0],known=JSON.stringify(t.seatPositions);const extra=S.addSeat(empty,t.id);assert.equal(JSON.stringify(t.seatPositions.slice(0,4)),known,'adding a chair preserves hand-positioned existing chairs');
  const id=t.seatIds[1];S.remove(empty,[{kind:'seat',id}]);assert.equal(t.seatIds.includes(id),false);assert.equal(t.seatIds.includes(extra.id),true);
  const b=S.box(empty,table),seatId=t.seatIds[0],chairBefore=S.box(empty,{kind:'seat',id:seatId});S.setBox(empty,table,{...b,width:b.width*1.4,rotation:33});const chairAfter=S.box(empty,{kind:'seat',id:seatId});assert.equal(chairAfter.width,chairBefore.width);
  const position={...chairAfter,x:chairAfter.x+34,y:chairAfter.y-21};S.setBox(empty,{kind:'seat',id:seatId},position);const roundTrip=S.box(empty,{kind:'seat',id:seatId});assert.ok(Math.abs(roundTrip.x-position.x)<1e-8&&Math.abs(roundTrip.y-position.y)<1e-8);
  S.reparentSeat(empty,seatId,null);assert.equal(S.valid(empty),true);assert.ok(empty.roomLayout.looseSeats.some(p=>p.id===seatId));
  const duplicate=S.duplicate(empty,[table,{kind:'seat',id:t.seatIds[0]}]);assert.equal(duplicate.length,1,'parent and child must not duplicate twice');assert.equal(S.valid(empty),true);
  const markers=S.duplicate(empty,[{kind:'marker',id:'teacher'}]);assert.equal(markers.length,1);assert.equal(SM.classroomGeometry.valid(empty.classroomGeometry),true);
  const base=state(),draft=S.clone(empty);const workspace={version:5,activeClassId:'c',classes:[{id:'c',state:{...base,layoutDraft:draft}}]};assert.equal(SM.storage.save(workspace).ok,true);const disk=JSON.parse(values.get(SM.constants.STORAGE_KEY));assert.equal(disk.version,7);assert.equal(disk.classes[0].state.seats.length,4);assert.ok(disk.classes[0].state.layoutDraft);assert.ok(SM.storage.load());
  const grid=state(9,3,3),edges=JSON.stringify(S.edges(grid).map(JSON.stringify).sort());assert.equal(S.edges(grid).length,20,'eight-direction neighbors include diagonals');
  for(const o of S.objects(grid).filter(o=>o.kind==='seat')){const p=S.rotate(o.x-600,o.y-450,37);S.setBox(grid,{kind:'seat',id:o.id},{...o,x:600+p.x,y:450+p.y,rotation:o.rotation+37});}
  assert.equal(JSON.stringify(S.edges(grid).map(JSON.stringify).sort()),edges,'rotating a scene must not change adjacency');
  const ready=state();const outcome=await SM.layoutPlanner.prepare(ready);assert.equal(outcome.status,'solved');assert.equal(outcome.state.hasDrawn,false);assert.equal(outcome.state.seatTopology.confirmed,true);assert.ok(Object.keys(outcome.state.genderPlan.preferences).length);
  const pair=ready.rosterIdentity.slice(0,2);ready.seatingConstraints.pairs=[{id:'rule',studentAId:pair[0].studentId,studentBId:pair[1].studentId,relations:['notAdjacent'],enabled:true}];ready.seats[0].pin=1;ready.seats[1].pin=2;assert.notEqual((await SM.layoutPlanner.prepare(ready)).status,'solved');assert.equal(ready.seats[0].pin,1);
  console.log('Drawing scene: exact deletion, empty layout, chair identity, transforms, grouping, v7 drafts and constrained completion passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
