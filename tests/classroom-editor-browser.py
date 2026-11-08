"""Real pointer editing, cancellation, aspect changes, persistence and projection."""
import importlib.util
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
spec = importlib.util.spec_from_file_location('support', Path(__file__).with_name('v5-browser-support.py'))
support = importlib.util.module_from_spec(spec)
spec.loader.exec_module(support)
server, url = support.serve()
errors = []
def click(page, action):
    target = page.locator(f'[data-canvas-action="{action}"]')
    if target.count() and not target.is_visible() and page.locator('[data-canvas-action="properties"]').is_visible():
        page.locator('[data-canvas-action="properties"]').click()
    target.click()
def geometry(page):
    return support.active(page)['state']['classroomGeometry']
def draw_drag(page, locator, dx, dy):
    locator.evaluate('(e) => e.scrollIntoView({block:"center",behavior:"instant"})')
    box = locator.bounding_box()
    x, y = box['x'] + box['width']/2, box['y'] + box['height']/2
    assert locator.evaluate('(e, p) => e === document.elementFromPoint(p.x,p.y) || e.contains(document.elementFromPoint(p.x,p.y))', {'x':x,'y':y}), page.evaluate('(p) => document.elementFromPoint(p.x,p.y)?.outerHTML', {'x':x,'y':y})
    page.mouse.move(x, y); page.mouse.down(); page.mouse.move(x+dx, y+dy, steps=8); page.mouse.up()
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={'width': 1500, 'height': 1100}, reduced_motion='reduce')
        support.wire(page, errors); page.goto(url); support.seed(page, 4, 2, 2)
        original = support.active(page)['state']
        click(page, 'edit')
        expect(page.locator('#roomLayout')).to_have_class('room-layout geometry-enabled geometry-editing')
        click(page, 'teacher')
        start = geometry(page)
        draw_drag(page, page.locator('[data-marker-id="teacher"]'), -90, 100)
        moved = geometry(page)
        assert moved['markers'][2]['x'] < start['markers'][2]['x']
        click(page, 'undo'); assert geometry(page) == start
        click(page, 'redo'); assert geometry(page) == moved
        click(page, 'teacher')
        draw_drag(page, page.locator('#classroomSelection .handle-se'), 22, 16)
        resized = geometry(page)
        assert resized['markers'][2]['width'] > moved['markers'][2]['width']
        # Pointer rotation uses the round handle, not only a numeric/button shortcut.
        draw_drag(page, page.locator('#classroomSelection .handle-rotate'), 30, 20)
        assert geometry(page)['markers'][2]['rotation'] != resized['markers'][2]['rotation']
        click(page, 'undo')
        click(page, 'right'); assert geometry(page)['markers'][2]['rotation'] == (resized['markers'][2]['rotation'] + 90) % 360
        keyboard_before = geometry(page)['markers'][2]['x']
        page.locator('[data-marker-id="teacher"]').focus()
        page.keyboard.press('ArrowRight')
        assert geometry(page)['markers'][2]['x'] == keyboard_before + 1
        click(page, 'undo')
        # Escape during an active pointer transaction restores the starting geometry.
        obj = page.locator('[data-marker-id="teacher"]'); obj.scroll_into_view_if_needed(); box = obj.bounding_box()
        page.mouse.move(box['x']+box['width']/2, box['y']+box['height']/2); page.mouse.down(); page.mouse.move(box['x']+100, box['y']+90)
        page.keyboard.press('Escape'); page.mouse.up()
        assert geometry(page)['markers'][2]['x'] == resized['markers'][2]['x']
        click(page, 'bounds'); before = geometry(page)
        draw_drag(page, page.locator('.geometry-bounds-selection .handle-e'), 30, 0)
        assert geometry(page)['bounds']['width'] > before['bounds']['width']
        click(page, 'undo')
        click(page, 'ratio-16:9'); wide = geometry(page)
        assert abs(wide['bounds']['width']/wide['bounds']['height'] - 16/9) < .001
        assert wide['content']['width'] == before['content']['width']
        assert wide['markers'][2]['width'] == before['markers'][2]['width']
        # Make the frame too small: no silent clipping or completed presentation.
        page.locator('.canvas-precise summary').click()
        page.locator('[data-geometry-value="width"]').fill('500'); page.locator('[data-geometry-value="width"]').press('Tab')
        expect(page.locator('#canvasStatus')).to_have_class('is-error')
        click(page, 'done'); expect(page.locator('#roomLayout')).to_have_class('room-layout geometry-enabled geometry-editing has-geometry-overflow')
        click(page, 'fit'); click(page, 'done')
        final = geometry(page)
        assert support.active(page)['state']['seats'] == original['seats']
        assert support.active(page)['state']['assignment'] == original['assignment']
        page.reload(); assert geometry(page) == final
        click(page, 'edit'); click(page, 'teacher'); click(page, 'reset')
        assert page.evaluate('!SeatMaster.classroomGeometry.overflow(SeatMaster.storage.load().classes[0].state.classroomGeometry).includes("teacher")')
        click(page, 'undo'); assert geometry(page) == final
        click(page, 'done')
        click(page, 'edit'); click(page, 'door'); click(page, 'hide')
        assert page.locator('[data-marker-id="door"]').count() == 0
        click(page, 'door'); expect(page.locator('[data-marker-id="door"]')).to_be_visible()
        click(page, 'done')
        page.locator('#presentationButton').click()
        expect(page.locator('#classroomEditorToolbar')).to_be_hidden()
        assert page.locator('.geometry-handle').count() == 0
        page.screenshot(path=str(support.ROOT/'test-results'/'classroom-editor-presentation.png'))
        page.locator('#adminButton').click()
        click(page, 'edit'); click(page, 'bounds')
        page.locator('.classroom-stage').evaluate('(e) => e.scrollTop = 0')
        page.screenshot(path=str(support.ROOT/'test-results'/'classroom-editor-desktop.png'))
        page.locator('#classroomViewport').screenshot(path=str(support.ROOT/'test-results'/'classroom-editor-canvas.png'))
        click(page, 'done')
        # New geometry survives records and portable backups and four whole-room turns.
        saved = geometry(page)
        support.save_record(page, 'Canvas record')
        entry = support.active(page)
        assert entry['records'][0]['state']['classroomGeometry'] == saved
        with page.expect_download() as download:
            page.locator('#exportButton').click()
        import json
        portable = json.loads(Path(download.value.path()).read_text(encoding='utf-8'))
        assert portable['version'] == 7
        assert portable['classes'][0]['state']['classroomGeometry'] == saved
        page.locator('#importFileInput').set_input_files({'name':'geometry-v7.json','mimeType':'application/json','buffer':json.dumps(portable).encode()})
        # An identical import needs no collision decision; retain the active class.
        if page.locator('#importCollisionDialog').is_visible():
            page.locator('[data-close-v5="importCollisionDialog"]').click()
        assert geometry(page) == saved
        page.locator('#rotateClockwiseButton').evaluate('(e) => {let p=e;while(p){if(p.tagName==="DETAILS")p.open=true;p=p.parentElement;}}')
        for _ in range(4): page.locator('#rotateClockwiseButton').click()
        rotated = geometry(page)
        assert rotated['bounds'] == saved['bounds']
        assert abs(rotated['markers'][2]['x'] - saved['markers'][2]['x']) < .00001
        # Free table layouts share the same editor and their existing drag handles.
        page.locator('[data-room-template="round"]').click()
        click(page, 'edit'); click(page, 'tables')
        old_tables = support.active(page)['state']['roomLayout']['tables']
        handle = page.locator('.room-table-surface').first
        draw_drag(page, handle, 18, 14)
        new_tables = support.active(page)['state']['roomLayout']['tables']
        assert new_tables[0]['x'] != old_tables[0]['x']
        click(page, 'undo')
        assert support.active(page)['state']['roomLayout']['tables'] == old_tables
        click(page, 'bounds'); click(page, 'ratio-16:9'); click(page, 'fit'); click(page, 'done')
        saved_free = geometry(page)
        for _ in range(4): page.locator('#rotateClockwiseButton').click()
        assert geometry(page)['bounds'] == saved_free['bounds']
        # Verify actual touch input and responsive logical positions on a phone.
        mobile = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True, reduced_motion='reduce')
        mobile.add_init_script('localStorage.setItem("seatplanner:ui-onboarding:v1", JSON.stringify({schemaVersion:1,completed:true,dismissed:false,hasUserActivity:true}))')
        phone = mobile.new_page(); support.wire(phone, errors); phone.goto(url)
        phone.locator('[data-canvas-action="edit"]').tap()
        phone.locator('[data-canvas-action="bounds"]').tap()
        phone.locator('[data-canvas-action="properties"]').tap()
        phone.locator('[data-canvas-action="ratio-16:9"]').tap()
        phone.locator('[data-canvas-action="properties"]').tap()
        assert abs(geometry(phone)['bounds']['width']/geometry(phone)['bounds']['height'] - 16/9) < .001
        phone.locator('[data-canvas-action="teacher"]').tap()
        touch_object = phone.locator('[data-marker-id="teacher"]')
        touch_object.evaluate('(e) => e.scrollIntoView({block:"center"})')
        box = touch_object.bounding_box(); tx, ty = box['x'] + box['width']/2, box['y'] + box['height']/2
        touch_before = geometry(phone)['markers'][2]['x']
        client = mobile.new_cdp_session(phone)
        client.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':tx,'y':ty}]})
        client.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':tx-25,'y':ty+28}]})
        client.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
        assert geometry(phone)['markers'][2]['x'] < touch_before
        phone.locator('#roomLayout').scroll_into_view_if_needed()
        phone.screenshot(path=str(support.ROOT/'test-results'/'classroom-editor-mobile.png'))
        mobile.close()
        assert not errors, errors
        browser.close()
        print('Classroom editor: pointer/touch/keyboard, undo/redo, cancellation, aspect/fit, v7 import/records, rotation, free tables and presentation passed')
finally:
    server.shutdown()
