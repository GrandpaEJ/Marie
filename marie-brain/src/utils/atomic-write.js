import fs from 'fs';
import path from 'path';

/**
 * Atomic write prevents file corruption by writing to a temporary file 
 * and then renaming it to the target path.
 */
export function atomicWrite(filePath, data) {
  const tmpPath = filePath + '.tmp';
  const dir = path.dirname(filePath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  try {
    fs.writeFileSync(tmpPath, data);
    // Rename is atomic on most Unix-like systems and NTFS
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch (error) {
    if (fs.existsSync(tmpPath)) {
      try { fs.unlinkSync(tmpPath); } catch (e) {}
    }
    throw error;
  }
}

/**
 * Atomic write for JSON objects.
 */
export function atomicWriteJSON(filePath, obj) {
  return atomicWrite(filePath, JSON.stringify(obj, null, 2));
}
