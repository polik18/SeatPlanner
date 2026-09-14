"""Manual seating integration checks. Requires Python Playwright + Chromium.
Run: python tests/manual-browser.py
Screenshots are written to a temporary directory, never into the published site.
"""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json
import tempfile
import threading
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
KEY = 'classroom-seat-master:v1'
ARTIFACTS = Path(tempfile.mkdtemp(prefix='seatplanner-manual-'))

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}/'

def load(page, count=4, rows=2, cols=3, extra=None):
    page.goto(url)
    state = page.evaluate('''({count, rows, cols}) => {
      const s = SeatMaster.createDefaultState();
      Object.assign(s.config, {maxNumber: count, rows, cols, emptyNumbers: '', femaleStart: 3,
        studentData: '座號\\t姓名\\n1\\t王小明\\n2\\t李小華\\n3\\t陳美美\\n4\\t林小安'});
      s.seats = SeatMaster.engine.buildSeatGrid(s.config, []);
      return s;
    }''', dict(count=count, rows=rows, cols=cols))
    if extra:
        extra(state)
    page.evaluate('([key, state]) => localStorage.setItem(key, JSON.stringify(state))', [KEY, state])
    page.reload()
    return state

def stored(page):
    page.wait_for_timeout(220)
    return page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', KEY)

def seat(page, id):
    return page.locator(f'.seat[data-seat-id="{id}"]')

