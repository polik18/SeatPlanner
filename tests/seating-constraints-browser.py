"""Hard separation rules across real UI draw, manual, swaps and free layouts."""
import importlib.util,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
spec=importlib.util.spec_from_file_location('support',Path(__file__).with_name('v5-browser-support.py'));support=importlib.util.module_from_spec(spec);spec.loader.exec_module(support)
server,url=support.serve();errors=[]
try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch();page=browser.new_page(viewport={'width':1280,'height':900},reduced_motion='reduce');support.wire(page,errors);page.goto(url)
        support.seed(page,5,1,5);support.rule(page,1,2);support.rule(page,2,1);assert len(support.active(page)['state']['seatingConstraints']['pairs'])==1
        support.rule(page,1,3)
        private_ids=[row['studentId'] for row in support.active(page)['state']['rosterIdentity']]
        page.screenshot(path=str(support.ROOT/'test-results'/'v5-separation-desktop.png'))
        page.locator('#presentationButton').click()
        assert all(value not in page.content() for value in private_ids),'student identity registry must not enter projection DOM'
        for _ in range(15):
            page.locator('#drawButton').click();expect(page.locator('#drawButton')).to_be_enabled()
            value=support.active(page)['state'];assert value['hasDrawn']
            assert page.evaluate('''key=>{const w=JSON.parse(localStorage.getItem(key));const s=w.classes.find(c=>c.id===w.activeClassId).state;return SeatMaster.seatingConstraints.validateAssignment(s,s.assignment).valid;}''',support.KEY)
        with page.expect_download() as event:page.locator('#adminButton').click();page.locator('#shareChartButton').click()
        shared=Path(event.value.path()).read_text(encoding='utf-8');assert 'studentAId' not in shared and all(value not in shared for value in private_ids)
        # A fixed pair cannot be pinned to neighboring positions.
        support.seed(page,3,1,3);support.rule(page,1,2);page.locator('[data-admin-mode="prearrange"]').click()
        page.locator('.seat[data-seat-id="0-0"]').click();page.locator('#pinStudentSelect').select_option('1');page.locator('#pinForm button[value="default"]').click()
        page.locator('.seat[data-seat-id="0-1"]').click();page.locator('#pinStudentSelect').select_option('2');page.locator('#pinForm button[value="default"]').click()
        expect(page.locator('#pinDialog')).to_be_visible();assert next(seat for seat in support.active(page)['state']['seats'] if seat['id']=='0-1')['pin'] is None
        page.locator('#pinDialog [data-go-home]').click()
        # Calculation cancellation preserves the previous state (delayed solver seam).
        page.locator('#separationDetails').evaluate('(e)=>e.open=true');before_cancel=support.active(page)['state']
        page.evaluate('()=>{window.realSolve=SeatMaster.constrainedArranger.solve;SeatMaster.constrainedArranger.solve=(_s,o)=>new Promise(resolve=>o.signal.addEventListener("abort",()=>resolve({status:"cancelled"})));}')
        page.locator('#constraintRedrawButton').click();page.locator('#cancelConstraintDraw').click();expect(page.locator('#cancelConstraintDraw')).not_to_be_visible()
        assert support.active(page)['state']==before_cancel
        page.evaluate('()=>{SeatMaster.constrainedArranger.solve=window.realSolve;}')
        # Manual placement and result swapping cannot bypass hard rules.
        support.seed(page,3,1,3);support.rule(page,1,2);page.locator('#manualStartButton').click()
        page.locator('.seat[data-seat-id="0-0"]').click();page.locator('.seat[data-seat-id="0-1"]').click()
        assert support.active(page)['state']['manualDraft']['0-1'] is None
        page.locator('.seat[data-seat-id="0-2"]').click();page.locator('.seat[data-seat-id="0-1"]').click();page.locator('#manualFinishButton').click()
        expect(page.locator('body')).to_have_class('presentation-mode');prior=support.active(page)['state']['assignment']
        page.locator('#adminButton').click();page.locator('[data-admin-mode="adjust"]').click();page.locator('.seat[data-seat-id="0-0"]').click();page.locator('.seat[data-seat-id="0-1"]').click()
        assert support.active(page)['state']['assignment']==prior
        # Minimal unsatisfiable case preserves the old result and reports failure.
        support.seed(page,2,1,2);support.rule(page,1,2);page.locator('#presentationButton').click();page.locator('#drawButton').click()
        expect(page.locator('#drawMessage')).to_contain_text('沒有符合');assert not support.active(page)['state']['hasDrawn']
        page.locator('#adminButton').click()
        # Free layouts require an explicitly confirmed topology.
        support.seed(page,8,2,4);page.locator('[data-room-template="round"]').click();support.rule(page,1,2)
        page.locator('#presentationButton').click();page.locator('#drawButton').click();expect(page.locator('#drawMessage')).to_contain_text('鄰接圖');assert not support.active(page)['state']['hasDrawn']
        page.locator('#adminButton').click();page.locator('#openTopologyButton').click();page.locator('#topologyConfirm').click()
        page.locator('#presentationButton').click();page.locator('#drawButton').click();expect(page.locator('#drawButton')).to_be_enabled();assert support.active(page)['state']['hasDrawn']
        page.locator('#presentationRotateClockwiseButton').click();expect(page.locator('body')).not_to_have_class('presentation-mode')
        page.locator('#roomEditToggle').check();page.locator('#roomRotateRight').click()
        page.locator('#presentationButton').click();expect(page.locator('body')).not_to_have_class('presentation-mode')
        page.locator('#openTopologyButton').click();page.screenshot(path=str(support.ROOT/'test-results'/'v5-topology.png'));page.locator('#topologyConfirm').click()
        # A different-table rule is also enforced and survives refresh.
        support.rule(page,1,2,same_table=True);page.reload();page.locator('#separationDetails').evaluate('(e)=>e.open=true');page.locator('#constraintRedrawButton').click();expect(page.locator('#drawButton')).to_be_enabled()
        value=support.active(page)['state'];positions={number:seat for seat,number in value['assignment'].items() if number is not None};tables={seat:table['id'] for table in value['roomLayout']['tables'] for seat in table['seatIds']}
        assert tables[positions[1]]!=tables[positions[2]]
        assert not errors,errors;browser.close();print('separation browser: repeated draws, projection privacy, manual/swaps, infeasibility and topology enforcement passed')
finally:server.shutdown()
