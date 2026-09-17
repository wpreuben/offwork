#!/usr/bin/env python3
"""Run: python3 server.py --port 8000. Python standard library only."""
import argparse
import json
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse
from cdg.games import GAMES
from cdg.storage import Store, Conflict

ROOT=Path(__file__).resolve().parent
class Handler(BaseHTTPRequestHandler):
 server_version='CDGSolo/1.0'
 def send(self,status,data,content_type='application/json; charset=utf-8',download=None):
  body=json.dumps(data,ensure_ascii=False).encode() if content_type.startswith('application/json') else data
  self.send_response(status);self.send_header('Content-Type',content_type);self.send_header('Content-Length',str(len(body)))
  self.send_header('Cache-Control','no-store' if content_type.startswith('application/json') else 'no-cache')
  self.send_header('X-Content-Type-Options','nosniff')
  self.send_header('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'")
  if download:self.send_header('Content-Disposition',f'attachment; filename="{download}"')
  self.end_headers();self.wfile.write(body)
 def route(self,post=False):
  # Local service: block cross-origin writes and DNS-rebinding hosts.
  host=self.headers.get('Host','')
  if host.split(':')[0] not in ('localhost','127.0.0.1'): return self.send(403,{'error':'로컬 주소로 접속하세요.'})
  if post:
   origin=self.headers.get('Origin')
   if origin and origin!=f'http://{host}':return self.send(403,{'error':'다른 출처의 쓰기는 허용하지 않습니다.'})
  parts=urlparse(self.path).path.strip('/').split('/')
  store=self.server.store
  try:
   data={}
   if post:
    if self.headers.get_content_type()!='application/json':raise ValueError('Content-Type: application/json을 사용하세요.')
    length=int(self.headers.get('Content-Length','0'))
    if not 0<length<=65536:raise ValueError('요청 크기는 1~65536 바이트여야 합니다.')
    data=json.loads(self.rfile.read(length))
    if not isinstance(data,dict):raise ValueError('JSON 객체가 필요합니다.')
   if parts==['api','games'] and not post:
    return self.send(200,[{'id':g.ID,'name':g.NAME,'dice':g.DICE} for g in GAMES.values()])
   if parts==['api','catalog'] and not post:
    return self.send(200,GAMES['paths-of-glory'].CARDS)
   if parts==['api','sessions']:
    if post:
     options=data.get('options',{})
     if not isinstance(options,dict):raise ValueError('options는 객체여야 합니다.')
     session=store.create(data.get('game','paths-of-glory'),options,data.get('name',''))
     return self.send(201,store.response(session))
    return self.send(200,store.listing())
   if len(parts)>=3 and parts[:2]==['api','sessions']:
    sid=parts[2]
    if len(parts)==4 and parts[3]=='actions' and post:
     s=store.act(sid,data.get('expected_revision'),data.get('action'))
     return self.send(200,store.response(s))
    if not post:
     s=store.read(sid)
     if len(parts)==3:return self.send(200,store.response(s))
     if len(parts)==4 and parts[3]=='llm':return self.send(200,s['llm_context'],download=f'cdg-llm-{sid[:8]}-r{s["revision"]}.json')
     if len(parts)==4 and parts[3]=='export':return self.send(200,s,download=f'cdg-save-{sid[:8]}.json')
   if parts[0]=='api' or post:return self.send(404,{'error':'경로를 찾을 수 없습니다.'})
   path=unquote(urlparse(self.path).path)
   base=ROOT/'images' if path.startswith('/rules/') else ROOT/'web'
   relative=path[len('/rules/'):] if path.startswith('/rules/') else path.lstrip('/') or 'index.html'
   file=(base/relative).resolve()
   if not file.is_relative_to(base.resolve()) or not file.is_file():return self.send(404,{'error':'파일을 찾을 수 없습니다.'})
   mime=mimetypes.guess_type(file.name)[0] or 'application/octet-stream'
   return self.send(200,file.read_bytes(),mime)
  except Conflict as e:return self.send(409,{'error':str(e)})
  except FileNotFoundError:return self.send(404,{'error':'저장된 세션이 없습니다.'})
  except (ValueError,KeyError,TypeError) as e:return self.send(400,{'error':str(e)})
  except OSError:
   self.log_error('File access failed')
   return self.send(500,{'error':'파일 저장 또는 읽기에 실패했습니다. 저장 공간과 권한을 확인하세요.'})
 def do_GET(self):self.route()
 def do_POST(self):self.route(True)

def make_server(port=8000,data_dir=None):
 server=ThreadingHTTPServer(('127.0.0.1',port),Handler);server.store=Store(data_dir or ROOT/'data/sessions');return server

if __name__=='__main__':
 parser=argparse.ArgumentParser(description='CDG 솔로 시스템 로컬 웹앱')
 parser.add_argument('--port',type=int,default=8000);args=parser.parse_args()
 server=make_server(args.port)
 print(f'CDG Solo → http://localhost:{server.server_port}',flush=True)
 print(f'JSON saves → {server.store.root}',flush=True)
 try:server.serve_forever()
 except KeyboardInterrupt:pass
 finally:server.server_close()
