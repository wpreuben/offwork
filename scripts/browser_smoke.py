"""Physical PoG helper smoke test with temporary browser storage."""
import json
import shutil
import sys
import tempfile
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from cdg.storage import Store

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

with tempfile.TemporaryDirectory(prefix="cdg-physical-ui-") as directory:
    shutil.copytree(ROOT / "web", Path(directory) / "repo")
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=directory))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    site = f"http://127.0.0.1:{server.server_port}/repo/"
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, args=["--no-sandbox"])
            context = browser.new_context(viewport={"width": 1440, "height": 1080}, accept_downloads=True)
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("response", lambda response: errors.append(f"HTTP {response.status}: {response.url}") if response.status >= 400 else None)
            page.on("request", lambda request: errors.append(f"Unexpected API: {request.url}") if "/api/" in request.url else None)
            page.goto(site)
            expect(page.locator('a[href="./paths-of-glory.html"]')).to_be_visible()
            page.locator('a[href="./paths-of-glory.html"]').click()
            expect(page.get_by_text("실물 카드 진행 헬퍼")).to_be_visible()
            page.get_by_role("button", name="새 게임 시작").last.click()
            page.locator('#setup-form input[name="name"]').fill("실물 카드 검증")
            page.get_by_role("button", name="헬퍼 시작").click()
            expect(page.locator(".physical-meter")).to_have_count(2)
            assert page.locator(".card-button").count() == 0
            expect(page.locator("#save-status")).to_contain_text("r0")
            page.get_by_role("button", name="카드 사용·보충 완료").click()
            expect(page.locator(".physical-meter.cp strong")).to_contain_text("6")
            page.get_by_role("button", name="운명 주사위 굴리기").click()
            expect(page.locator(".main-instruction")).to_be_visible()
            assert page.locator(".fate-face").count() == 1
            page.screenshot(path="/tmp/cdg-physical-result.png", full_page=True)
            page.get_by_role("button", name="추가 카드를 받아 카운트 유지하고 완료").click()
            expect(page.locator("#save-status")).to_contain_text("r3")
            expect(page.locator(".physical-meter.ap strong")).to_contain_text("7")
            page.locator('#note-form input').fill("실물 카드와 전선 확인")
            page.get_by_role("button", name="메모 저장").click()
            expect(page.locator("#save-status")).to_contain_text("r4")
            page.reload()
            expect(page.locator("#save-status")).to_contain_text("r4")
            with page.expect_download() as download:
                page.locator("#export-save").click()
            backup = json.loads(Path(download.value.path()).read_text())
            assert backup["schema_version"] == 2
            assert backup["state"]["physical"] is True
            assert "deck" not in backup["state"]["sides"]["cp"]
            assert backup["revision"] == 4 and len(backup["history"]) == 5
            page.evaluate("async () => {const {FileStore}=await import('./physical-storage.js');window.testStore=await FileStore.open()}")
            assert page.evaluate("sid => window.testStore.read(sid)", backup["id"]) == backup
            page.locator("#import-file").set_input_files({"name": "backup.json", "mimeType": "application/json", "buffer": json.dumps(backup).encode()})
            expect(page.locator("#toast")).to_contain_text("별도 게임으로 가져왔습니다")
            listing = page.evaluate("() => window.testStore.listing()")
            assert len(listing) == 2
            imported = page.evaluate("sid => window.testStore.read(sid)", listing[0]["id"])
            assert imported["id"] != backup["id"] and imported["state"] == backup["state"]
            for invalid in [{"state": backup["state"]}, {**backup, "schema_version": 99}, {**backup, "state": {**backup["state"], "physical": False}}]:
                page.locator("#import-file").set_input_files({"name": "invalid.json", "mimeType": "application/json", "buffer": json.dumps(invalid).encode()})
                expect(page.locator("#toast")).to_contain_text("가져올 수 없는 저장 파일")
            assert len(page.evaluate("() => window.testStore.listing()")) == 2
            other = context.new_page()
            other.goto(site + "paths-of-glory.html")
            expect(other.locator("#save-status")).to_contain_text("r4")
            other.locator('#note-form input').fill("다른 탭")
            other.get_by_role("button", name="메모 저장").click()
            expect(other.locator("#save-status")).to_contain_text("r5")
            page.locator('#note-form input').fill("오래된 탭")
            page.get_by_role("button", name="메모 저장").click()
            expect(page.locator("#toast")).to_contain_text("다른 선택이 먼저 저장되었습니다")
            expect(page.locator("#save-status")).to_contain_text("r5")
            failure = page.evaluate("""async sid => {
                const store=window.testStore,before=await store.read(sid),original=FileSystemFileHandle.prototype.createWritable;
                FileSystemFileHandle.prototype.createWritable=async function(){const writer=await original.call(this);writer.write=async()=>{throw new DOMException('disk full','QuotaExceededError')};return writer};
                let rejected=false;try{await store.act(sid,before.revision,{type:'note',text:'failed write'})}catch{rejected=true}finally{FileSystemFileHandle.prototype.createWritable=original}
                return {rejected,unchanged:JSON.stringify(before)===JSON.stringify(await store.read(sid))};
            }""", imported["id"])
            assert failure == {"rejected": True, "unchanged": True}, failure
            legacy = Store(Path(directory) / "legacy").create("paths-of-glory", {"guns": True}, "이전 게임")
            page.locator("#import-file").set_input_files({"name": "legacy.json", "mimeType": "application/json", "buffer": json.dumps(legacy).encode()})
            expect(page.locator("#toast")).to_contain_text("별도 게임으로 가져왔습니다")
            with page.expect_download() as download:
                page.locator("#export-save").click()
            converted = json.loads(Path(download.value.path()).read_text())
            assert converted["schema_version"] == 2
            assert converted["state"]["turn"] == legacy["state"]["turn"]
            assert converted["state"]["sides"]["cp"]["remaining"] == legacy["state"]["sides"]["cp"]["remaining"]
            assert any(item["legacy"] for item in page.evaluate("() => window.testStore.listing()"))
            page.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('disabled')}})")
            page.reload()
            expect(page.locator(".physical-action")).to_be_visible()
            page.set_viewport_size({"width": 390, "height": 844})
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "Mobile horizontal overflow"
            page.screenshot(path="/tmp/cdg-physical-mobile.png", full_page=True)
            assert not errors, errors
            print("PASS: physical cards UI, dice, count, OPFS, JSON backup, legacy conversion, concurrent tabs, write failure, mobile")
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
