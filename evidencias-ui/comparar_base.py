from pathlib import Path
import zipfile,hashlib,json,difflib
raiz=Path(__file__).resolve().parent.parent
projeto=raiz/'EchoPath'
base=raiz/'base-auditoria'/'EchoPath-final (2).zip'
out=raiz/'auditoria-ui'
sha=lambda b:hashlib.sha256(b).hexdigest()
with zipfile.ZipFile(base) as z:
 registros=[];diff=[]
 for n in z.namelist():
  if n.endswith('/'):continue
  rel=n.split('EchoPath/',1)[-1];p=projeto/rel;b=z.read(n)
  # Documentação da entrega anterior será conservada diretamente do ZIP.
  atual=p.read_bytes() if p.is_file() else b
  mod=b!=atual
  registros.append({'arquivo':rel,'base_sha256':sha(b),'novo_sha256':sha(atual),'alterado':mod})
  if mod:
   diff.extend(difflib.unified_diff(b.decode().splitlines(True),atual.decode().splitlines(True),fromfile='base/'+rel,tofile='atual/'+rel))
 novos=['src/components/UI/Icone.tsx','src/components/interface.contrato.test.tsx']
 for rel in novos:
  atual=(projeto/rel).read_bytes()
  registros.append({'arquivo':rel,'novo_sha256':sha(atual),'novo':True})
  diff.extend(difflib.unified_diff([],atual.decode().splitlines(True),fromfile='/dev/null',tofile='atual/'+rel))
 (out/'alteracoes-ui.patch').write_text(''.join(diff))
 (out/'comparacao-base.json').write_text(json.dumps({'zip_base':base.name,'sha256_base':sha(base.read_bytes()),'arquivos':registros},ensure_ascii=False,indent=2))
 protegidos=[r for r in registros if r['arquivo'].startswith(('src/services/','public/data/')) or r['arquivo'] in ['src/Aplicativo.tsx','src/hooks/useLocaisSalvos.ts','src/hooks/useRotaAcessivel.ts','src/hooks/useDadosAcessibilidade.ts','src/hooks/useReportes.ts','src/hooks/useComandosVoz.ts','src/hooks/useDitadoVoz.ts','src/hooks/useNarracaoVoz.ts','src/hooks/useMediaSession.ts','src/hooks/usePreferenciasVisuais.ts','src/components/UI/categoriasReportar.ts','vite.config.ts','package.json','package-lock.json']]
 assert all(not r['alterado'] for r in protegidos)
 # Todos os handlers do formulário anteriores ao JSX são idênticos.
 n=next(n for n in z.namelist() if n.endswith('src/components/UI/Reportar.tsx'))
 b=z.read(n).decode().replace('\r\n','\n');s=(projeto/'src/components/UI/Reportar.tsx').read_text()
 handlers=lambda t:t[t.index('  function escolherTipo'):t.index('  if (!authSuportado)')]
 assert handlers(b)==handlers(s)
 # Nenhuma edição do .env real, sem mostrar seu conteúdo.
 with zipfile.ZipFile(raiz/'upload'/'EchoPath-final.zip') as original:
  envs=[n for n in original.namelist() if n.split('/')[-1]=='.env']
  assert len(envs)==1
  assert original.read(envs[0])==(projeto/'.env').read_bytes()
 resumo={'base_sha256':sha(base.read_bytes()),'alterados':[r['arquivo'] for r in registros if r.get('alterado')],'novos':novos,'arquivos_protegidos_identicos':len(protegidos),'handlers_formulario_identicos':True,'env_real_identico_ao_original':True,'dependencias_inalteradas':True}
 (out/'integridade.json').write_text(json.dumps(resumo,ensure_ascii=False,indent=2))
 print(json.dumps(resumo,ensure_ascii=False,indent=2))