try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        load(page)
        page.locator('#manualStartButton').click()
        expect(page.locator('#manualFinishButton')).to_be_disabled()
        expect(page.locator('#manualCurrent')).to_contain_text('1 號 王小明')
        seat(page, '0-0').click()
        expect(page.locator('#manualCurrent')).to_contain_text('2 號 李小華')
        assert stored(page)['manualDraft']['0-0'] == 1
        assert not stored(page)['hasDrawn']
        page.locator('#manualUndoButton').click()
        assert stored(page)['manualDraft']['0-0'] is None
        page.locator('#manualRedoButton').click()
        assert stored(page)['manualDraft']['0-0'] == 1
        # Occupied target returns the old occupant to the tray and selects them.
        seat(page, '0-0').click()
        assert stored(page)['manualDraft']['0-0'] == 2
        expect(page.locator('#manualCurrent')).to_contain_text('1 號 王小明')
        seat(page, '0-1').click()
        page.locator('#manualCancelSelection').click()
        seat(page, '0-0').click()
        seat(page, '0-1').click()
        assert stored(page)['manualDraft']['0-0'] == 1
        assert stored(page)['manualDraft']['0-1'] == 2
        page.locator('#manualCancelSelection').click()
        seat(page, '0-1').click()
        page.locator('#manualUnseatButton').click()
        assert stored(page)['manualDraft']['0-1'] is None
        # Search by name/number and keyboard placement, with focus retained.
        page.locator('#manualSearch').fill('美美')
        expect(page.locator('[data-student-number]')).to_have_count(1)
        page.locator('[data-student-number="3"]').click()
        seat(page, '1-0').focus()
        page.keyboard.press('Enter')
        assert stored(page)['manualDraft']['1-0'] == 3
        assert page.evaluate('document.activeElement.dataset.seatId') == '1-0'
        page.keyboard.press('Control+z')
        assert stored(page)['manualDraft']['1-0'] is None
        page.keyboard.press('Control+Shift+z')
        assert stored(page)['manualDraft']['1-0'] == 3
        page.locator('#manualSearch').fill('2')
        expect(page.locator('[data-student-number]')).to_have_count(1)
        page.locator('#manualSearch').fill('')
        # Desktop drag from tray, then a partial draft round trip.
        page.locator('[data-student-number="2"]').drag_to(seat(page, '0-2'))
        assert stored(page)['manualDraft']['0-2'] == 2
        before = stored(page)['manualDraft']
        page.reload()
        expect(page.locator('#manualPanel')).to_be_visible()
        assert stored(page)['manualDraft'] == before
        page.locator('[data-admin-mode="layout"]').click()
        with page.expect_download() as event:
            page.locator('#exportButton').click()
        exported = json.loads(Path(event.value.path()).read_text())
        assert exported['manualDraft'] == before
        page.locator('#importFileInput').set_input_files({'name': 'draft.json', 'mimeType': 'application/json', 'buffer': json.dumps(exported).encode()})
        expect(page.locator('#manualPanel')).to_be_visible()
        assert stored(page)['manualDraft'] == before
        # Rotate an unfinished draft and rotate it back.
        page.locator('[data-admin-mode="layout"]').click()
        page.locator('#rotateClockwiseButton').click()
        assert sorted(n for n in stored(page)['manualDraft'].values() if n) == [1, 2, 3]
        page.locator('#rotateCounterclockwiseButton').click()
        assert stored(page)['manualDraft'] == before
        page.locator('#manualStartButton').click()
        page.locator('#manualAutoNext').uncheck()
        page.locator('#manualCancelSelection').click()
        page.locator('[data-student-number="4"]').click()
        seat(page, '1-1').click()
        expect(page.locator('#manualFinishButton')).to_be_enabled()
        completed = stored(page)['manualDraft']
        page.locator('#manualFinishButton').click()
        expect(page.locator('body')).to_have_class('presentation-mode')
        assert stored(page)['assignment'] == completed
        assert stored(page)['manualDraft'] is None
        expect(page.locator('#drawMessage')).to_contain_text('手動排位完成')
        # Change display content and class title without losing the manual result.
        page.locator('#adminButton').click()
        page.locator('#displayModeInput').select_option('both')
        page.locator('#classNameInput').fill('測試班')
        page.locator('#classNameInput').press('Tab')
        assert stored(page)['assignment'] == completed
        page.locator('#presentationButton').click()
        expect(seat(page, '0-0')).to_contain_text('王小明')
        page.locator('#adminButton').click()
        page.locator('#manualStartButton').click()
        assert stored(page)['manualDraft'] == completed
        page.once('dialog', lambda d: d.accept())
        page.locator('#manualClearButton').click()
        assert all(n is None for n in stored(page)['manualDraft'].values())
        assert stored(page)['assignment'] == completed
        page.locator('#manualUndoButton').click()
        assert stored(page)['manualDraft'] == completed
        # Rule conflicts do not block teacher decisions; aisle remains unavailable.
        def restrictions(s):
            s['seats'][0].update(type='female', pin=1)
            s['seats'][-1]['type'] = 'aisle'
        load(page, extra=restrictions)
        page.locator('#manualStartButton').click()
        expect(page.locator('#validationNotice')).to_be_hidden()
        assert stored(page)['manualDraft']['0-0'] == 1
        expect(seat(page, '1-2')).to_have_attribute('aria-disabled', 'true')
        seat(page, '1-2').click(force=True)
        assert '1-2' not in stored(page)['manualDraft']
        for id in ['0-1', '0-2', '1-0']:
            seat(page, id).click()
        page.locator('#manualFinishButton').click()
        expect(page.locator('body')).to_have_class('presentation-mode')
        # Old exports, invalid drafts and a too-small room.
        def damaged(s):
            s['manualDraft'] = {'0-0': 1, '0-1': 1, '0-2': 99, 'removed': 2}
        load(page, extra=damaged)
        assert list(stored(page)['manualDraft'].values()).count(1) == 1
        assert 99 not in stored(page)['manualDraft'].values()
        load(page, count=4, rows=1, cols=2)
        page.locator('#manualStartButton').click()
        expect(page.locator('#manualCapacity')).to_contain_text('2')
        expect(page.locator('#manualFinishButton')).to_be_disabled()
        page.locator('[data-admin-mode="layout"]').click()
        page.locator('#colsInput').fill('4')
        page.locator('#colsInput').press('Tab')
        page.locator('#manualStartButton').click()
        expect(page.locator('#manualCapacity')).to_be_hidden()
        # Remove a student/desk while retaining all still-valid draft placements.
        seat(page, '0-0').click()
        seat(page, '0-1').click()
        page.locator('[data-admin-mode="layout"]').click()
        page.locator('#emptyNumbersInput').fill('2')
        page.locator('#emptyNumbersInput').press('Tab')
        assert stored(page)['manualDraft']['0-0'] == 1
        assert 2 not in stored(page)['manualDraft'].values()
        # Existing random draw and student picker still work after manual seating.
        load(page)
        page.locator('#presentationButton').click()
        page.locator('#drawButton').click()
        page.wait_for_timeout(1500)
        assert stored(page)['hasDrawn']
        page.locator('#adminButton').click()
        page.locator('.admin-only .student-draw-open').click()
        expect(page.locator('#studentDrawDialog')).to_be_visible()
        page.locator('#studentDrawClose').click()
        # Home is consistent across editing, presentation and modal activities.
        final_result = stored(page)['assignment']
        page.locator('#manualStartButton').click()
        page.once('dialog', lambda d: d.accept())
        page.locator('#manualClearButton').click()
        seat(page, '0-0').click()
        draft = stored(page)['manualDraft']
        page.locator('#homeButton').click()
        expect(page.locator('[data-admin-mode="layout"]')).to_have_attribute('aria-selected', 'true')
        expect(page.locator('#manualPanel')).to_be_hidden()
        assert stored(page)['manualDraft'] == draft
        assert stored(page)['assignment'] == final_result
        page.reload()
        expect(page.locator('#homeButtonText')).to_have_text('首頁')
        expect(page.locator('#manualPanel')).to_be_hidden()
        page.locator('#manualStartButton').click()
        assert stored(page)['manualDraft'] == draft
        page.locator('#homeButton').click()
        page.locator('[data-admin-mode="prearrange"]').click()
        seat(page, '0-0').click()
        page.locator('#pinStudentSelect').select_option('2')
        page.locator('#pinDialog [data-go-home]').click()
        expect(page.locator('#pinDialog')).not_to_be_visible()
        assert stored(page)['seats'][0]['pin'] is None
        expect(page.locator('#homeButtonText')).to_have_text('首頁')
        page.locator('[data-admin-mode="adjust"]').click()
        page.locator('#homeButton').click()
        expect(page.locator('#homeButtonText')).to_have_text('首頁')
        page.locator('#presentationButton').click()
        page.emulate_media(reduced_motion='no-preference')
        page.locator('#drawButton').click()
        page.locator('#homeButton').click()
        expect(page.locator('body')).not_to_have_class('presentation-mode')
        assert stored(page)['assignment'] == final_result
        assert stored(page)['manualDraft'] == draft
        page.locator('.admin-only .student-draw-open').click()
        page.locator('#studentDrawStart').click()
        page.locator('#studentDrawDialog [data-go-home]').click()
        expect(page.locator('#studentDrawDialog')).not_to_be_visible()
        page.locator('.admin-only .student-draw-open').click()
        expect(page.locator('#studentDrawHistory')).to_have_text('還沒有人被抽中')
        assert page.evaluate('JSON.parse(localStorage.getItem("classroom-seat-master:student-draw") || "null")?.history.length || 0') == 0
        page.locator('#studentDrawDialog [data-go-home]').click()
        page.emulate_media(reduced_motion='reduce')
        page.locator('#presentationButton').click()
        page.locator('.seat.has-profile').first.click()
        expect(page.locator('#studentProfileOverlay')).to_be_visible()
        page.locator('#studentProfileOverlay [data-go-home]').click()
        expect(page.locator('#studentProfileOverlay')).to_be_hidden()
        expect(page.locator('#homeButtonText')).to_have_text('首頁')
        # Layout checks with real click/touch at five sizes; no page overflow.
        for width, height in [(1440, 900), (1024, 768), (768, 1024), (390, 844), (640, 390)]:
            ctx = browser.new_context(viewport={'width': width, 'height': height}, has_touch=width < 981)
            view = ctx.new_page()
            view.on('pageerror', lambda e: errors.append(str(e)))
            load(view, count=29, rows=8, cols=4)
            view.locator('#manualStartButton').click()
            seat(view, '0-0').tap() if width < 981 else seat(view, '0-0').click()
            assert stored(view)['manualDraft']['0-0'] == 1
            view.screenshot(path=str(ARTIFACTS / f'{width}x{height}.png'))
            assert view.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), (width, 'page overflow')
            # Teacher can reach the last desk without it being covered by the tray.
            seat(view, '7-3').tap() if width < 981 else seat(view, '7-3').click()
            assert stored(view)['manualDraft']['7-3'] == 2
            # The fixed home control stays reachable after scrolling to a desk.
            button = view.locator('#homeButton')
            assert button.evaluate('e => {const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}')
            button.tap() if width < 981 else button.click()
            expect(view.locator('#manualPanel')).to_be_hidden()
            view.locator('#manualStartButton').click()
            view.locator('.admin-only .language-button').click()
            expect(view.locator('#homeButtonText')).to_have_text('Back to home')
            expect(view.locator('#manualFinishButton')).to_have_text('Finish & present')
            ctx.close()
        assert not errors, errors
        print(json.dumps({'status': 'passed', 'screenshots': str(ARTIFACTS), 'page_errors': errors}))
        browser.close()
finally:
    server.shutdown()
