"""Privacy, backups, recovery and room geometry regressions for Inclusive 2.0."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json
import threading
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
KEY = 'classroom-seat-master:v5'
class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}/'

def state(page):
    page.wait_for_timeout(230)
    return page.evaluate('(key) => {const w=JSON.parse(localStorage.getItem(key)); return w.classes.find(c=>c.id===w.activeClassId).state}', KEY)

try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={'width':1280, 'height':900}, reduced_motion='reduce')
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('dialog', lambda dialog: dialog.accept())
        page.goto(url)
        page.locator('#welcomeSkip').click()
        page.evaluate('''key => {
          const state=SeatMaster.createDefaultState();
          Object.assign(state.config,{rows:2,cols:4,maxNumber:8,emptyNumbers:'',femaleStart:7,displayMode:'both',studentData:'座號\\t姓名\\t密碼\\t地址\\t自訂支持理由\\n1\\t小明\\tSECRET-PASSWORD\\tSECRET-ADDRESS\\tSECRET-REASON'});
          state.config=SeatMaster.engine.normalizeConfig(state.config);
          state.seats=SeatMaster.engine.buildSeatGrid(state.config,[]);
          state.assignment=SeatMaster.engine.arrange(state);state.hasDrawn=true;
          state.activities=[3,2,1].map(n=>({id:'activity-'+n,title:'Observation '+n,createdAt:'2026-11-0'+n,participants:[1,2,3,4,5,6,7,8],groupSize:4,strategy:'random',preassignments:{},groups:[{id:'group-1',name:'A',members:[1,2,3,4],locked:false},{id:'group-2',name:'B',members:[5,6,7,8],locked:false}],history:[]}));
          localStorage.setItem(key,JSON.stringify({version:4,activeClassId:'class-1',classes:[{id:'class-1',state}]}));
        }''',KEY)
        page.reload()
        original = state(page)
        page.locator('.support-card summary').click()
        page.locator('#observationButton').click()
        expect(page.locator('#observationDialog')).to_be_visible()
        expect(page.locator('#observationDialog')).to_contain_text('學習參與')
        page.emulate_media(media='print')
        expect(page.locator('#observationPrint')).not_to_be_visible()
        page.emulate_media(media='screen')
        page.locator('#observationClose').click()
        page.locator('#groupPlannerOpen').click()
        expect(page.locator('#groupStatus')).to_contain_text('配對')
        expect(page.locator('#groupStatus')).to_contain_text('1 / 2')
        page.locator('#groupPlannerClose').click()
        page.locator('#presentationButton').click()
        page.locator('.seat.has-profile').first.click()
        expect(page.locator('#studentProfileOverlay')).to_be_visible()
        expect(page.locator('#studentProfileName')).to_have_text('小明')
        assert 'SECRET' not in page.locator('#studentProfileOverlay').inner_text()
        assert page.locator('#studentProfileOverlay [data-actual]').count() == 0
        page.locator('#studentProfileClose').click()
        page.locator('#calmButton').click()
        page.locator('#contrastButton').click()
        assert page.evaluate('document.body.classList.contains("calm-mode") && document.body.classList.contains("high-contrast")')
        assert not page.evaluate('SeatMaster.sound.isEnabled()')
        page.screenshot(path=str(ROOT / 'test-results' / 'presentation.png'))
        page.locator('#adminButton').click()
        with page.expect_download() as event:
            page.locator('#exportButton').click()
        exported = Path(event.value.path()).read_text(encoding='utf-8')
        assert 'SECRET-PASSWORD' in exported
        with page.expect_download() as event:
            page.locator('#shareChartButton').click()
        shared = Path(event.value.path()).read_text(encoding='utf-8')
        assert 'SECRET' not in shared and '小明' not in shared and 'pin' not in shared

        # Round-table increase redistributes all seats without losing IDs/results.
        page.locator('[data-room-template="round"]').click()
        made = state(page)
        assert made['assignment'] == original['assignment']
        page.locator('#roomEditToggle').check()
        page.locator('#roomAddSeat').click()
        enlarged = state(page)
        table = enlarged['roomLayout']['tables'][0]
        assert len({(round(p['x'],5),round(p['y'],5)) for p in table['seatPositions']}) == len(table['seatIds'])
        assert {k:v for k,v in enlarged['assignment'].items() if v is not None} == {k:v for k,v in original['assignment'].items() if v is not None}
        page.locator('#roomRemoveSeat').click()
        page.locator('#roomRemoveSeat').click()
        reduced = state(page)
        assert not reduced['hasDrawn']
        assert len([n for n in reduced['manualDraft'].values() if n is not None]) == 7
        page.locator('#roomUndoButton').click()
        restored = state(page)
        assert restored['hasDrawn']
        assert restored['assignment'] == made['assignment']

        # Table deletion preserves the other table's students in a draft, undo restores.
        before = state(page)
        page.locator('#roomDeleteTable').click()
        deleted = state(page)
        assert len(deleted['roomLayout']['tables']) == len(before['roomLayout']['tables']) - 1
        assert len([n for n in deleted['manualDraft'].values() if n is not None]) > 0
        page.locator('#roomUndoButton').click()
        assert state(page)['assignment'] == before['assignment']

        # A rejected batch import does not silently drop its invalid class.
        prior = page.evaluate('(key)=>localStorage.getItem(key)', KEY)
        invalid = json.loads(prior)
        invalid['classes'].append({'id':'invalid','state':{}})
        page.locator('#importFileInput').set_input_files({'name':'broken.json','mimeType':'application/json','buffer':json.dumps(invalid).encode()})
        page.wait_for_timeout(100)
        assert page.evaluate('(key)=>localStorage.getItem(key)', KEY) == prior

        # Returning to a smaller grid keeps valid placements as a draft.
        page.locator('[data-room-template="grid"]').click()
        page.locator('#colsInput').fill('2')
        page.locator('#colsInput').press('Tab')
        assert len([n for n in state(page)['manualDraft'].values() if n is not None]) == 4
        page.locator('[data-room-template="round"]').click()
        page.locator('[data-room-template="grid"]').click()
        assert len([n for n in state(page)['manualDraft'].values() if n is not None]) == 4

        # Dense U layout explicitly warns rather than hiding collisions.
        page.locator('[data-room-template="u"]').click()
        page.locator('#roomEditToggle').check()
        page.locator('#roomSeatCountInput').fill('60')
        page.locator('#roomSeatCountInput').press('Tab')
        expect(page.locator('#roomGeometryStatus')).to_have_class('room-geometry-status is-warning')
        page.set_viewport_size({'width':360,'height':800})
        page.locator('#roomGeometryStatus').scroll_into_view_if_needed()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        page.screenshot(path=str(ROOT / 'test-results' / 'dense-u-mobile.png'))

        assert not errors, errors
        browser.close()
        print('inclusive privacy, backups, room preservation and geometry browser tests passed')
finally:
    server.shutdown()
