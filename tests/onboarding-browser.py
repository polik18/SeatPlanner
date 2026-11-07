"""Inclusive 2.0 integration matrix. Run with .venv/Scripts/python tests/onboarding-browser.py."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json
import threading
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / 'test-results'
ARTIFACTS.mkdir(exist_ok=True)
KEY = 'classroom-seat-master:v4'
META = 'seatplanner:ui-onboarding:v1'

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{server.server_port}/'
fixture = lambda name: json.loads((ROOT / 'tests' / 'fixtures' / (name + '.json')).read_text(encoding='utf-8'))

def workspace(page):
    return page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', KEY)

def meta(page):
    return page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', META)

def import_file(page, value):
    page.locator('#importFileInput').set_input_files({'name': 'classes.json', 'mimeType': 'application/json', 'buffer': json.dumps(value).encode()})

try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        errors, external = [], []
        context = browser.new_context(viewport={'width': 1280, 'height': 900}, reduced_motion='reduce')
        context.on('page', lambda p: p.on('pageerror', lambda error: errors.append(str(error))))
        context.on('request', lambda request: external.append(request.url) if request.url.startswith(('http:', 'https:')) and not request.url.startswith(URL) else None)
        page = context.new_page()
        page.on('dialog', lambda dialog: dialog.accept())
        page.goto(URL)
        expect(page.locator('#welcomeDialog')).to_be_visible()
        assert page.locator('#welcomeStart').evaluate('(e) => e === document.activeElement')
        # Native modal focus stays inside the welcome surface.
        for _ in range(12):
            page.keyboard.press('Tab')
            assert page.evaluate('document.getElementById("welcomeDialog").contains(document.activeElement)')
        page.screenshot(path=str(ARTIFACTS / 'welcome-desktop.png'))
        page.reload()
        expect(page.locator('#welcomeDialog')).to_be_visible()  # automatic 601 save is still first visit
        page.locator('#welcomeStart').click()
        page.locator('#tourNext').click()
        page.locator('#tourNext').click()
        expect(page.locator('#tourProgress')).to_contain_text('3 / 5')
        page.reload()
        expect(page.locator('#welcomeDialog')).to_be_visible()  # unfinished guide
        page.keyboard.press('Escape')
        page.reload()
        expect(page.locator('#welcomeDialog')).not_to_be_visible()
        assert meta(page)['dismissed']
        before = workspace(page)
        page.locator('#tutorialButton').click()
        page.locator('#welcomeStart').click()
        page.locator('#tourNext').click()
        page.locator('#tourPrevious').click()
        for _ in range(5):
            page.locator('#tourNext').click()
        expect(page.locator('#readyDialog')).to_be_visible()
        page.locator('#readyCreate').click()
        assert workspace(page) == before
        page.reload()
        expect(page.locator('#welcomeDialog')).not_to_be_visible()
        assert meta(page)['completed']

        # Real editing closes the guide, and refresh never reopens it.
        page.locator('#tutorialButton').click()
        page.locator('#welcomeStart').click()
        page.locator('#classNameInput').fill('我的班級')
        page.locator('#classNameInput').press('Tab')
        expect(page.locator('#tourPanel')).not_to_be_visible()
        page.wait_for_timeout(250)
        page.reload()
        expect(page.locator('#welcomeDialog')).not_to_be_visible()
        assert meta(page)['hasUserActivity']

        # Invalid import and cancel leave first-visit state unchanged.
        page.evaluate('localStorage.clear()')
        page.reload()
        import_file(page, {'version': 4, 'classes': []})
        expect(page.locator('#welcomeDialog')).to_be_visible()
        expect(page.locator('#welcomeError')).to_be_visible()
        assert meta(page) is None
        page.locator('#importFileInput').set_input_files([])
        assert meta(page) is None
        import_file(page, fixture('multi-v4'))
        expect(page.locator('#welcomeDialog')).not_to_be_visible()
        assert len(workspace(page)['classes']) == 2
        assert meta(page)['hasUserActivity']
        page.reload()
        expect(page.locator('#welcomeDialog')).not_to_be_visible()

        # Existing meaningful workspace needs no metadata; legacy v1-v3 retain their data.
        for version in range(1, 5):
            data = fixture('existing-v4') if version == 4 else fixture('legacy-v' + str(version))
            if version != 4:
                data['config']['className'] = 'Legacy ' + str(version)
            page.evaluate('([key, meta, data]) => { localStorage.clear(); localStorage.setItem(key, JSON.stringify(data)); }', [KEY, META, data])
            page.reload()
            expect(page.locator('#welcomeDialog')).not_to_be_visible()
            assert workspace(page)['version'] == 4

        # Deleting a class does not reset tutorial state. Full reset does; undo restores data.
        import_file(page, fixture('multi-v4'))
        count = len(workspace(page)['classes'])
        page.locator('#deleteClassButton').click()
        assert len(workspace(page)['classes']) == count - 1
        page.reload()
        expect(page.locator('#welcomeDialog')).not_to_be_visible()
        previous = workspace(page)
        page.locator('#resetButton').click()
        expect(page.locator('#welcomeDialog')).to_be_visible()
        page.locator('#welcomeSkip').click()
        page.locator('#recoverButton').click()
        assert len(workspace(page)['classes']) == len(previous['classes'])

        # Responsive welcome and all tour buttons remain in the viewport.
        for width, height, label in [(360, 800, 'mobile'), (768, 1024, 'tablet'), (1280, 900, 'desktop'), (640, 450, 'zoom-200')]:
            page.set_viewport_size({'width': width, 'height': height})
            page.locator('#tutorialButton').click()
            expect(page.locator('#welcomeStart')).to_be_visible()
            page.screenshot(path=str(ARTIFACTS / ('welcome-' + label + '.png')))
            page.locator('#welcomeStart').click()
            for _ in range(5):
                box = page.locator('#tourNext').bounding_box()
                assert box and box['x'] >= 0 and box['y'] >= 0 and box['x'] + box['width'] <= width + 1 and box['y'] + box['height'] <= height + 1
                target_box = page.locator('.tour-target').bounding_box()
                panel_box = page.locator('#tourPanel').bounding_box()
                if target_box and panel_box:
                    overlap = target_box['x'] < panel_box['x'] + panel_box['width'] and target_box['x'] + target_box['width'] > panel_box['x'] and target_box['y'] < panel_box['y'] + panel_box['height'] and target_box['y'] + target_box['height'] > panel_box['y']
                    assert not overlap, (label, target_box, panel_box)
                page.locator('#tourNext').click()
            page.locator('#readyCreate').click()
            page.evaluate('window.scrollTo(0,0); document.querySelector(".classroom-stage").scrollTop=0;document.querySelector(".control-panel").scrollTop=0')
            expect(page.locator('.header-actions.presentation-only')).not_to_be_visible()
            expect(page.locator('.brand')).to_be_visible()
            page.screenshot(path=str(ARTIFACTS / ('workspace-' + label + '.png')))
        page.set_viewport_size({'width': 1280, 'height': 900})

        # Language switch is not meaningful activity.
        page.evaluate('localStorage.clear()')
        page.reload()
        page.locator('#welcomeDialog .language-button').click()
        expect(page.locator('#welcomeStart')).to_have_text('Get started')
        assert meta(page) is None
        page.locator('#welcomeSkip').click()

        # Corrupt workspace is never overwritten, with a visible save failure.
        page.evaluate('(key) => localStorage.setItem(key, "{broken original")', KEY)
        page.reload()
        expect(page.locator('#saveStatus')).to_contain_text('Save failed')
        assert page.evaluate('(key) => localStorage.getItem(key)', KEY) == '{broken original'

        # Blocked storage cannot abort app bootstrap or falsely promise persistence.
        denied = browser.new_context()
        denied.add_init_script('Storage.prototype.getItem = function(){throw new Error("denied")}; Storage.prototype.setItem = function(){throw new Error("denied")};')
        denied_page = denied.new_page()
        denied_page.on('pageerror', lambda error: errors.append(str(error)))
        denied_page.goto(URL)
        expect(denied_page.locator('#welcomeDialog')).to_be_visible()
        denied_page.locator('#welcomeSkip').click()
        expect(denied_page.locator('#saveStatus')).to_contain_text('儲存失敗')
        expect(denied_page.locator('#tutorialStorageNotice')).to_be_visible()
        denied.close()

        # file:// runs without an HTTP service or external requests.
        offline = browser.new_context(offline=True)
        file_page = offline.new_page()
        file_page.on('pageerror', lambda error: errors.append(str(error)))
        file_page.goto((ROOT / 'index.html').as_uri())
        expect(file_page.locator('#welcomeDialog')).to_be_visible()
        file_page.locator('#welcomeSkip').click()
        expect(file_page.locator('#seatGrid .seat')).to_have_count(32)
        offline.close()
        assert not errors, errors
        assert not external, external
        browser.close()
        print('onboarding browser matrix passed; screenshots:', ARTIFACTS)
finally:
    server.shutdown()
