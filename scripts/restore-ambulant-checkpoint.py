"""Verify and unpack cumulative local checkpoints; supports FORMAT-v1 and legacy flat ZIP.
Usage: python this.py checkpoint.zip /ABSENT/NEW/checkpoint-unpacked
No bundle fetch/switch, upload, existing directory replacement or installs.
"""
from pathlib import Path,PurePosixPath
import hashlib,json,re,sys,tarfile,zipfile,io,os,lzma,stat
BOOK='CareSuite_Ambulant_A-Z_Arbeitsliste_2026-10-08.xlsx'
OUTER={'README.txt','ambulant-checkpoint.bundle','ambulant-checkpoint.patch',BOOK,'source.tar.xz','SOURCE_MANIFEST.json','SHA256SUMS.txt','restore-ambulant-checkpoint.py'}
def safe_source(name):
 if not isinstance(name,str) or not name.startswith('source/') or '\\' in name or ':' in name or any(ord(c)<32 or ord(c)==127 for c in name):raise ValueError('Unsafe source path')
 p=PurePosixPath(name)
 if p.is_absolute() or p.as_posix()!=name or len(p.parts)<2 or any(c in ('','..','.') for c in p.parts):raise ValueError('Unsafe source path')
 return name

def digest(stream):
 h=hashlib.sha256();n=0
 for b in iter(lambda:stream.read(1024*1024),b''):h.update(b);n+=len(b)
 return h.hexdigest(),n

def unique_pairs(pairs):
 result={}
 for key,value in pairs:
  if key in result:raise ValueError('Duplicate JSON key')
  result[key]=value
 return result

def regular_zip(info):
 # Legacy zipfile-generated entries may omit Unix file-type bits; never infer a link.
 return not info.is_dir() and stat.S_IFMT(info.external_attr>>16) in (0,stat.S_IFREG)

def strict_xz_payload(path,max_decoded):
 # Exactly one complete FORMAT_XZ/CRC64 stream. Read all bytes, including native checksum.
 decoder=lzma.LZMADecompressor(format=lzma.FORMAT_XZ);decoded=0
 with Path(path).open('rb') as inp:
  while True:
   compressed=inp.read(64*1024)
   if not compressed:raise ValueError('Incomplete XZ stream')
   block=decoder.decompress(compressed,max_length=1024*1024)
   while True:
    decoded+=len(block)
    if decoded>max_decoded:raise ValueError('Unanticipated decoded source size')
    if decoder.eof:
     if decoder.check!=lzma.CHECK_CRC64 or decoder.unused_data or inp.read(1):raise ValueError('Additional XZ stream/trailing bytes or wrong checksum contract')
     return decoded
    if decoder.needs_input:break
    block=decoder.decompress(b'',max_length=1024*1024)

