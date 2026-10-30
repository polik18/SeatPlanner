"""Browser smoke checks for no-seat students, room layouts, and task groups."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
KEY = "classroom-seat-master:v3"

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
errors = []
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(f"http://127.0.0.1:{server.server_port}/")
        page.locator("#maxNumberInput").fill("12")
        page.locator("#emptyNumbersInput").fill("")
        page.locator("#seatExcludedNumbersInput").fill("2, 5")
        page.locator("#seatExcludedNumbersInput").press("Tab")
        page.locator("#manualStartButton").click()
        expect(page.locator("#manualNonSeatStudents")).to_contain_text("2")
        expect(page.locator("#manualNonSeatStudents")).to_contain_text("5")
        page.wait_for_timeout(250)
        assert page.evaluate("(key) => Array.from(SeatMaster.engine.parseEmptyNumbers(JSON.parse(localStorage.getItem(key)).config.seatExcludedNumbers, 12))", KEY) == [2, 5]
        page.locator("[data-go-home]").first.click()

        page.locator('[data-room-template="round"]').click()
        page.wait_for_timeout(250)
        assert page.evaluate("(key) => JSON.parse(localStorage.getItem(key)).roomLayout.template", KEY) == "round"
        page.locator("#roomEditToggle").check()
        page.locator("#roomRotateRight").click()
        page.wait_for_timeout(250)
        assert page.evaluate("(key) => JSON.parse(localStorage.getItem(key)).roomLayout.tables[0].rotation", KEY) == 15
        page.locator("#roomAddPath").click()
        page.wait_for_timeout(250)
        paths = page.evaluate("(key) => JSON.parse(localStorage.getItem(key)).roomLayout.paths.length", KEY)
        assert paths == 1
        page.reload()
        expect(page.locator("[data-room-template='u']")).to_be_visible()
        page.locator('[data-room-template="u"]').click()
        page.wait_for_timeout(250)
        assert page.evaluate("(key) => JSON.parse(localStorage.getItem(key)).roomLayout.template", KEY) == "u"

        page.locator("#homeButton").click()
        page.locator("#groupPlannerOpen").click()
        expect(page.locator("#groupPlannerDialog")).to_be_visible()
        page.locator("#groupTaskName").fill("臨時任務")
        page.locator("#groupSize").select_option("3")
        page.locator("#groupStrategy").select_option("balanced")
        page.locator('[data-preassign-number="1"]').select_option("0")
        page.locator('[data-preassign-table="0"]').select_option(index=1)
        page.locator("#groupDrawButton").click()
        expect(page.locator(".task-group")).to_have_count(4)
        page.wait_for_timeout(250)
        result = page.evaluate("(key) => JSON.parse(localStorage.getItem(key))", KEY)
        activity = result["activities"][0]
        assert activity["title"] == "臨時任務"
        assert sorted(number for group in activity["groups"] for number in group["members"]) == list(range(1, 13))
        assert activity["groups"][0]["members"].count(1) == 1
        assert activity["groupTables"].get(activity["groups"][0]["id"]), activity
        assert result["hasDrawn"] is False
        page.locator("[data-group-lock]").first.click()
        before = page.evaluate("(key) => JSON.parse(localStorage.getItem(key)).activities[0].groups[0].members", KEY)
        page.locator("#groupRedrawButton").click()
        after = page.evaluate("(key) => JSON.parse(localStorage.getItem(key)).activities[0].groups[0].members", KEY)
        assert before == after
        page.locator("#groupUndoButton").click()
        page.locator("#groupRedoButton").click()
        page.reload()
        expect(page.locator("#groupPlannerOpen")).to_be_visible()
        page.locator("#groupPlannerOpen").click()
        expect(page.locator(".task-group")).to_have_count(4)
        page.locator("#groupPlannerClose").click()
        with page.expect_download() as download_event:
            page.locator("#exportButton").click()
        exported = Path(download_event.value.path()).read_bytes()
        page.locator("#importFileInput").set_input_files({"name": "task-backup.json", "mimeType": "application/json", "buffer": exported})
        page.wait_for_timeout(250)
        assert page.evaluate("(key) => JSON.parse(localStorage.getItem(key)).activities[0].title", KEY) == "臨時任務"
        assert not errors, errors
        print(json.dumps({"status": "passed", "page_errors": errors}))
        browser.close()
finally:
    server.shutdown()
