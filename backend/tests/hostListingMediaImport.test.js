import test from 'node:test'
import assert from 'node:assert/strict'
import { driveImageFileId, validateImportedImageSource } from '../src/modules/hostOperations/hostListingMediaImport.service.js'
const sampleId = '1abcDEFghiJKLmNOPqrsTuvwxyz01234'
test('extract public Drive file id from share and open links', () => {
  assert.equal(driveImageFileId(`https://drive.google.com/file/d/${sampleId}/view?usp=sharing`), sampleId)
  assert.equal(driveImageFileId(`https://drive.google.com/open?id=${sampleId}`), sampleId)
  assert.equal(driveImageFileId(`https://drive.google.com/uc?export=download&id=${sampleId}`), sampleId)
})
test('reject arbitrary external, private-network and Drive folder links', () => {
  for (const value of ['http://localhost/a.png', 'https://127.0.0.1/foo.png', 'https://example.com/x.png', 'https://drive.google.com/drive/folders/12345', 'https://drive.google.com@evil.org/file/d/x/view']) {
    assert.throws(() => validateImportedImageSource(value, 'epantry'), /Only|public|HTTPS|Invalid/)
  }
})
test('allow known EPANTRY Cloudinary URLs and reject foreign accounts', () => {
  const path = 'https://res.cloudinary.com/epantry/image/upload/v1234567/x.jpg'
  assert.equal(validateImportedImageSource(path, 'epantry').imageUrl, path)
  assert.throws(() => validateImportedImageSource(path, 'other'), /EPANTRY/)
})
