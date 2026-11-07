(function(){
  'use strict';
  const SM=window.SeatMaster,C=SM.seatingConstraints,D=SM.classData,$=id=>document.getElementById(id),esc=value=>SM.ui.escapeHtml(String(value ?? ''));
  let api,edges=[],topologySignature='',editingRuleId=null;
  const say=C.say;
  function labels(state){const roster=SM.engine.buildStudents(state.config),names=SM.engine.parseStudentNames(state.config.studentData,roster);return new Map((state.rosterIdentity||[]).map(row=>[row.studentId,row.number===null?say('已離開目前名單','Not in current roster'):`${row.number} ${names.get(row.number)||''}`]));}
  function render(){
    if(!api)return;
    if(document.body.classList.contains('presentation-mode')){for(const id of ['separationRules','ruleStudentA','ruleStudentB','separationStatus','topologyPreview','topologyEdges'])$(id).replaceChildren();return;}
    const state=api.getState(),names=labels(state),search=$('ruleSearch').value.toLocaleLowerCase();
    const activeNumbers=new Set(SM.engine.buildStudents(state.config).map(s=>s.number));
    const identities=state.rosterIdentity.filter(row=>activeNumbers.has(row.number));
    for(const id of ['ruleStudentA','ruleStudentB']){const prior=$(id).value;$(id).innerHTML=identities.filter(row=>row.studentId===prior||(names.get(row.studentId)||'').toLocaleLowerCase().includes(search)).map(row=>`<option value="${esc(row.studentId)}">${esc(names.get(row.studentId))}</option>`).join('');if([...$(id).options].some(o=>o.value===prior))$(id).value=prior;}
    if($('ruleStudentB').options.length>1&&$('ruleStudentB').value===$('ruleStudentA').value)$('ruleStudentB').selectedIndex=1;
    const active=new Set(C.activeRules(state).map(rule=>rule.id));
    $('separationRules').innerHTML=state.seatingConstraints.pairs.map(rule=>`<div class="separation-rule"><label><input type="checkbox" data-rule-toggle="${esc(rule.id)}" ${rule.enabled?'checked':''} /><span>${esc(names.get(rule.studentAId))} ↔ ${esc(names.get(rule.studentBId))} · ${rule.relations.map(relation=>relation==='notAdjacent'?say('不相鄰','Not adjacent'):say('不同桌組','Different tables')).join(' / ')}${rule.enabled&&!active.has(rule.id)?' · '+say('暫不參與排位','Inactive for seating'):''}</span></label><button class="button button-secondary" data-rule-edit="${esc(rule.id)}">${say('編輯','Edit')}</button><button class="button button-quiet" data-rule-delete="${esc(rule.id)}">${say('刪除','Delete')}</button></div>`).join('')||`<p>${say('尚未設定配對規則。','No separation rules yet.')}</p>`;
    const assignment=state.hasDrawn?state.assignment:state.manualDraft||Object.fromEntries(state.seats.filter(s=>s.pin).map(s=>[s.id,s.pin]));
    const report=C.validateAssignment(state,assignment,{partial:!state.hasDrawn});
    $('separationStatus').textContent=`${state.seatingConstraints.pairs.length} `+say('項規則','rules')+' · '+(report.valid?say('目前沒有規則衝突。','No current rule conflicts.'):report.errors.join(' '));
    $('separationStatus').classList.toggle('is-error',!report.valid);
    if(!report.valid)$('separationDetails').open=true;
    if(state.hasDrawn&&!C.validateAssignment(state,state.assignment).valid)document.getElementById('workflowResult').textContent=say('舊結果與目前規則不符，請重新編排','Previous seating conflicts with current rules; rearrange');
  }
  function checkpoint(candidate){const e=candidate.classes.find(c=>c.id===candidate.activeClassId);if(e.state.hasDrawn)D.addRecord(e,say('修改規則前排位','Seating before rule changes'));return e.state;}
  function drawTopology(){
    const state=api.getState(),nodes=C.points(state),byId=new Map(nodes.map(p=>[p.id,p]));
    $('topologyPreview').innerHTML=`<svg viewBox="-5 -5 110 110" role="img" aria-label="${say('座位鄰接圖','Seat adjacency map')}">${edges.map(([a,b])=>byId.has(a)&&byId.has(b)?`<line x1="${byId.get(a).x}" y1="${byId.get(a).y}" x2="${byId.get(b).x}" y2="${byId.get(b).y}" stroke="#9d6a34" stroke-width=".5"/>`:'').join('')}${nodes.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="1.5" fill="#36513a"/><text x="${p.x+1.7}" y="${p.y-1.5}" font-size="2.5">${esc(p.id)}</text>`).join('')}</svg>`;
    $('topologyEdges').innerHTML=edges.map(([a,b],index)=>`<label><input type="checkbox" data-topology-edge="${index}" checked />${esc(a)} ↔ ${esc(b)}</label>`).join('');
    for(const id of ['topologySeatA','topologySeatB'])$(id).innerHTML=nodes.map(node=>`<option value="${esc(node.id)}">${esc(node.id)}</option>`).join('');
    if($('topologySeatB').options.length>1)$('topologySeatB').selectedIndex=1;
    $('topologyConfirm').disabled=!state.roomLayout;
    $('topologyNotice').textContent=state.roomLayout?say('請檢查連線後確認；改動布局後需重新確認。','Review and confirm edges. Layout changes require reconfirmation.'):say('網格固定採八方向相鄰；此預覽不可修改。','Grid uses eight-direction adjacency. This preview is fixed.');
    $('topologyAddEdge').disabled=$('topologySuggest').disabled=!state.roomLayout;
    document.querySelectorAll('[data-topology-edge]').forEach(node=>{node.disabled=!state.roomLayout;});
  }
  function openTopology(){const state=api.getState();topologySignature=C.signature(state);edges=state.roomLayout&&state.seatTopology?.signature===topologySignature?D.clone(state.seatTopology.edges):C.suggest(state);drawTopology();$('topologyDialog').showModal();}
  function init(callbacks){api=callbacks;
    $('ruleSearch').addEventListener('input',render);
    $('saveSeparationRule').addEventListener('click',()=>{
      const a=$('ruleStudentA').value,b=$('ruleStudentB').value,relations=[$('ruleNotAdjacent').checked?'notAdjacent':null,$('ruleNotSameTable').checked?'notSameTable':null].filter(Boolean);
      if(!a||!b||a===b||!relations.length){SM.ui.showToast(say('請選兩位不同學生及至少一種規則。','Choose two different students and at least one rule.'),'error');return;}
      const changed=api.commit(candidate=>{const state=checkpoint(candidate),pairs=state.seatingConstraints.pairs,key=C.edgeKey(a,b),duplicate=pairs.find(rule=>C.edgeKey(rule.studentAId,rule.studentBId)===key),existing=duplicate||pairs.find(rule=>rule.id===editingRuleId);if(existing){existing.studentAId=a;existing.studentBId=b;existing.relations=relations;existing.enabled=true;}else pairs.push({id:D.id(),studentAId:a,studentBId:b,relations,enabled:true});if(duplicate&&editingRuleId&&duplicate.id!==editingRuleId)state.seatingConstraints.pairs=pairs.filter(rule=>rule.id!==editingRuleId);});
      if(changed)editingRuleId=null;
      SM.onboarding.markMeaningfulActivity();render();
    });
    $('separationRules').addEventListener('change',event=>{const id=event.target.dataset.ruleToggle;if(id)api.commit(candidate=>{checkpoint(candidate).seatingConstraints.pairs.find(rule=>rule.id===id).enabled=event.target.checked;});});
    $('separationRules').addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;const id=button.dataset.ruleDelete||button.dataset.ruleEdit,rule=api.getState().seatingConstraints.pairs.find(r=>r.id===id);if(!rule)return;
      if(button.dataset.ruleEdit){editingRuleId=rule.id;$('ruleSearch').value='';render();$('ruleStudentA').value=rule.studentAId;$('ruleStudentB').value=rule.studentBId;$('ruleNotAdjacent').checked=rule.relations.includes('notAdjacent');$('ruleNotSameTable').checked=rule.relations.includes('notSameTable');$('ruleStudentA').focus();}
      else if(window.confirm(say('刪除這項分開安排規則？','Delete this separation rule?')))api.commit(candidate=>{const state=checkpoint(candidate);state.seatingConstraints.pairs=state.seatingConstraints.pairs.filter(r=>r.id!==id);});
    });
    $('openTopologyButton').addEventListener('click',openTopology);
    $('topologySuggest').addEventListener('click',()=>{edges=C.suggest(api.getState());drawTopology();});
    $('topologyEdges').addEventListener('change',event=>{const index=event.target.dataset.topologyEdge;if(index!==undefined){edges.splice(Number(index),1);drawTopology();}});
    $('topologyAddEdge').addEventListener('click',()=>{const a=$('topologySeatA').value,b=$('topologySeatB').value;if(a&&b&&a!==b&&!edges.some(edge=>C.edgeKey(...edge)===C.edgeKey(a,b))){edges.push([a,b]);drawTopology();}});
    $('topologyConfirm').addEventListener('click',()=>{if(C.signature(api.getState())!==topologySignature){$('topologyNotice').textContent=say('布局已變更，請重新開啟預覽。','Layout changed. Reopen the preview.');return;}if(api.commit(candidate=>{checkpoint(candidate).seatTopology={confirmed:true,signature:topologySignature,edges:D.clone(edges)};}))$('topologyDialog').close();});
    $('reviewRosterButton').addEventListener('click',async()=>{const config=D.clone(api.getState().config),choices=await SM.classRecordsUI.reviewRoster(config);if(choices)api.commit(candidate=>{D.applyIdentity(checkpoint(candidate),config,choices);});});
    window.addEventListener('seatmaster:languagechange',render);render();
  }
  SM.separationUI={init,render,openTopology};
})();