def verify_tar(path,expected):
 # PAX name headers + regular-file padding + ordinary record padding fit this bound.
 max_decoded=sum(((x['bytes']+511)//512)*512+2048+len(name.encode('utf-8')) for name,x in expected.items())+10240
 decoded=strict_xz_payload(path,max_decoded)
 if decoded%512:raise ValueError('Unaligned decoded TAR payload')
 seen=set();logical_end=0
 with tarfile.open(path,'r:xz') as t:
  for m in t:
   name=safe_source(m.name)
   if name in seen or name not in expected or m.type not in (tarfile.REGTYPE,tarfile.AREGTYPE) or m.sparse is not None or any(k.startswith('GNU.sparse') for k in m.pax_headers) or m.size!=expected[name]['bytes']:raise ValueError('Nonregular/sparse/duplicate/unknown/size-mismatched source member')
   stream=t.extractfile(m)
   if stream is None:raise ValueError('Missing regular file stream')
   with stream:sha,size=digest(stream)
   if size!=m.size or sha!=expected[name]['sha256']:raise ValueError('Source byte/hash mismatch')
   seen.add(name);logical_end=m.offset_data+((m.size+511)//512)*512
  if seen!=set(expected):raise ValueError('Missing source member')
  if decoded-logical_end<1024:raise ValueError('Incomplete TAR end markers')
  # tarfile stops at first TAR EOF. Consume all remaining decoded bytes explicitly.
  t.fileobj.seek(logical_end);padding=0
  for block in iter(lambda:t.fileobj.read(1024*1024),b''):
   if any(block):raise ValueError('Nonzero bytes after logical TAR end')
   padding+=len(block)
  if logical_end+padding!=decoded:raise ValueError('TAR trailing-byte extent mismatch')

def restore_flat(archive,target):
 # Backward-compatible existing flat source/* ZIP; no conversion or overwritten checkout.
 with zipfile.ZipFile(archive) as z:
  names=z.namelist();base=OUTER-{'source.tar.xz','SOURCE_MANIFEST.json','restore-ambulant-checkpoint.py'}
  if len(names)!=len(set(names)) or not base.issubset(names) or any(n not in base and not n.startswith('source/') for n in names) or any(not regular_zip(z.getinfo(n)) for n in names):raise ValueError('Unknown/duplicate flat entries')
  if z.testzip() is not None:raise ValueError('Flat ZIP CRC mismatch')
  hashes={}
  for line in z.read('SHA256SUMS.txt').decode('utf-8').splitlines():
   h,n=line.split('  ',1)
   if n in hashes or not re.fullmatch('[0-9a-f]{64}',h):raise ValueError('Malformed flat manifest')
   hashes[n]=h
  if set(hashes)!=set(names)-{'SHA256SUMS.txt'}:raise ValueError('Incomplete flat manifest')
  sources=[safe_source(n) for n in names if n.startswith('source/')]
  for n in sources:
   if any(str(parent) in sources for parent in PurePosixPath(n).parents):raise ValueError('Flat source path collision')
  for name,h in hashes.items():
   with z.open(name) as inp:actual,size=digest(inp)
   if actual!=h or size!=z.getinfo(name).file_size:raise ValueError('Flat source/outer SHA mismatch')
  target.mkdir()
  for name in names:
   dest=target.joinpath(*PurePosixPath(name).parts);dest.parent.mkdir(parents=True,exist_ok=True)
   fd=os.open(dest,os.O_WRONLY|os.O_CREAT|os.O_EXCL|getattr(os,'O_NOFOLLOW',0),0o644)
   with os.fdopen(fd,'wb') as out,z.open(name) as inp:
    for b in iter(lambda:inp.read(1024*1024),b''):out.write(b)
   if name!='SHA256SUMS.txt':
    with dest.open('rb') as inp:actual,size=digest(inp)
    if actual!=hashes[name] or size!=z.getinfo(name).file_size:raise ValueError('Flat extracted byte mismatch')
 return {'sourceCount':len(sources),'sourceBytes':sum(z.getinfo(n).file_size for n in sources),'destination':str(target),'bundleRestore':'not_performed','sourceVerification':'all flat names/bytes matched','format':'legacy-flat'}

def restore(archive,target):
 archive=Path(archive).resolve();target=Path(target).absolute()
 if target.exists() or target.is_symlink() or not target.parent.is_dir():raise ValueError('Require absent new target in existing parent; never overwrite a checkout')
 with zipfile.ZipFile(archive) as z:
  names=z.namelist()
  if 'source.tar.xz' not in names:return restore_flat(archive,target)
  accepted=OUTER
  if len(names)!=len(set(names)) or set(names)!=accepted or any(not regular_zip(z.getinfo(n)) for n in names):raise ValueError('Unexpected/duplicate outer entries')
  if z.testzip() is not None:raise ValueError('ZIP CRC mismatch')
  hashes={}
  for line in z.read('SHA256SUMS.txt').decode('utf-8').splitlines():
   h,n=line.split('  ',1)
   if n in hashes or not re.fullmatch('[0-9a-f]{64}',h):raise ValueError('Malformed/duplicate outer manifest')
   hashes[n]=h
  if set(hashes)!=accepted-{'SHA256SUMS.txt'}:raise ValueError('Incomplete/unexpected outer manifest')
  for name,h in hashes.items():
   with z.open(name) as stream:actual,size=digest(stream)
   if actual!=h:raise ValueError('Outer SHA mismatch')
  manifest=json.loads(z.read('SOURCE_MANIFEST.json'),object_pairs_hook=unique_pairs)
  if set(manifest)!={'format','sourceCount','sourceBytes','entries'} or manifest['format']!='caresuite-source-tarxz-v1' or not isinstance(manifest['entries'],list):raise ValueError('Unknown source manifest format')
  expected={}
  for item in manifest['entries']:
   if not isinstance(item,dict) or set(item)!={'path','bytes','sha256'}:raise ValueError('Malformed source manifest item')
   name=safe_source(item['path'])
   if name in expected or type(item['bytes']) is not int or item['bytes']<0 or not re.fullmatch('[0-9a-f]{64}',item['sha256']):raise ValueError('Invalid/duplicate source manifest item')
   expected[name]=item
  if type(manifest['sourceCount']) is not int or manifest['sourceCount']!=len(expected) or type(manifest['sourceBytes']) is not int or manifest['sourceBytes']!=sum(x['bytes'] for x in expected.values()):raise ValueError('Source totals mismatch')
  for name in expected:
   if any(str(parent) in expected for parent in PurePosixPath(name).parents):raise ValueError('Source file/parent path collision')
  # Verified compressed bytes streamed to a temporary *new* sibling, not a source tree.
  import tempfile
  with tempfile.TemporaryDirectory(prefix='caresuite-verify-',dir=target.parent) as tmp:
   xz=Path(tmp)/'source.tar.xz'
   with z.open('source.tar.xz') as inp,xz.open('xb') as out:
    for b in iter(lambda:inp.read(1024*1024),b''):out.write(b)
   verify_tar(xz,expected) # All members and all bytes verified BEFORE target creation.
   target.mkdir() # Remains an explicitly identifiable partial staging tree if I/O fails later.
   with tarfile.open(xz,'r:xz') as t:
    for m in t:
     name=safe_source(m.name);dest=target.joinpath(*PurePosixPath(name).parts)
     dest.parent.mkdir(parents=True,exist_ok=True)
     flags=os.O_WRONLY|os.O_CREAT|os.O_EXCL|getattr(os,'O_NOFOLLOW',0)
     fd=os.open(dest,flags,0o644)
     with os.fdopen(fd,'wb') as out,t.extractfile(m) as inp:
      for b in iter(lambda:inp.read(1024*1024),b''):out.write(b)
     with dest.open('rb') as inp:actual,size=digest(inp)
     if actual!=expected[name]['sha256'] or size!=expected[name]['bytes']:raise ValueError('Extracted source bytes mismatch')
   for name in sorted(accepted-{'source.tar.xz'}):
    with (target/name).open('xb') as out,z.open(name) as inp:
     for b in iter(lambda:inp.read(1024*1024),b''):out.write(b)
   # Optional compressed input is not duplicated in the output tree. Original ZIP remains intact.
 return {'sourceCount':len(expected),'sourceBytes':sum(x['bytes'] for x in expected.values()),'destination':str(target),'bundleRestore':'not_performed','sourceVerification':'all names/regular members/bytes matched'}
if __name__=='__main__':print(json.dumps(restore(*sys.argv[1:3])))
