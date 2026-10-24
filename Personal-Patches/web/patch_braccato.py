"""One bounded local correction to pinned Braccato 1.16.11; reference packages stay intact."""
from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parent
p=root/'node_modules/@braccato/core/dist/engine.js'
data=p.read_bytes()
scroll_original=b'''                tabRenderer.scrollTop = scrollTop;
                engine.skipScrolls += 1;
                engine.skipScrollsDecayTimes.push(Date.now() + 2000);'''
scroll_patched=b'''                if (typeof tabRenderer.__bdScrollTo === "function") {
                    tabRenderer.__bdScrollTo(scrollTop);
                } else {
                    tabRenderer.scrollTop = scrollTop;
                    engine.skipScrolls += 1;
                    engine.skipScrollsDecayTimes.push(Date.now() + 2000);
                }'''
if scroll_patched in data:data=data.replace(scroll_patched,scroll_original)
original=b'    if (engine.skipScrolls < 1) {\n        engine.skipScrolls = 1;\n    }'
patched=b'    if (engine.skipScrolls < 0) {\n        engine.skipScrolls = 0;\n    }'
upstream='a3abca4640ef83edd4c5d2b34e7efb221e439365a24005051e34f92851c1f834'
if original in data:
    assert hashlib.sha256(data).hexdigest()==upstream,'Unexpected Braccato input'
    assert data.count(original)==1
    data=data.replace(original,patched)
else:
    assert data.count(patched)==1,'Missing local scroll correction'
    assert hashlib.sha256(data.replace(patched,original)).hexdigest()==upstream,'Unexpected patched Braccato input'
assert data.count(scroll_original)==1,'Unexpected Braccato scroll assignment'
data=data.replace(scroll_original,scroll_patched);p.write_bytes(data)
receipt={'package':'@braccato/core','version':'1.16.11','file':'dist/engine.js','upstreamSha256':upstream,'patchedSha256':hashlib.sha256(data).hexdigest(),'change':'Clamp expired scroll suppression at zero; delegate timed viewport scroll to the optional Android host sink without accumulating native-event skips. Other hosts retain the original path; timing/highlighting/agents are unchanged.'}
(root/'braccato-local-patch.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
print('Verified pinned Braccato scroll-suppression correction')
