// EPANTRY Bulk ZIP media import. Browser-only; existing Excel + JSON flows stay intact.
// ZIP format: one .xlsx workbook alongside media/<listing_key>/{front,back,video,...}
// Uploads use the existing signed Host Cloudinary endpoints. No ZIP is sent to the server.
const ZIP_LIMIT = 320 * 1024 * 1024;
const UNPACKED_LIMIT = 450 * 1024 * 1024;
const ENTRY_LIMIT = 1000;
const IMAGE_LIMIT = 8 * 1024 * 1024;
const VIDEO_LIMIT = 50 * 1024 * 1024;
const IMAGE_COUNT_LIMIT = 500;
const VIDEO_COUNT_LIMIT = 100;
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const VIDEO_EXT = /\.(mp4|webm)$/i;
const textDecoder = new TextDecoder();

function fail(message) { throw new Error(message); }
function isUrl(value) { return /^https:\/\//i.test(value); }
function normalizePath(path) {
  const value = String(path || '');
  if (!value || value.includes('\\') || /[\x00-\x1f?#]/.test(value) || value.startsWith('/') || /^[a-zA-Z]:/.test(value) || value.length > 300) fail(`Invalid ZIP path: ${value.slice(0, 70)}`);
  const parts = value.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) fail(`Unsafe ZIP path: ${value.slice(0, 70)}`);
  return parts.join('/');
}
function normalizedReference(path) {
  const value = String(path || '').replace(/^\.\//, '').trim();
  return normalizePath(value).toLowerCase();
}
function isMacMetadata(path) {
  return path.startsWith('__MACOSX/') || path.split('/').some((part) => part === '.DS_Store' || part.startsWith('._'));
}
function readIndex(fileBytes) {
  const view = new DataView(fileBytes);
  const length = view.byteLength;
  let end = -1;
  for (let at = length - 22; at >= Math.max(0, length - 65557); at--) {
    if (view.getUint32(at, true) === 0x06054b50) { end = at; break; }
  }
  if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) fail('Invalid or multi-part ZIP archive.');
  const count = view.getUint16(end + 10, true);
  const dirSize = view.getUint32(end + 12, true);
  let position = view.getUint32(end + 16, true);
  if (!count || count > ENTRY_LIMIT || position + dirSize > end) fail('ZIP has too many files or an invalid directory.');
  const indexed = new Map();
  let uncompressedTotal = 0;
  for (let i = 0; i < count; i++) {
    if (position + 46 > end || view.getUint32(position, true) !== 0x02014b50) fail('ZIP directory is damaged.');
    const flags = view.getUint16(position + 8, true);
    const method = view.getUint16(position + 10, true);
    const checksum = view.getUint32(position + 16, true);
    const compressed = view.getUint32(position + 20, true);
    const original = view.getUint32(position + 24, true);
    const filenameLength = view.getUint16(position + 28, true);
    const extraLength = view.getUint16(position + 30, true);
    const commentLength = view.getUint16(position + 32, true);
    const external = view.getUint32(position + 38, true);
    const localOffset = view.getUint32(position + 42, true);
    const nameBytesEnd = position + 46 + filenameLength;
    if (nameBytesEnd > end) fail('ZIP entry filename is truncated.');
    const rawName = textDecoder.decode(new Uint8Array(fileBytes, position + 46, filenameLength));
    position = nameBytesEnd + extraLength + commentLength;
    if (position > end) fail('ZIP directory is damaged.');
    if (rawName.endsWith('/') || isMacMetadata(rawName)) continue;
    if ((flags & 1) || (flags & 8 && method === 0 && compressed === 0)) fail('Encrypted or unsupported ZIP entry.');
    if (method !== 0 && method !== 8) fail('ZIP compression must be Stored or Deflated.');
    if (((external >>> 16) & 0o170000) === 0o120000) fail('ZIP symbolic links are not supported.');
    const name = normalizePath(rawName);
    if (localOffset + 30 > length || view.getUint32(localOffset, true) !== 0x04034b50) fail(`Broken ZIP entry: ${name}`);
    const localLen = view.getUint16(localOffset + 26, true);
    const localExtra = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localLen + localExtra;
    if (dataStart + compressed > length) fail(`ZIP file data is incomplete: ${name}`);
    if (original > VIDEO_LIMIT && !/\.xlsx$/i.test(name)) fail(`File is too large: ${name}`);
    uncompressedTotal += original;
    if (uncompressedTotal > UNPACKED_LIMIT) fail('ZIP expands beyond 450 MB. Split it into smaller batches.');
    const key = name.toLowerCase();
    if (indexed.has(key)) fail(`Duplicate ZIP filename: ${name}`);
    indexed.set(key, { name, compressed, original, checksum, method, dataStart });
  }
  return indexed;
}
function crc32(data) {
  let crc = 0xffffffff;
  for (const item of data) {
    crc ^= item;
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
async function extract(arrayBuffer, entry) {
  const compressed = new Uint8Array(arrayBuffer, entry.dataStart, entry.compressed);
  let result;
  if (entry.method === 0) {
    result = new Uint8Array(compressed);
  } else {
    if (typeof DecompressionStream !== 'function') fail('Update Chrome, Edge, Firefox or Safari to open ZIP imports.');
    try {
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      const reader = stream.getReader();
      const chunks = []; let total = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        total += part.value.byteLength;
        if (total > entry.original) { await reader.cancel(); fail(`ZIP entry expanded beyond its declared size: ${entry.name}`); }
        chunks.push(part.value);
      }
      result = new Uint8Array(total);
      let at = 0;
      for (const chunk of chunks) { result.set(chunk, at); at += chunk.byteLength; }
    } catch { fail(`Cannot decompress ZIP entry: ${entry.name}`); }
  }
  if (result.byteLength !== entry.original || crc32(result) !== entry.checksum) fail(`ZIP checksum failed: ${entry.name}`);
  return result;
}
function checkMedia(bytes, entry) {
  const name = entry.name;
  const isImage = IMAGE_EXT.test(name);
  if (!isImage && !VIDEO_EXT.test(name)) fail(`Unsupported media extension: ${name}`);
  if (isImage && bytes.length > IMAGE_LIMIT) fail(`Image larger than 8 MB: ${name}`);
  if (!isImage && bytes.length > VIDEO_LIMIT) fail(`Video larger than 50 MB: ${name}`);
  const ascii = (start, end) => String.fromCharCode(...bytes.slice(start, end));
  const jpeg = /\.jpe?g$/i.test(name) && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = /\.png$/i.test(name) && bytes[0] === 0x89 && ascii(1, 4) === 'PNG';
  const webp = /\.webp$/i.test(name) && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
  const mp4 = /\.mp4$/i.test(name) && ascii(4, 8) === 'ftyp';
  const webm = /\.webm$/i.test(name) && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  if (!(jpeg || png || webp || mp4 || webm)) fail(`Media type and file contents do not match: ${name}`);
  return jpeg ? 'image/jpeg' : png ? 'image/png' : webp ? 'image/webp' : mp4 ? 'video/mp4' : 'video/webm';
}
function mediaSort(a, b) {
  const order = (name) => /(^|\/)front\./i.test(name) ? -2 : /(^|\/)back\./i.test(name) ? -1 : 0;
  return order(a) - order(b) || a.localeCompare(b, undefined, { numeric: true });
}
function lookupLocal(path, index, root) {
  const key = normalizedReference(path);
  const entry = index.get((root + key).toLowerCase()) || index.get(key);
  if (!entry) fail(`Missing media file referenced in Excel: ${path}`);
  return entry;
}
export async function previewHostBulkZip(file, allowedTypes, parseWorkbook) {
  if (!file || !/\.zip$/i.test(file.name || '')) fail('Choose a ZIP file containing your EPANTRY .xlsx and media folder.');
  if (file.size > ZIP_LIMIT) fail('ZIP must be 320 MB or smaller. Split large imports into batches.');
  const raw = await file.arrayBuffer();
  const entries = readIndex(raw);
  const workbooks = [...entries.values()].filter((entry) => /\.xlsx$/i.test(entry.name) && !entry.name.split('/').some((part) => part.startsWith('~$')));
  if (workbooks.length !== 1) fail('Include exactly ONE .xlsx workbook per ZIP. Keep other workbooks in separate ZIPs.');
  if (workbooks[0].original > 3 * 1024 * 1024) fail('Excel workbook exceeds the 3 MB limit.');
  const root = workbooks[0].name.slice(0, workbooks[0].name.lastIndexOf('/') + 1);
  const workbookBytes = await extract(raw, workbooks[0]);
  const workbook = new File([workbookBytes], workbooks[0].name.split('/').pop(), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const parsed = await parseWorkbook(workbook, allowedTypes, { allowLocalMediaPaths: true });
  if (!Array.isArray(parsed.listingKeys) || parsed.listingKeys.length !== parsed.packets.length) fail('Bulk workbook parser does not expose listing keys. Update the bulk importer files.');
  const mediaEntries = [...entries.values()].filter((entry) => IMAGE_EXT.test(entry.name) || VIDEO_EXT.test(entry.name));
  const images = mediaEntries.filter((entry) => IMAGE_EXT.test(entry.name));
  const videos = mediaEntries.filter((entry) => VIDEO_EXT.test(entry.name));
  if (images.length > IMAGE_COUNT_LIMIT) fail('Maximum 500 image files per ZIP batch.');
  if (videos.length > VIDEO_COUNT_LIMIT) fail('Maximum 100 video files per ZIP batch.');
  for (const entry of mediaEntries) {
    if (entry.original > (IMAGE_EXT.test(entry.name) ? IMAGE_LIMIT : VIDEO_LIMIT)) fail(`Media exceeds upload size limit: ${entry.name}`);
  }
  const used = new Set();
  const findEntry = (path) => {
    const result = lookupLocal(path, entries, root);
    used.add(result.name.toLowerCase());
    return root && result.name.startsWith(root) ? result.name.slice(root.length) : result.name;
  };
  const linkedMedia = (key) => {
    const prefix = `${root}media/${key}/`.toLowerCase();
    return mediaEntries.filter((entry) => entry.name.toLowerCase().startsWith(prefix));
  };
  const packets = parsed.packets.map((packet, i) => {
    const listingKey = parsed.listingKeys[i];
    if (listingKey.includes('/') || listingKey.includes('\\') || listingKey === '.' || listingKey === '..') fail(`Unsafe listing_key: ${listingKey}`);
    const found = linkedMedia(listingKey);
    const paths = found.map((e) => ({ full: e.name, relative: root ? e.name.slice(root.length) : e.name }));
    const at = (branch) => paths.filter((p) => p.relative.toLowerCase().startsWith(`media/${listingKey}/${branch}`.toLowerCase()));
    const cover = paths.filter((p) => IMAGE_EXT.test(p.full) && !/\/(ingredients|steps)\//i.test(p.relative)).sort((a,b)=>mediaSort(a.relative,b.relative));
    const explicit = packet.images.map((p) => isUrl(p) ? p : findEntry(p));
    const joined = [...explicit, ...cover.map((p) => p.relative)].filter((value, index, array) => array.findIndex((p) => p.toLowerCase() === value.toLowerCase()) === index);
    if (joined.length > 12) fail(`${listingKey} has ${joined.length} main photos; maximum is 12.`);
    for (const item of joined) if (!isUrl(item)) findEntry(item);
    const ingredients = packet.ingredients.map((ingredient, n) => {
      const choices = at(`ingredients/${String(n+1).padStart(2,'0')}.`).filter((p) => IMAGE_EXT.test(p.full));
      const value = ingredient.imageUrl ? (isUrl(ingredient.imageUrl) ? ingredient.imageUrl : findEntry(ingredient.imageUrl)) : (choices[0]?.relative || '');
      if (value && !isUrl(value)) findEntry(value);
      return { ...ingredient, imageUrl: value };
    });
    const steps = packet.steps.map((step, n) => {
      const choices = at(`steps/${String(n+1).padStart(2,'0')}.`).filter((p) => IMAGE_EXT.test(p.full));
      const value = step.imageUrl ? (isUrl(step.imageUrl) ? step.imageUrl : findEntry(step.imageUrl)) : (choices[0]?.relative || '');
      if (value && !isUrl(value)) findEntry(value);
      return { ...step, imageUrl: value };
    });
    const localVideos = paths.filter((p) => VIDEO_EXT.test(p.full));
    if (packet.type === 'grocery' && localVideos.length) fail(`${listingKey}: grocery video is not supported by the existing product model. Remove the video or import it with a recipe listing.`);
    if (localVideos.length > 1) fail(`${listingKey}: use only one MP4/WebM video per recipe.`);
    const videoUrl = packet.videoUrl ? (isUrl(packet.videoUrl) ? packet.videoUrl : findEntry(packet.videoUrl)) : (localVideos[0]?.relative || '');
    if (videoUrl && !isUrl(videoUrl)) {
      if (packet.type === 'grocery') fail(`${listingKey}: grocery video is not supported.`);
      if (!VIDEO_EXT.test(videoUrl)) fail(`${listingKey}: recipe video must be MP4 or WebM.`);
      findEntry(videoUrl);
    }
    return { ...packet, images: joined, ingredients, steps, videoUrl };
  });
  const refs = new Set(); let videoCount = 0;
  for (const packet of packets) {
    packet.images.forEach((item) => refs.add(item));
    packet.ingredients.forEach((row) => { if (row.imageUrl) refs.add(row.imageUrl); });
    packet.steps.forEach((row) => { if (row.imageUrl) refs.add(row.imageUrl); });
    if (packet.videoUrl && !isUrl(packet.videoUrl)) videoCount++;
  }
  if (refs.size > IMAGE_COUNT_LIMIT) fail('Maximum 500 unique images (local plus URLs) per batch.');
  const issues = parsed.issues.filter((issue) => !(issue.message.includes('Add a main image') && packets.some((p, i) => parsed.listingKeys[i] === issue.key && p.images.length)));
  const unused = mediaEntries.filter((entry) => !used.has(entry.name.toLowerCase()));
  if (unused.length) issues.push({ key: 'ZIP media', message: `${unused.length} file(s) were not matched to a listing key and will not be uploaded: ${unused.slice(0,3).map((e)=>e.name).join(', ')}` });
  return { ...parsed, source: 'zip', packets, issues, imageCount: refs.size, videoCount, mediaCount: refs.size, archive: { raw, entries, root } };
}
export async function ingestHostBulkZipMedia(preview, { uploadImage, uploadVideo, importRemoteImage }, onProgress) {
  const allImages = new Set(); const allVideos = new Set();
  preview.packets.forEach((packet) => {
    packet.images.forEach((item) => allImages.add(item));
    packet.ingredients.forEach((row) => { if (row.imageUrl) allImages.add(row.imageUrl); });
    packet.steps.forEach((row) => { if (row.imageUrl) allImages.add(row.imageUrl); });
    if (packet.videoUrl && !isUrl(packet.videoUrl)) allVideos.add(packet.videoUrl);
  });
  const tasks = [ ...[...allImages].map((ref) => ({ ref, video: false })), ...[...allVideos].map((ref) => ({ ref, video: true })) ];
  let completed = 0; let current = 0; let error = null;
  const replacements = new Map();
  async function worker() {
    while (!error) {
      const n = current++;
      if (n >= tasks.length) return;
      const task = tasks[n];
      try {
        let url;
        if (isUrl(task.ref)) {
          const result = await importRemoteImage(task.ref);
          url = result?.imageUrl;
        } else {
          const entry = lookupLocal(task.ref, preview.archive.entries, preview.archive.root);
          const bytes = await extract(preview.archive.raw, entry);
          const mime = checkMedia(bytes, entry);
          if (mime.startsWith('video/') !== task.video) fail(`Wrong media type for ${entry.name}`);
          const mediaFile = new File([bytes], entry.name.split('/').pop(), { type: mime });
          url = task.video ? await uploadVideo(mediaFile) : await uploadImage(mediaFile);
        }
        if (!url || !/^https:\/\//i.test(url)) fail(`Upload did not return an HTTPS URL: ${task.ref}`);
        replacements.set(task.ref, url);
        completed++;
        onProgress?.(completed, tasks.length);
      } catch (cause) { error = new Error(`${task.ref}: ${cause?.message || 'Media upload failed'}`); return; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(2, tasks.length) }, () => worker()));
  if (error) throw error;
  return preview.packets.map((packet) => ({
    ...packet,
    images: packet.images.map((ref) => replacements.get(ref)),
    ingredients: packet.ingredients.map((row) => ({ ...row, imageUrl: row.imageUrl ? replacements.get(row.imageUrl) : '' })),
    steps: packet.steps.map((row) => ({ ...row, imageUrl: row.imageUrl ? replacements.get(row.imageUrl) : '' })),
    videoUrl: packet.videoUrl && !isUrl(packet.videoUrl) ? replacements.get(packet.videoUrl) : packet.videoUrl,
  }));
}
