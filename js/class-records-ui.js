(function () {
  'use strict';
  const SM=window.SeatMaster, D=SM.classData, $=id=>document.getElementById(id);
  const say=(zh,en)=>SM.i18n.getLanguage()==='en'?en:zh, esc=value=>SM.ui.escapeHtml(String(value ?? ''));
  let api, identityResolve=null, identityChoices=[], collisionResolve=null;
  function translate() {document.querySelectorAll('[data-v5]').forEach(node=>{node.textContent=node.dataset.v5.split('|')[SM.i18n.getLanguage()==='en'?1:0];});}
  function entry() {return api.getEntry();}
  function render() {
    if(!api)return;translate();
    const current=entry();D.initializeEntry(current);
    const same=current.records.some(record=>D.matches(current,record));
    $('classRecordStatus').textContent=(same?say('已有相同內容的班級紀錄','Matching class record saved'):say('目前為編輯草稿；可另存具名紀錄','Working draft; save a named record'))+` · ${current.records.length} `+say('筆紀錄','records')+(current.meta.archivedAt?' · '+say('已封存','Archived'):'');
    $('classAcademicYear').value=current.meta.academicYear;$('classTerm').value=current.meta.term;
    if(!$('classLibraryDialog').open)return;
    const showArchived=$('showArchivedClasses').checked;
    $('classLibraryList').innerHTML=api.getWorkspace().classes.filter(c=>showArchived||!c.meta?.archivedAt).map(c=>{
      D.initializeEntry(c);
      const students=SM.engine.buildStudents(c.state.config).length, count=c.state.seatingConstraints?.pairs.length || 0;
      const recent=c.records[0], time=recent?.savedAt?new Date(recent.savedAt).toLocaleString():say('舊版基線／尚無具名儲存','Legacy baseline / no named save');
      return `<article class="library-card"><h3>${esc(c.state.config.className)} ${c.meta.archivedAt?`<small>${say('封存','Archived')}</small>`:''}</h3><p>${esc(c.meta.academicYear)} ${esc(c.meta.term)} · ${students} ${say('位學生','students')} · ${count} ${say('項規則','rules')}</p><small>${esc(time)}</small><div class="class-actions"><button class="button button-primary" data-open-class="${esc(c.id)}">${say('繼續編輯','Continue editing')}</button><button class="button button-secondary" data-backup-class="${esc(c.id)}">${say('單班備份','Back up class')}</button><button class="button button-secondary" data-archive-class="${esc(c.id)}">${c.meta.archivedAt?say('解除封存','Unarchive'):say('封存','Archive')}</button></div><label class="field"><span>${say('歷次紀錄（還原整份版本）','Records (restore complete version)')}</span><select data-record-select="${esc(c.id)}">${c.records.map(record=>`<option value="${esc(record.id)}">${esc(record.label)} · ${esc(record.savedAt?new Date(record.savedAt).toLocaleString():say('舊版基線','Legacy baseline'))}</option>`).join('')}</select></label><div class="class-actions"><button class="button button-secondary" data-restore-class="${esc(c.id)}" ${c.records.length?'':'disabled'}>${say('預覽並開啟紀錄','Preview and open record')}</button><button class="button button-quiet" data-delete-record="${esc(c.id)}" ${c.records.length?'':'disabled'}>${say('刪除此紀錄','Delete record')}</button></div></article>`;
    }).join('') || `<p>${say('沒有符合的班級。','No matching classes.')}</p>`;
  }
  function openSave(){ $('classRecordName').value=new Date().toLocaleDateString()+' '+say('座位規劃','Seating plan');$('saveClassDialog').showModal();$('classRecordName').focus(); }
  function checkpoint(candidate,label){D.addRecord(candidate.classes.find(c=>c.id===candidate.activeClassId),label);}
  function reviewRoster(config) {
    identityChoices=D.identityChoices(api.getState(),config);
    const old=api.getState().rosterIdentity || [];
    $('rosterIdentityRows').innerHTML=identityChoices.map((row,index)=>`<label class="identity-row"><span>${row.number} ${esc(row.name)}</span><select data-identity-index="${index}"><option value="">${say('新學生身分','New student identity')}</option>${old.map(item=>`<option value="${esc(item.studentId)}" ${item.studentId===row.studentId?'selected':''}>${item.number ?? '—'} ${esc(item.nameAtMatch || '')}</option>`).join('')}</select></label>`).join('');
    $('rosterIdentityError').textContent='';$('rosterIdentityDialog').showModal();
    return new Promise(resolve=>{identityResolve=resolve;});
  }
  function chooseImport(incoming) {
    const existing=new Set(api.getWorkspace().classes.map(c=>c.id)), matches=incoming.classes.filter(c=>existing.has(c.id));
    if(!matches.length)return Promise.resolve({});
    $('importCollisionRows').innerHTML=matches.map(c=>`<label class="field"><span>${esc(c.state.config.className)}</span><select data-import-class="${esc(c.id)}"><option value="copy">${say('另建副本','Create another class')}</option><option value="update">${say('更新原班（先保留舊版本）','Update original (preserve current version)')}</option></select></label>`).join('');
    $('importCollisionDialog').showModal();return new Promise(resolve=>{collisionResolve=resolve;});
  }
  function init(callbacks) {
    api=callbacks;
    document.querySelectorAll('[data-close-v5]').forEach(button=>button.addEventListener('click',()=>$(button.dataset.closeV5).close()));
    $('classLibraryButton').addEventListener('click',()=>{$('classLibraryDialog').showModal();render();});
    $('showArchivedClasses').addEventListener('change',render);
    $('saveClassButton').addEventListener('click',openSave);
    $('backupClassButton').addEventListener('click',()=>backup(entry()));
    $('saveClassRecordButton').addEventListener('click',()=>{
      const label=$('classRecordName').value.trim();if(!label){$('classRecordName').focus();return;}
      let added=false;
      if(api.commit(candidate=>{added=D.addRecord(candidate.classes.find(c=>c.id===candidate.activeClassId),label);})){ $('saveClassDialog').close();SM.ui.showToast(added?say('班級紀錄已儲存，可在「我的班級」開啟。','Class record saved. Open it in My classes.'):say('已有相同內容的紀錄，不重複建立。','An identical record already exists.')); }
    });
    for(const [id,key]of [['classAcademicYear','academicYear'],['classTerm','term']])$(id).addEventListener('change',()=>{const value=$(id).value.trim().slice(0,20);api.commit(candidate=>{const current=candidate.classes.find(c=>c.id===candidate.activeClassId);current.meta[key]=value;current.meta.updatedAt=new Date().toISOString();});});
    $('classLibraryList').addEventListener('click',event=>{
      const button=event.target.closest('button');if(!button)return;
      const id=button.dataset.openClass||button.dataset.backupClass||button.dataset.archiveClass||button.dataset.restoreClass||button.dataset.deleteRecord;
      const source=api.getWorkspace().classes.find(c=>c.id===id);if(!source)return;
      if(button.dataset.openClass){if(source.meta.archivedAt&&!window.confirm(say('解除封存並繼續編輯？','Unarchive and continue editing?')))return;if(source.meta.archivedAt)api.commit(candidate=>{candidate.classes.find(c=>c.id===id).meta.archivedAt=null;});$('classLibraryDialog').close();api.switchClass(id);}
      else if(button.dataset.backupClass)backup(source);
      else if(button.dataset.archiveClass){if(!window.confirm(source.meta.archivedAt?say('解除封存此班？','Unarchive this class?'):say('封存此班？資料及紀錄仍保留。','Archive this class? Data and records are kept.')))return;api.commit(candidate=>{const c=candidate.classes.find(c=>c.id===id);c.meta.archivedAt=c.meta.archivedAt?null:new Date().toISOString();});}
      else {
        const select=[...document.querySelectorAll('[data-record-select]')].find(node=>node.dataset.recordSelect===id), record=source.records.find(r=>r.id===select.value);if(!record)return;
        if(button.dataset.deleteRecord){if(window.confirm(say(`刪除「${record.label}」？可用復原資料操作還原。`,`Delete “${record.label}”? Undo data operation is available.`)))api.commit(candidate=>{const c=candidate.classes.find(c=>c.id===id);c.records=c.records.filter(r=>r.id!==record.id);});return;}
        const oldCount=SM.engine.buildStudents(source.state.config).length,newCount=SM.engine.buildStudents(record.state.config).length;
        if(!window.confirm(say(`開啟「${record.label}」\n學生：${oldCount} → ${newCount}；規則：${source.state.seatingConstraints.pairs.length} → ${record.state.seatingConstraints.pairs.length}\n將還原整份名單、教室、規則與排位，先保留目前草稿。`,`Open “${record.label}”\nStudents: ${oldCount} → ${newCount}; rules: ${source.state.seatingConstraints.pairs.length} → ${record.state.seatingConstraints.pairs.length}\nRestore the whole version after preserving the current draft?`)))return;
        if(api.commit(candidate=>{const c=candidate.classes.find(c=>c.id===id);D.addRecord(c,say('開啟舊紀錄前的草稿','Draft before restore'));c.state=D.clone(record.state);if(record.meta){c.meta.academicYear=record.meta.academicYear||'';c.meta.term=record.meta.term||'';}candidate.activeClassId=id;}))$('classLibraryDialog').close();
      }
    });
    $('copyClassConfirm').addEventListener('click',()=>{$('copyClassDialog').close();api.copyClass($('copyClassContents').value==='all');});
    $('rosterIdentityConfirm').addEventListener('click',()=>{
      const rows=identityChoices.map((row,index)=>({...row,studentId:document.querySelector(`[data-identity-index="${index}"]`).value}));
      const chosen=rows.map(row=>row.studentId).filter(Boolean);
      if(new Set(chosen).size!==chosen.length){$('rosterIdentityError').textContent=say('同一原學生不能對應兩個新座號。','An original student cannot map to two new numbers.');return;}
      const resolve=identityResolve;identityResolve=null;$('rosterIdentityDialog').close();resolve?.(rows);
    });
    $('rosterIdentityDialog').addEventListener('close',()=>{identityResolve?.(null);identityResolve=null;});
    $('importCollisionConfirm').addEventListener('click',()=>{const choices=Object.fromEntries([...document.querySelectorAll('[data-import-class]')].map(node=>[node.dataset.importClass,node.value]));const resolve=collisionResolve;collisionResolve=null;$('importCollisionDialog').close();resolve?.(choices);});
    $('importCollisionDialog').addEventListener('close',()=>{collisionResolve?.(null);collisionResolve=null;});
    window.addEventListener('seatmaster:languagechange',()=>{translate();render();});render();
  }
  function backup(source){if(!window.confirm(SM.i18n.t('confirm.fullBackup')))return;SM.storage.exportClass(source);SM.ui.showToast(say('已下載單班完整檔案。','Full class backup downloaded.'));}
  SM.classRecordsUI={init,render,translate,openSave,reviewRoster,chooseImport,openCopy:()=>{$('copyClassContents').value='layout';$('copyClassDialog').showModal();}};
})();
