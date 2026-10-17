const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(DIR, { recursive: true });

// The file type is decided by the file's own first bytes, never by its name or the
// browser's claim. SVG is deliberately not allowed: it can carry scripts.
function detectExt(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return '.jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return '.png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return '.webp';
  return null;
}

// -> {} when no file was chosen, { error } when it is not acceptable, { filename } when saved
async function saveUpload(file) {
  if (!file || !file.size) return {};
  const ext = detectExt(file.buffer);
  if (!ext) return { error: 'Photo must be a JPG, PNG, or WebP image.' };
  const filename = crypto.randomBytes(16).toString('hex') + ext; // random name: nothing from the user
  await fs.promises.writeFile(path.join(DIR, filename), file.buffer, { flag: 'wx' });
  return { filename };
}

function remove(filename) {
  if (!/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(filename || '')) return;
  fs.promises.unlink(path.join(DIR, filename)).catch(() => {});
}

module.exports = { saveUpload, remove, detectExt, DIR };
