const assert=require('node:assert/strict');const {SM,state,pair}=require('./v5-harness')();
async function main(){
  let s=state(2,1,3);pair(s,1,2);const before=JSON.stringify(s);
  for(let i=0;i<50;i++){const result=await SM.constrainedArranger.solve(s);assert.equal(result.status,'solved');assert.equal(SM.seatingConstraints.validateAssignment(s,result.assignment).valid,true);}
  assert.equal(JSON.stringify(s),before,'solver does not mutate state');
  assert.throws(()=>SM.engine.arrange(s),'sync entry cannot bypass rules');
  s=state(2,1,2);pair(s,1,2);assert.equal((await SM.constrainedArranger.solve(s)).status,'unsatisfiable');
  s=state(4,2,2);pair(s,1,2);assert.equal((await SM.constrainedArranger.solve(s)).status,'unsatisfiable');
  s=state(3,1,3);pair(s,1,2);s.seats[0].pin=1;s.seats[1].pin=2;assert.equal((await SM.constrainedArranger.solve(s)).status,'unsatisfiable');
  s=state(4,1,4);pair(s,1,2);assert.equal((await SM.constrainedArranger.solve(s,{maxNodes:0})).status,'timeout');
  const controller=new AbortController();controller.abort();assert.equal((await SM.constrainedArranger.solve(s,{signal:controller.signal})).status,'cancelled');
  const midflight=new AbortController();let clock=0;
  assert.equal((await SM.constrainedArranger.solve(s,{signal:midflight.signal,clock:()=>clock+=10,yieldControl:async()=>midflight.abort()})).status,'cancelled');
  s=state(4,1,4);s.config.femaleStart=3;s.seats.forEach((seat,index)=>seat.type=index<2?'male':'female');pair(s,1,2);
  assert.equal((await SM.constrainedArranger.solve(s)).status,'unsatisfiable','gender capacity alone does not guarantee separation feasibility');
  s.seats.forEach((seat,index)=>seat.type=index%2===0?'male':'female');s.seats[0].pin=1;
  assert.equal((await SM.constrainedArranger.solve(s)).status,'solved');
  // Exhaustive oracle for small line-shaped classrooms, with and without pins.
  function* permutations(values){if(!values.length){yield [];return;}for(const value of values)for(const tail of permutations(values.filter(v=>v!==value)))yield [value,...tail];}
  for(let count=2;count<=6;count++)for(let ruleMask=1;ruleMask<8;ruleMask++){
    s=state(count,1,count);for(let b=2;b<=Math.min(count,4);b++)if(ruleMask&(1<<(b-2)))pair(s,1,b);
    let feasible=false;for(const order of permutations(Array.from({length:count},(_,i)=>i+1))){const assignment=Object.fromEntries(s.seats.map((seat,i)=>[seat.id,order[i]]));if(SM.seatingConstraints.validateAssignment(s,assignment).valid){feasible=true;break;}}
    const result=await SM.constrainedArranger.solve(s);assert.equal(result.status,feasible?'solved':'unsatisfiable',`count=${count}, mask=${ruleMask}`);
  }
  s=state(30,6,5);for(let n=2;n<=12;n++)pair(s,1,n);for(let n=14;n<28;n+=2)pair(s,n,n+1);
  for(let run=0;run<10;run++){const result=await SM.constrainedArranger.solve(s);assert.equal(result.status,'solved');assert.equal(SM.seatingConstraints.validateAssignment(s,result.assignment).valid,true);}
  console.log('constrained solver: oracle, repeated draws, fixed conflicts, timeout, cancellation and 30-student cases passed');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
