"""Modal welcome/tour visuals, animated navigation, focus and reduced-motion behavior."""
import importlib.util
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
spec=importlib.util.spec_from_file_location('support',Path(__file__).with_name('v5-browser-support.py'))
support=importlib.util.module_from_spec(spec);spec.loader.exec_module(support)
server,url=support.serve();errors=[]
try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch()
        page=browser.new_page(viewport={'width':1440,'height':960},reduced_motion='no-preference')
        support.wire(page,errors);page.goto(url)
        expect(page.locator('#welcomeDialog')).to_be_visible()
        assert page.locator('#welcomeDialog').evaluate('(e)=>e.matches(":modal")')
        assert 'introArrive' in page.locator('#welcomeDialog').evaluate('(e)=>getComputedStyle(e).animationName')
        backdrop=page.locator('#welcomeDialog').evaluate('(e)=>getComputedStyle(e,"::backdrop").backdropFilter')
        assert 'blur' in backdrop
        page.locator('#carouselNext').click();expect(page.locator('.welcome-art').nth(1)).to_be_visible()
        page.locator('#carouselPause').click();expect(page.locator('#carouselPause')).to_have_attribute('aria-pressed','true')
        original=support.workspace(page)
        page.locator('#welcomeStart').click()
        assert page.locator('#tourDialog').evaluate('(e)=>e.matches(":modal")')
        expect(page.locator('#tourScene')).to_have_attribute('data-step','class')
        for _ in range(18):
            page.keyboard.press('Tab')
            assert page.evaluate('document.getElementById("tourDialog").contains(document.activeElement)')
        page.screenshot(animations='disabled',path=str(support.ROOT/'test-results'/'intro-tour-desktop.png'))
        for index,key in enumerate(['class','room','priority','seat','share']):
            page.locator(f'[data-tour-step="{index}"]').click()
            expect(page.locator('#tourScene')).to_have_attribute('data-step',key)
            expect(page.locator('#tourProgress')).to_contain_text(f'{index+1} / 5')
            expect(page.locator('#tourMeterFill')).to_have_attribute('style',f'width: {(index+1)*20}%;')
        assert support.workspace(page)==original, 'tour navigation must not edit class data'
        page.locator('#tourNext').click();expect(page.locator('#readyDialog')).to_be_visible()
        page.screenshot(animations='disabled',path=str(support.ROOT/'test-results'/'intro-ready.png'))
        page.locator('#readyCreate').click()
        # A chosen action hands off to the real editor, without a second modal left behind.
        page.locator('#tutorialButton').click();page.locator('#welcomeStart').click()
        page.locator('[data-tour-step="1"]').click();page.locator('#tourTry').click()
        expect(page.locator('#classroomWorkspace')).to_be_visible()
        assert not page.locator('#tourDialog').evaluate('(e)=>e.open')
        page.locator('[data-canvas-action="done"]').click()
        # Compact layouts and reduced motion retain all navigation and modal focus.
        reduced=browser.new_context(viewport={'width':360,'height':800},reduced_motion='reduce')
        phone=reduced.new_page();support.wire(phone,errors);phone.goto(url)
        assert phone.locator('#welcomeDialog').evaluate('(e)=>getComputedStyle(e).animationName')=='none'
        expect(phone.locator('#carouselPause')).to_have_attribute('aria-pressed','true')
        phone.locator('#welcomeStart').click();phone.locator('[data-tour-step="2"]').click()
        assert phone.locator('#tourDialog').evaluate('(e)=>getComputedStyle(e).animationName')=='none'
        assert phone.locator('.tour-body').evaluate('(e)=>e.getAnimations().length')==0
        phone.screenshot(animations='disabled',path=str(support.ROOT/'test-results'/'intro-tour-phone.png'))
        phone.keyboard.press('Escape');expect(phone.locator('#tourDialog')).not_to_be_visible()
        phone.locator('#tutorialButton').click();phone.locator('#welcomeDialog .language-button').click()
        expect(phone.locator('#welcomeStart')).to_have_text('Get started')
        phone.locator('#welcomeStart').click();expect(phone.locator('#tourTry')).to_have_text('Try this step now ↗')
        phone.locator('#tourClose').click();expect(phone.locator('#tourDialog')).not_to_be_visible()
        reduced.close();assert not errors,errors;browser.close()
        print('Polished onboarding: native modals, animated transitions, focus, five scenes, handoff, phone and reduced motion passed')
finally:server.shutdown()
