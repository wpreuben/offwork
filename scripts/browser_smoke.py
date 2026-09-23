"""Optional real-browser smoke test. Uses temporary sessions, never player saves.
Requires playwright and Chromium. See docs/TESTING.md.
"""
import json
import sys
import tempfile
import threading
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import shutil

class QuietHandler(SimpleHTTPRequestHandler):
 def log_message(self, *args): pass
from playwright.sync_api import sync_playwright,expect
from cdg.storage import Store

with tempfile.TemporaryDirectory(prefix='cdg-ui-') as directory:
 shutil.copytree(ROOT/'web',Path(directory)/'repo')
 server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=directory))
 thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
 site=f'http://127.0.0.1:{server.server_port}/repo/'
 url=site+'paths-of-glory.html'
 try:
  with sync_playwright() as pw:
   browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
   context=browser.new_context(viewport={'width':1440,'height':1080},device_scale_factor=1)
   page=context.new_page()
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('response',lambda r:errors.append(f'HTTP {r.status}: {r.url}') if r.status>=400 else None)
   page.on('request',lambda r:errors.append(f'Unexpected API: {r.url}') if '/api/' in r.url else None)
   page.goto(site)
   expect(page.locator('a[href="./paths-of-glory.html"]')).to_be_visible()
   expect(page.locator('a[href="./combat-commander/"]')).to_be_visible()
   page.locator('a[href="./paths-of-glory.html"]').click()
   expect(page.get_by_text('두 진영의 선택,')).to_be_visible()
   page.screenshot(path='/tmp/cdg-welcome.png',full_page=True)
   page.get_by_role('button',name='첫 번째 게임 시작').click()
   page.locator('#setup-form input[name=name]').fill('브라우저 검증')
   page.get_by_role('button',name='테이블 열기').click()
   expect(page.locator('.board')).to_have_count(2)
   expect(page.locator('#save-status')).to_contain_text('r0')
   page.locator('[data-inspect="cp:C"]').click()
   page.locator('#play-form input[name=base_legal]').check()
   page.get_by_role('button',name='이 카드 사용').click()
   expect(page.locator('#save-status')).to_contain_text('r1')
   page.get_by_role('button',name='효과 해결 완료').click()
   expect(page.locator('#save-status')).to_contain_text('r2')
   page.locator('.manual-roll summary').click()
   page.locator('.manual-roll button').filter(has_text='4').click()
   expect(page.locator('#save-status')).to_contain_text('r3')
   page.evaluate('window.scrollTo(0, 0)')
   page.screenshot(path='/tmp/cdg-table.png',full_page=True)
   page.locator('[data-inspect="ap:A"]').click()
   expect(page.locator('#play-form')).to_be_visible()
   page.locator('#play-form input[name=base_legal]').check()
   page.get_by_role('button',name='이 카드 사용').click()
   page.get_by_role('button',name='효과 해결 완료').click()
   expect(page.locator('#save-status')).to_contain_text('r5')
   page.locator('#note-form input').fill('서부 전선 확인 <script>alert(1)</script>')
   page.get_by_role('button',name='메모 저장').click()
   expect(page.locator('#save-status')).to_contain_text('r6')
   page.reload();expect(page.locator('#save-status')).to_contain_text('r6')
   page.locator('nav [data-view=llm]').click()
   expect(page.locator('#llm-example')).to_contain_text('expected_revision')
   proposal=json.loads(page.locator('#llm-example').inner_text())
   page.locator('#proposal-input').fill(json.dumps(proposal))
   page.locator('#review-proposal').click()
   expect(page.locator('#apply-proposal')).to_be_disabled()
   page.locator('#proposal-confirm').check();page.locator('#apply-proposal').click()
   expect(page.locator('#save-status')).to_contain_text('r7')
   with page.expect_download() as download:
    page.locator('#download-llm').click()
   public=json.loads(Path(download.value.path()).read_text())
   assert 'deck' not in public['state']['sides']['cp']
   assert public['revision']==7
   page.locator('nav [data-view=history]').click()
   expect(page.locator('.archive tbody tr')).to_have_count(8)
   page.locator('nav [data-view=rules]').click()
   expect(page.get_by_text('사용자 확인: 마타 하리 = 동맹군 #17')).to_be_visible()
   for link in page.locator('.source-link').all():
    assert page.request.get(site+link.get_attribute('href').removeprefix('./')).ok
   page.locator('nav [data-view=table]').click()
   page.set_viewport_size({'width':390,'height':844})
   assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Mobile horizontal overflow'
   page.evaluate('window.scrollTo(0, 0)')
   page.screenshot(path='/tmp/cdg-mobile.png',full_page=True)
   page.locator('[data-inspect="cp:A"]').click()
   expect(page.locator('#inspector')).to_be_visible()
   # Read actual JSON files, not browser key/value state.
   with page.expect_download() as download:
    page.locator('#export-save').click()
   envelope=json.loads(Path(download.value.path()).read_text())
   assert envelope['revision']==7 and len(envelope['history'])==8
   page.evaluate("""async () => {const {FileStore}=await import('./storage.js');window.testStore=await FileStore.open();}""")
   persisted=page.evaluate('(sid)=>window.testStore.read(sid)',envelope['id'])
   assert persisted==envelope
   # Round-trip, with a fresh ID so an import never overwrites existing progress.
   page.locator('#import-file').set_input_files({'name':'backup.json','mimeType':'application/json','buffer':json.dumps(envelope).encode()})
   expect(page.locator('#toast')).to_contain_text('별도 게임으로 가져왔습니다')
   expect(page.locator('#save-status')).to_contain_text('r7')
   imported=page.evaluate('async()=>await window.testStore.listing()')
   assert len(imported)==2
   restored=page.evaluate('(sid)=>window.testStore.read(sid)',imported[0]['id'])
   assert restored['id']!=envelope['id'] and restored['state']==envelope['state'] and restored['history']==envelope['history']
   # Public JSON and damaged backups must not create a session.
   for bad in [public,{**envelope,'schema_version':999},{**envelope,'state':{**envelope['state'],'mata_hari_number':22}}]:
    page.locator('#import-file').set_input_files({'name':'invalid.json','mimeType':'application/json','buffer':json.dumps(bad).encode()})
    expect(page.locator('#toast')).to_contain_text('가져올 수 없는 저장 파일')
    assert len(page.evaluate('()=>window.testStore.listing()'))==2
   # Concurrent tabs: one commits and the stale writer receives 409.
   other=page.context.new_page();other.goto(url)
   expect(other.locator('#save-status')).to_contain_text('r7')
   other.locator('#note-form input').fill('다른 탭의 선택');other.get_by_role('button',name='메모 저장').click()
   expect(other.locator('#save-status')).to_contain_text('r8')
   page.locator('#note-form input').fill('오래된 탭');page.get_by_role('button',name='메모 저장').click()
   expect(page.locator('#toast')).to_contain_text('다른 선택이 먼저 저장되었습니다')
   expect(page.locator('#save-status')).to_contain_text('r8')
   # A failed stream write never advances the file, revision, or checkpoints.
   failure=page.evaluate("""async sid=>{
    const store=window.testStore,before=await store.read(sid);
    const original=FileSystemFileHandle.prototype.createWritable;
    FileSystemFileHandle.prototype.createWritable=async function(){const writer=await original.call(this);writer.write=async()=>{throw new DOMException('test full disk','QuotaExceededError')};return writer;};
    let rejected=false;try{await store.act(sid,before.revision,{type:'note',text:'must not persist'});}catch{rejected=true;}finally{FileSystemFileHandle.prototype.createWritable=original;}
    return {rejected,unchanged:JSON.stringify(before)===JSON.stringify(await store.read(sid))};
   }""",restored['id'])
   assert failure=={'rejected':True,'unchanged':True},failure
   page.reload();expect(page.locator('#save-status')).to_contain_text('r8')
   # Import an actual Python Store envelope, independent from browser export.
   legacy=Store(Path(directory)/'legacy-private').create('paths-of-glory',{'guns':True},'기존 Python 게임')
   page.locator('#import-file').set_input_files({'name':'legacy.json','mimeType':'application/json','buffer':json.dumps(legacy).encode()})
   expect(page.locator('#toast')).to_contain_text('별도 게임으로 가져왔습니다')
   expect(page.locator('#save-status')).to_contain_text('r0')
   with page.expect_download() as legacy_download:
    page.locator('#export-save').click()
   legacy_import=json.loads(Path(legacy_download.value.path()).read_text())
   assert legacy_import['state']==legacy['state'] and legacy_import['history']==legacy['history']
   # Disable localStorage entirely: the JSON files still restore from their listing.
   page.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('disabled')}})")
   page.reload();expect(page.locator('#save-status')).to_contain_text('r0')
   assert not errors,errors
   print('PASS: static /repo/ hosting without API; official art; desktop/mobile; rules flow; OPFS/reload; LLM; JSON round-trip; invalid imports; concurrent tabs; write failure.')
   print('Screenshots: /tmp/cdg-welcome.png /tmp/cdg-table.png /tmp/cdg-mobile.png')
   browser.close()
 finally:server.shutdown();server.server_close()
