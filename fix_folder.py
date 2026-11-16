import pathlib, re
# every caller already names a folder, so the default is only ever reached by mistake
p = pathlib.Path('server/services/storage.js'); s = p.read_text()
m = re.search(r"export async function saveUpload\(\{ buffer, originalname, mimeType, folder = 'products' \}\) \{", s)
assert m, 'saveUpload signature not found'
s = s.replace(m.group(0), """export async function saveUpload({ buffer, originalname, mimeType, folder }) {
  /*
   * No default folder. There used to be `folder = 'products'`, which meant a
   * caller that passed undefined - a renamed variable, a route copied without
   * its last argument - silently wrote user files into the product image folder,
   * where the storefront lists them. The argument is required in every call site
   * today, so a missing folder is a programming error and now reads as one
   * instead of as a location choice.
   */""", 1)
p.write_text(s)
b = p.read_text()
assert "folder = 'products'" not in b
print('saveUpload requires an explicit folder')

# persistMulterFile must forward nothing implicit
q = pathlib.Path('server/services/storage.js'); t = q.read_text()
assert 'persistMulterFile' in t
print('persistMulterFile present:', 'export async function persistMulterFile' in t)
