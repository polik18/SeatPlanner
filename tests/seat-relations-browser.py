"""Moved seat patterns, reviewed edges and direct room-border selection."""
import importlib.util
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
spec=importlib.util.spec_from_file_location('support',Path(__file__).with_name('v5-browser-support.py'))
support=importlib.util.module_from_spec(spec);spec.loader.exec_module(support)
server,url=support.serve();errors=[]
try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch()
        p=browser.new_page(viewport={'width':1366,'height':900},reduced_motion='reduce');support.wire(p,errors);p.goto(url);support.seed(p,4,2,2)
        p.evaluate('''()=>{const w=SeatMaster.storage.load();w.classes[0].state.config.femaleStart=3;SeatMaster.storage.save(w);}''');p.reload()
        p.locator('[data-canvas-action="edit"]').click()
        # Clicking the physical wall, with no prior shape-tool selection, exposes handles.
        def border_click():
            r=p.locator('#roomLayout').bounding_box();v=p.locator('#classroomViewport').bounding_box()
            x=max(v['x']+5,min(r['x']+r['width']-2,v['x']+v['width']-5))
            y=max(v['y']+5,min(r['y']+r['height']*.7,v['y']+v['height']-5))
            p.mouse.click(x,y)
        border_click();expect(p.locator('#classroomSelection .geometry-bounds-selection')).to_be_visible()
        assert p.locator('#classroomSelection [data-geometry-handle]').count()==8
        expect(p.locator('.room-shape-hud')).to_be_visible()
        p.locator('.room-shape-hud [data-room-ratio="16:9"]').click()
        bounds=support.active(p)['state']['classroomGeometry']['bounds'];assert abs(bounds['width']/bounds['height']-16/9)<.001
        p.keyboard.press('Control+z')
        # Camera zoom does not change the hit target's screen tolerance.
        p.locator('[data-canvas-action="zoom-fit"]').click();p.keyboard.press('Escape');border_click()
        expect(p.locator('#classroomSelection .geometry-bounds-selection')).to_be_visible()
        before=support.active(p)['state']['classroomGeometry']['bounds']['width']
        h=p.locator('#classroomSelection .handle-e').bounding_box();p.mouse.move(h['x']+h['width']/2,h['y']+h['height']/2);p.mouse.down();p.mouse.move(h['x']+h['width']/2+35,h['y']+h['height']/2,steps=5);p.mouse.up()
        assert support.active(p)['state']['classroomGeometry']['bounds']['width']>before
        p.keyboard.press('Control+z')
        # Swap through an empty location using real pointer drags.
        def center(seat):
            b=p.locator('[data-drawing-id="'+seat+'"]').bounding_box();return (b['x']+b['width']/2,b['y']+b['height']/2)
        def move_seat(seat,dest):
            x,y=center(seat);p.mouse.move(x,y);p.mouse.down();p.mouse.move(*dest,steps=5);p.mouse.up()
        a,b=center('0-0'),center('1-0')
        move_seat('0-0',(a[0]+90,(a[1]+b[1])/2));move_seat('1-0',a);move_seat('0-0',b)
        p.locator('[data-canvas-action="done"]').click();expect(p.locator('#classroomWorkspace')).not_to_be_visible()
        p.locator('[data-gender-pattern="rows"]').evaluate('(e)=>{for(let n=e.parentElement;n;n=n.parentElement)if(n.tagName==="DETAILS")n.open=true;}')
        p.locator('[data-gender-pattern="rows"]').click();s=support.active(p)['state']
        types={seat['id']:seat['type'] for seat in s['seats']}
        assert types['0-0']==types['1-1'] and types['1-0']==types['0-1'] and types['0-0']!=types['1-0'], (types,s['config'],s['roomLayout']['looseSeats'])
        # Manually remove one automatic edge, then finish another edit and reload.
        p.locator('#separationDetails').evaluate('(e)=>e.open=true');p.locator('#openTopologyButton').click()
        p.locator('#topologyEdges input').first.click();p.locator('#topologyConfirm').click()
        removed=support.active(p)['state']['seatTopology']['overrides']['remove'];assert removed
        p.locator('[data-canvas-action="edit"]').click();p.locator('[data-canvas-action="done"]').click();expect(p.locator('#classroomWorkspace')).not_to_be_visible();p.reload()
        assert support.active(p)['state']['seatTopology']['overrides']['remove']==removed
        p.locator('[data-canvas-action="edit"]').click();p.set_viewport_size({'width':390,'height':844});p.locator('[data-canvas-action="zoom-fit"]').click();p.keyboard.press('Escape');border_click()
        expect(p.locator('#classroomSelection .geometry-bounds-selection')).to_be_visible()
        p.screenshot(path=str(support.ROOT/'test-results'/'room-border-phone.png'))
        # Moving a chair preserves membership; changing tables is explicit.
        p.set_viewport_size({'width':1366,'height':900});p.locator('[data-canvas-action="close-editor"]').click();support.seed(p,4,2,2)
        p.locator('[data-canvas-action="edit"]').click();p.locator('[data-drawing-action="add-table"]').click()
        tid=support.active(p)['state']['roomLayout']['tables'][0]['id']
        p.locator('[data-drawing-id="0-0"]').click()
        if not p.locator('#drawingSeatTable').is_visible():p.locator('[data-canvas-action="properties"]').click()
        p.locator('#drawingSeatTable').select_option(tid)
        move_seat('0-0',(center('0-0')[0]+15,center('0-0')[1]+10))
        assert '0-0' in support.active(p)['state']['roomLayout']['tables'][0]['seatIds']
        p.locator('#drawingSeatTable').select_option('')
        assert any(s['id']=='0-0' for s in support.active(p)['state']['roomLayout']['looseSeats'])
        assert not errors,errors
        browser.close();print('Seat patterns after movement, preserved manual edges, direct border selection, resize and phone viewport passed')
finally:server.shutdown()
