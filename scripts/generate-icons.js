import fs from 'fs';
import path from 'path';

// Valid 1x1 base64 blue pixel PNG expanded or written directly
// Let's create an uncompressed/minimal PNG generator
function createSolidPng(width, height, r, g, b) {
  // Minimal PNG generator without external dependencies
  // Header
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth
  ihdrData.writeUInt8(2, 9); // color type 2: RGB
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT chunk (raw scanlines with zlib uncompressed format)
  // Each line has 1 filter byte (0) + width * 3 bytes
  const lineSize = 1 + width * 3;
  const rawData = Buffer.alloc(lineSize * height);
  for (let y = 0; y < height; y++) {
    const lineOffset = y * lineSize;
    rawData[lineOffset] = 0; // Filter: none
    for (let x = 0; x < width; x++) {
      const pixelOffset = lineOffset + 1 + x * 3;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
    }
  }

  import('zlib').then(({ deflateSync }) => {
    const compressed = deflateSync(rawData);
    const idatChunk = makeChunk('IDAT', compressed);
    const iendChunk = makeChunk('IEND', Buffer.alloc(0));

    const png = Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
    
    fs.mkdirSync('src/assets', { recursive: true });
    fs.writeFileSync(`src/assets/icon${width}.png`, png);
    console.log(`Generated icon${width}.png (${width}x${height})`);
  });
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  // CRC32
  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

// CRC32 Table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

createSolidPng(16, 16, 37, 99, 235);
createSolidPng(48, 48, 37, 99, 235);
createSolidPng(128, 128, 37, 99, 235);
