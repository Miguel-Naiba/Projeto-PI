from pathlib import Path
import subprocess,urllib.request,time,json,os,signal
root=Path(__file__).resolve().parent.parent
proc=subprocess.Popen(['npm','run','preview','--','--host','127.0.0.1','--port','4175'],cwd=root/'EchoPath',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
http=urllib.request.build_opener(urllib.request.ProxyHandler({}))
try:
 for i in range(60):
  try:
   http.open('http://127.0.0.1:4175/',timeout=1).close();break
  except OSError:time.sleep(.1)
 paths=['/','/icons.svg','/manifest.webmanifest','/sw.js']+['/'+str(p.relative_to(root/'EchoPath'/'dist')) for p in (root/'EchoPath'/'dist'/'assets').iterdir() if p.is_file()]+['/data/botoeiras-eptc.json','/data/paradas-tatil-eptc.json','/data/obras-smoi.json']
 checks=[]
 for path in paths:
  with http.open('http://127.0.0.1:4175'+path,timeout=5) as r:
   data=r.read();checks.append({'path':path,'status':r.status,'bytes':len(data)})
   assert r.status==200
   if path=='/icons.svg':assert all(x in data for x in [b'id="microfone"',b'id="microfone-ativo"',b'id="obras"'])
 (root/'auditoria-ui'/'preview-http.json').write_text(json.dumps({'checks':checks,'nota':'HTTP local apenas: não valida renderização, navegador, CORS, voz ou APIs externas.'},ensure_ascii=False,indent=2))
 print(f'{len(checks)} recursos HTTP 200; símbolos SVG disponíveis.')
finally:
 os.killpg(proc.pid,signal.SIGTERM);proc.wait()
