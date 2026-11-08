"""Core feature discovery and private preassignment plus separation in presentation."""
import importlib.util
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

spec = importlib.util.spec_from_file_location('support', Path(__file__).with_name('v5-browser-support.py'))
support = importlib.util.module_from_spec(spec)
spec.loader.exec_module(support)
server, url = support.serve()
errors = []
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={'width': 1280, 'height': 900}, reduced_motion='reduce')
        support.wire(page, errors)
        page.goto(url)
        expect(page.locator('.welcome-core')).to_be_visible()
        names = page.evaluate("SeatMaster.constants.DEFAULT_CONFIG.studentData.split('\\n').map(row => row.split('\\t')[1])")
        assert all(name[1] == '\u25cb' for name in names if len(name) == 3)
        support.seed(page, 5, 1, 5)
        page.locator('.inclusive-actions [data-workflow="priority"]').click()
        expect(page.locator('[data-admin-mode="prearrange"]')).to_have_attribute('aria-pressed', 'true')
        page.locator('.seat[data-seat-id="0-0"]').click()
        page.locator('#pinStudentSelect').select_option('1')
        page.locator('#pinForm button[value="default"]').click()
        page.locator('#separationDetails').evaluate('(e) => e.open = false')
        page.locator('[data-workflow="separation"]').click()
        expect(page.locator('#ruleStudentA')).to_be_visible()
        support.rule(page, 1, 2)
        page.screenshot(path=str(support.ROOT / 'test-results' / 'inclusion-purpose-desktop.png'))
        page.locator('#presentationButton').click()
        expect(page.locator('.inclusive-purpose')).to_be_hidden()
        expect(page.locator('#separationPanel')).to_be_hidden()
        for _ in range(3):
            page.locator('#drawButton').click()
            expect(page.locator('#drawButton')).to_be_enabled()
            state = support.active(page)['state']
            assert state['assignment']['0-0'] == 1
            second_seat = next(seat for seat, number in state['assignment'].items() if number == 2)
            assert second_seat not in ['0-0', '0-1']
            assert page.locator('#seatGrid .pin-button, #seatGrid .is-pinned-seat').count() == 0
        page.screenshot(path=str(support.ROOT / 'test-results' / 'inclusion-purpose-presentation.png'))
        page.locator('#adminButton').click()
        page.set_viewport_size({'width': 390, 'height': 844})
        expect(page.locator('#workflowMobileSlot .inclusive-purpose')).to_be_visible()
        page.locator('[data-workflow="separation"]').click()
        expect(page.locator('#ruleStudentA')).to_be_visible()
        page.screenshot(path=str(support.ROOT / 'test-results' / 'inclusion-purpose-mobile.png'))
        assert not errors, errors
        browser.close()
        print('Core feature discovery, demo masking, private pinned/separated draws and mobile entry passed')
finally:
    server.shutdown()
