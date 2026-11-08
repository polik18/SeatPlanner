"""Real browser close/reopen, class versions, single-class portability and identity."""
import importlib.util,json,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
spec=importlib.util.spec_from_file_location('support',Path(__file__).with_name('v5-browser-support.py'));support=importlib.util.module_from_spec(spec);spec.loader.exec_module(support)
server,url=support.serve();errors=[]
try:
    with sync_playwright() as pw:
        profile=tempfile.mkdtemp(prefix='seatplanner-v5-profile-')
        context=pw.chromium.launch_persistent_context(profile,headless=True,viewport={'width':1280,'height':900},reduced_motion='reduce')
        page=context.pages[0];support.wire(page,errors);page.goto(url);support.seed(page)
        page.locator('#classAcademicYear').fill('115');page.locator('#classAcademicYear').press('Tab')
        page.locator('#classTerm').fill('1');page.locator('#classTerm').press('Tab')
        support.rule(page,1,2)
        page.locator('.admin-only .student-draw-open').click();page.locator('#studentDrawStart').click()
        page.wait_for_function('key=>{const w=JSON.parse(localStorage.getItem(key));return w.classes.find(c=>c.id===w.activeClassId).state.studentDrawRound?.history.length===1}',arg=support.KEY)
        page.locator('#studentDrawClose').click();support.save_record(page,'November seating')
        first=support.active(page);class_id=first['id'];record_id=first['records'][0]['id']
        support.save_record(page,'Duplicate')
        assert len(support.active(page)['records'])==1
        page.locator('#classNameInput').fill('Working draft');page.locator('#classNameInput').press('Tab')
        page.locator('#classTerm').fill('2');page.locator('#classTerm').press('Tab')
        support.active(page);context.close()
        # Browser process really closes, then reopens the same disk profile.
        context=pw.chromium.launch_persistent_context(profile,headless=True,viewport={'width':1280,'height':900},reduced_motion='reduce')
        page=context.pages[0];support.wire(page,errors);page.goto(url)
        expect(page.locator('#classNameInput')).to_have_value('Working draft')
        assert len(support.active(page)['state']['studentDrawRound']['history'])==1
        page.locator('#classLibraryButton').click();page.locator(f'[data-record-select="{class_id}"]').select_option(record_id);page.locator(f'[data-restore-class="{class_id}"]').click()
        expect(page.locator('#classNameInput')).to_have_value('Test class')
        expect(page.locator('#classTerm')).to_have_value('1')
        current=support.active(page);assert len(current['records'])==2
        assert current['state']['seatingConstraints']['pairs'][0]==first['state']['seatingConstraints']['pairs'][0]
        with page.expect_download() as event:page.locator('#backupClassButton').click()
        raw=Path(event.value.path()).read_bytes();exported=json.loads(raw)
        assert exported['format']=='seatplanner-class' and exported['version']==5 and len(exported['classes'])==1
        assert exported['classes'][0]['meta']['academicYear']=='115'
        # Save failure must not publish a record that never reached storage.
        page.evaluate('()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new Error("quota")}}')
        page.locator('#classNameInput').fill('Quota draft');page.locator('#classNameInput').press('Tab')
        support.save_record(page,'Must not save')
        expect(page.locator('#saveClassDialog')).to_be_visible();assert not any(record['label']=='Must not save' for record in support.active(page)['records'])
        page.locator('[data-close-v5="saveClassDialog"]').click();page.evaluate('()=>{Storage.prototype.setItem=window.originalSetItem}')
        page.locator('#classLibraryButton').click();page.locator(f'[data-archive-class="{class_id}"]').click()
        expect(page.locator(f'[data-open-class="{class_id}"]')).to_have_count(0)
        page.locator('#showArchivedClasses').check();expect(page.locator(f'[data-open-class="{class_id}"]')).to_be_visible()
        page.locator(f'[data-archive-class="{class_id}"]').click();page.locator('[data-close-v5="classLibraryDialog"]').click()
        # Layout-only copy is the safe default and has no roster/rules.
        page.locator('#duplicateClassButton').click();page.locator('#copyClassConfirm').click()
        copied=support.active(page);assert copied['id']!=class_id and not copied['state']['seatingConstraints']['pairs'];assert not copied['state']['rosterIdentity']
        page.locator('#classSelector').select_option(class_id)
        original_round=support.active(page)['state']['studentDrawRound']
        page.locator('#duplicateClassButton').click();page.locator('#copyClassContents').select_option('all');page.locator('#copyClassConfirm').click()
        assert support.active(page)['state']['studentDrawRound'] is None
        page.locator('.admin-only .student-draw-open').click();page.locator('#studentDrawStart').click()
        page.wait_for_function('key=>{const w=JSON.parse(localStorage.getItem(key));return w.classes.find(c=>c.id===w.activeClassId).state.studentDrawRound?.history.length===1}',arg=support.KEY)
        page.locator('#studentDrawClose').click();page.locator('#classSelector').select_option(class_id)
        assert support.active(page)['state']['studentDrawRound']==original_round
        # Changed names with rules require identity review; preserve student 1 explicitly.
        identities={row['number']:row['studentId'] for row in support.active(page)['state']['rosterIdentity'] if row['number'] is not None}
        page.locator('#studentDataInput').fill('座號\t姓名\n1\t阿明更正\n2\t小華\n3\t小安')
        page.locator('#studentDataInput').press('Tab')
        expect(page.locator('#rosterIdentityDialog')).to_be_visible();page.locator('[data-identity-index="0"]').select_option(identities[1]);page.locator('#rosterIdentityConfirm').click()
        assert next(row for row in support.active(page)['state']['rosterIdentity'] if row['number']==1)['studentId']==identities[1]
        # Single class backup restores records and rules into a clean browser.
        browser=pw.chromium.launch();fresh=browser.new_page(viewport={'width':360,'height':800});support.wire(fresh,errors);fresh.goto(url)
        fresh.locator('#importFileInput').set_input_files({'name':'class.json','mimeType':'application/json','buffer':raw})
        expect(fresh.locator('#welcomeDialog')).not_to_be_visible()
        restored=support.active(fresh);assert restored['id']==class_id and len(restored['records'])==2
        assert restored['state']['seatingConstraints']==exported['classes'][0]['state']['seatingConstraints']
        fresh.locator('#classLibraryButton').click();fresh.screenshot(path=str(support.ROOT/'test-results'/'v5-library-mobile.png'));fresh.locator('[data-close-v5="classLibraryDialog"]').click()
        # Same-ID import has an explicit update/copy choice.
        fresh.locator('#importFileInput').set_input_files({'name':'class.json','mimeType':'application/json','buffer':raw})
        expect(fresh.locator('#importCollisionDialog')).to_be_visible();fresh.locator('[data-import-class]').select_option('update');fresh.locator('#importCollisionConfirm').click()
        assert len(support.workspace(fresh)['classes'])==1
        browser.close();context.close();assert not errors,errors
        print('class records browser: disk reopen, snapshots, quota rollback, archive, identity and portable class backup passed')
finally:server.shutdown()
