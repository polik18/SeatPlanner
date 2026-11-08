"""Shared local-only fixtures for v5 browser integration tests."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import threading
ROOT=Path(__file__).resolve().parents[1]
KEY='classroom-seat-master:v5'
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
def serve():
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    return server,f'http://127.0.0.1:{server.server_port}/'
def wire(page,errors):
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('dialog',lambda dialog:dialog.accept())
def seed(page,count=4,rows=1,cols=4):
    if page.locator('#welcomeDialog').is_visible():page.locator('#welcomeSkip').click()
    page.evaluate('''({key,count,rows,cols})=>{
      const s=SeatMaster.createDefaultState();s.config=SeatMaster.engine.normalizeConfig({...s.config,className:'Test class',rows,cols,maxNumber:count,emptyNumbers:'',femaleStart:count+1,studentData:'座號\\t姓名\\n1\\t阿明\\n2\\t小華\\n3\\t小安'});
      s.seats=SeatMaster.engine.buildSeatGrid(s.config,[]);SeatMaster.classData.ensure(s);
      const id=SeatMaster.classData.id(),entry=SeatMaster.classData.initializeEntry({id,state:s});
      const result=SeatMaster.storage.save({version:5,activeClassId:id,classes:[entry]});if(!result.ok)throw result.error;
    }''',dict(key=KEY,count=count,rows=rows,cols=cols))
    page.reload()
def workspace(page):return page.evaluate('(key)=>JSON.parse(localStorage.getItem(key))',KEY)
def active(page):
    page.wait_for_timeout(220)
    value=workspace(page)
    entry=next(entry for entry in value['classes'] if entry['id']==value['activeClassId'])
    if page.locator('#classroomWorkspace').is_visible() and entry['state'].get('layoutDraft'):
        entry={**entry,'state':entry['state']['layoutDraft']}
    return entry
def save_record(page,label):
    page.locator('#saveClassButton').click();page.locator('#classRecordName').fill(label);page.locator('#saveClassRecordButton').click()
def rule(page,a=1,b=2,same_table=False):
    value=active(page)['state'];identity={row['number']:row['studentId'] for row in value['rosterIdentity'] if row['number'] is not None}
    page.locator('#separationDetails').evaluate('(e)=>e.open=true')
    page.locator('#ruleStudentA').select_option(identity[a]);page.locator('#ruleStudentB').select_option(identity[b])
    page.locator('#ruleNotAdjacent').set_checked(not same_table);page.locator('#ruleNotSameTable').set_checked(same_table)
    page.locator('#saveSeparationRule').click()
