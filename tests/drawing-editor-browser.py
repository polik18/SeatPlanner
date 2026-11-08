"""Direct object editing, exact Delete, draft isolation, completion and floating actions."""
import importlib.util
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
spec=importlib.util.spec_from_file_location('support',Path(__file__).with_name('v5-browser-support.py'));support=importlib.util.module_from_spec(spec);spec.loader.exec_module(support)
server,url=support.serve();errors=[]
def click(p,a):p.locator('[data-canvas-action="'+a+'"]').click()
def draft(p):return support.active(p)['state']
def drag(p,locator,dx,dy):
    box=locator.bounding_box();x,y=box['x']+box['width']/2,box['y']+box['height']/2
    p.mouse.move(x,y);p.mouse.down();p.mouse.move(x+dx,y+dy,steps=6);p.mouse.up()
try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch();page=browser.new_page(viewport={'width':1366,'height':900},reduced_motion='reduce');support.wire(page,errors);page.goto(url);support.seed(page,4,2,2)
        page.locator('#presentationButton').click()
        for _ in range(2):
            b=page.locator('#drawButton').bounding_box();assert b['y']>=0 and b['y']+b['height']<=900
            page.evaluate('window.scrollTo(0,document.body.scrollHeight)')
        page.evaluate('window.scrollTo(0,0)');page.screenshot(path=str(support.ROOT/'test-results'/'floating-presentation-actions.png'))
        page.locator('#presentationManualButton').click();assert not page.locator('body').evaluate('(e)=>e.classList.contains("presentation-mode")')
        page.locator('#homeButton').click()
        click(page,'edit');state=draft(page);assert state['roomLayout']['version']==3
        first=state['seats'][0]['id']
        page.locator('[data-drawing-id="'+first+'"]').click();page.keyboard.press('Delete')
        assert len(draft(page)['seats'])==3 and all(s['id']!=first for s in draft(page)['seats'])
        disk=support.workspace(page)['classes'][0]['state'];assert len(disk['seats'])==4 and len(disk['layoutDraft']['seats'])==3
        page.keyboard.press('Control+z');assert len(draft(page)['seats'])==4
        page.locator('[data-drawing-action="add-table"]').click();state=draft(page);table=state['roomLayout']['tables'][0];tid=table['id']
        # No table-mode switch: the surface itself is immediately draggable.
        plate=page.locator('[data-table-id="'+tid+'"] .room-table-surface')
        drag(page,plate,24,18);assert draft(page)['roomLayout']['tables'][0]['x']!=table['x']
        before=draft(page)['roomLayout']['tables'][0]['width'];drag(page,page.locator('#classroomSelection .handle-se'),25,20)
        assert draft(page)['roomLayout']['tables'][0]['width']>before
        assert len(draft(page)['roomLayout']['tables'][0]['seatIds'])==4
        drag(page,page.locator('#classroomSelection .handle-rotate'),30,20)
        assert draft(page)['roomLayout']['tables'][0]['rotation']!=0
        page.screenshot(path=str(support.ROOT/'test-results'/'drawing-object-table-edit.png'))
        page.keyboard.press('Control+a');page.keyboard.press('Delete');assert len(draft(page)['seats'])==0 and len(draft(page)['roomLayout']['tables'])==0
        click(page,'done');expect(page.locator('#classroomWorkspace')).to_be_visible();expect(page.locator('#canvasStatus')).to_have_class('is-error')
        page.reload();click(page,'edit');assert len(draft(page)['seats'])==0,'deleted seats must not be regenerated'
        page.locator('[data-drawing-action="add-table"]').click();draft(page)
        page.evaluate('()=>{window.savedSceneSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error("quota")};}')
        click(page,'done');expect(page.locator('#classroomWorkspace')).to_be_visible();expect(page.locator('#canvasStatus')).to_contain_text('無法保存')
        page.evaluate('()=>{Storage.prototype.setItem=window.savedSceneSetItem;}')
        click(page,'done')
        expect(page.locator('#classroomWorkspace')).not_to_be_visible()
        saved=draft(page);assert saved['layoutCheck']['status']=='ready' and saved['genderPlan']['preferences']
        assert not saved['hasDrawn'],'completion must not silently draw student seats'
        page.reload();assert len(draft(page)['seats'])==4
        page.locator('#presentationButton').click();page.locator('#drawButton').click();expect(page.locator('#drawButton')).to_be_enabled()
        assert len([n for n in draft(page)['assignment'].values() if n is not None])==4
        page.set_viewport_size({'width':390,'height':844});b=page.locator('#drawButton').bounding_box();assert b['y']+b['height']<=844
        page.screenshot(path=str(support.ROOT/'test-results'/'floating-presentation-phone.png'))
        # Deleting a pinned seat keeps the student's priority intent until reassigned.
        page.set_viewport_size({'width':1366,'height':900});support.seed(page,4,2,2)
        page.locator('[data-admin-mode="prearrange"]').click();page.locator('.seat[data-seat-id="0-0"]').click();page.locator('#pinStudentSelect').select_option('1');page.locator('#pinForm button[value="default"]').click()
        click(page,'edit');page.locator('[data-drawing-id="0-0"]').click();page.keyboard.press('Delete');click(page,'done')
        expect(page.locator('#classroomWorkspace')).to_be_visible();assert draft(page)['pendingSeatPins']==[1]
        page.locator('[data-drawing-action="add-seat"]').first.click();new_id=draft(page)['seats'][-1]['id']
        page.locator('[data-drawing-action="pending-pin"]').click();page.locator('[data-drawing-id="'+new_id+'"]').click()
        assert draft(page)['pendingSeatPins']==[]
        click(page,'done');expect(page.locator('#classroomWorkspace')).not_to_be_visible()
        assert next(s for s in draft(page)['seats'] if s['id']==new_id)['pin']==1
        # Resume a partially edited completed draw without losing unaffected placements.
        support.seed(page,4,2,2);page.locator('#presentationButton').click();page.locator('#drawButton').click();expect(page.locator('#drawButton')).to_be_enabled();page.locator('#adminButton').click()
        click(page,'edit');lost=draft(page)['seats'][0]['id'];page.locator('[data-drawing-id="'+lost+'"]').click();page.keyboard.press('Delete');draft(page)
        page.reload();assert draft(page)['hasDrawn'],'the last valid draw remains available outside the draft'
        click(page,'edit');resumed=draft(page);assert len(resumed['manualDraft'])==3 and lost not in resumed['manualDraft']
        page.locator('[data-drawing-action="add-seat"]').first.click();click(page,'done');expect(page.locator('#classroomWorkspace')).not_to_be_visible()
        assert not errors,errors;browser.close();print('Drawing objects, Delete/undo, isolated resumable drafts, completion and floating actions passed')
finally:server.shutdown()
