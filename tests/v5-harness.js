const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
module.exports=function(){
  const values=new Map(),control={deny:false};
  const context={window:{crypto:require('node:crypto').webcrypto,setTimeout},setTimeout,clearTimeout,AbortController,console,localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>{if(control.deny)throw new Error('QuotaExceededError');values.set(key,value);},removeItem:key=>values.delete(key)}};
  vm.createContext(context);
  for(const name of ['constants','seat-engine','class-data','storage','room-layout','seating-constraints','constrained-arranger'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',name+'.js'),'utf8'),context);
  const SM=context.window.SeatMaster;
  function state(count=4,rows=1,cols=count){const s=SM.createDefaultState();s.config=SM.engine.normalizeConfig({...s.config,rows,cols,maxNumber:count,emptyNumbers:'',femaleStart:count+1});s.seats=SM.engine.buildSeatGrid(s.config,[]);SM.classData.ensure(s);return s;}
  function pair(s,a,b,relations=['notAdjacent']){const identity=n=>s.rosterIdentity.find(row=>row.number===n).studentId;s.seatingConstraints.pairs.push({id:SM.classData.id(),studentAId:identity(a),studentBId:identity(b),relations,enabled:true});}
  return {SM,context,values,control,state,pair};
};
