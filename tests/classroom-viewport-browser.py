"""Stable camera, readable world text, view-only changes and actual room shape edits."""
import importlib.util, math
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
spec = importlib.util.spec_from_file_location('support', Path(__file__).with_name('v5-browser-support.py'))
support = importlib.util.module_from_spec(spec); spec.loader.exec_module(support)
server, url = support.serve(); errors = []
def click(p, action): p.locator(f'[data-canvas-action="{action}"]').click()
def view(p): return p.evaluate('SeatMaster.classroomEditor.view')
def geom(p): return support.active(p)['state']['classroomGeometry']
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for width, height in [(1366,768),(1280,720),(1920,1080)]:
            page = browser.new_page(viewport={'width':width,'height':height}, reduced_motion='reduce')
            support.wire(page,errors); page.goto(url); support.seed(page,29,8,4)
            click(page,'edit'); before = geom(page); cam = view(page)
            box = page.locator('#classroomViewport').bounding_box()
            assert box['width'] >= width - 270 and box['height'] >= height - 115
            click(page,'teacher'); selected_view = view(page)
            page.locator('.canvas-precise summary').click()
            assert view(page) == selected_view, 'properties must not shrink the room'
            click(page,'bounds'); assert view(page)['scale'] == cam['scale']
            page.locator('#canvasRatioWidth').fill('16'); page.locator('#canvasRatioHeight').fill('9'); click(page,'ratio-custom')
            wide = geom(page); assert abs(wide['bounds']['width']/wide['bounds']['height']-16/9) < 1e-9
            assert view(page)['scale'] == cam['scale'], 'changing the real outline must not refit the camera'
            assert wide['content']['width'] == before['content']['width']
            click(page,'undo'); assert geom(page) == before
            # Compare text and object screen size at two explicit view scales.
            click(page,'teacher'); click(page,'zoom-selection')
            def sizes():
                return page.locator('[data-marker-id="teacher"]').evaluate('''e=>({width:e.getBoundingClientRect().width,font:parseFloat(getComputedStyle(e.firstElementChild).fontSize), scale:SeatMaster.classroomEditor.view.scale, root:document.getElementById("roomLayout").style.transform, computed:getComputedStyle(document.getElementById("roomLayout")).transform, mw:e.style.width})''')
            first = sizes(); click(page,'zoom-out'); second = sizes()
            assert abs(second['width']/first['width'] - second['scale']/first['scale']) < .001, (first,second)
            assert first['font'] == second['font'] == 14
            # Pure navigation changes neither the model nor the undo stack.
            stable = geom(page)
            undo_disabled = page.locator('[data-canvas-action="undo"]').is_disabled()
            click(page,'pan'); v = page.locator('#classroomViewport').bounding_box(); x,y = v['x']+v['width']/2,v['y']+v['height']/2
            camera_before = view(page); page.mouse.move(x,y); page.mouse.down(); page.mouse.move(x+70,y+30,steps=5); page.mouse.up()
            assert abs(view(page)['x']-camera_before['x']-70)<.1
            assert geom(page) == stable
            assert page.locator('[data-canvas-action="undo"]').is_disabled() == undo_disabled
            click(page,'zoom-fit'); assert geom(page) == stable
            click(page,'bounds')
            page.screenshot(path=str(support.ROOT/'test-results'/f'classroom-workspace-{width}.png'))
            # At a custom zoom, world distance tracks screen drag exactly.
            click(page,'teacher'); click(page,'zoom-selection'); click(page,'zoom-out')
            marker = page.locator('[data-marker-id="teacher"]'); b = marker.bounding_box(); m_before=geom(page)['markers'][2]; s=view(page)['scale']
            x,y=b['x']+b['width']/2,b['y']+b['height']/2
            page.mouse.move(x,y); page.mouse.down(); page.mouse.move(x-40,y+40,steps=6); page.mouse.up()
            m_after=geom(page)['markers'][2]
            assert abs(m_after['x']-m_before['x']+40/s)<.1
            assert abs(m_after['y']-m_before['y']-40/s)<.1
            click(page,'undo'); click(page,'done')
            assert not page.locator('#classroomWorkspace').is_visible()
            assert not page.locator('.app-shell').evaluate('(e)=>e.inert')
            page.close()
        mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce')
        phone=mobile.new_page(); support.wire(phone,errors); phone.goto(url); support.seed(phone,29,8,4)
        click(phone,'edit'); click(phone,'teacher'); stable=geom(phone); c=view(phone)
        click(phone,'properties'); assert view(phone)==c
        click(phone,'properties'); assert view(phone)==c
        v=phone.locator('#classroomViewport').bounding_box(); x,y=v['x']+v['width']/2,v['y']+v['height']/2
        client=mobile.new_cdp_session(phone)
        client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x-40,'y':y},{'x':x+40,'y':y}]})
        client.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x-70,'y':y+20},{'x':x+70,'y':y+20}]})
        client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        assert view(phone)['scale']>c['scale']
        assert geom(phone)==stable, 'pinching must cancel any first-finger object drag'
        click(phone,'zoom-selection')
        phone.screenshot(path=str(support.ROOT/'test-results'/'classroom-workspace-phone.png'))
        mobile.close(); assert not errors,errors; browser.close()
        print('Workspace: stable zoom, synchronized text, pure pan/zoom, custom room ratio, desktop sizes and pinch passed')
finally: server.shutdown()
