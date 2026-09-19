const XLSX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

function decodeXml(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16))
    );
}

function columnIndexFromReference(reference) {
  const letters = String(reference || "").match(/[A-Z]+/i)?.[0] || "";
  let value = 0;

  for (const letter of letters.toUpperCase()) {
    value = value * 26 + letter.charCodeAt(0) - 64;
  }

  return Math.max(0, value - 1);
}

function readUint16(view, offset) {
  return view.getUint16(offset, true);
}

function readUint32(view, offset) {
  return view.getUint32(offset, true);
}

function locateEndOfCentralDirectory(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minimum = Math.max(0, bytes.byteLength - 65557);

  for (let offset = bytes.byteLength - 22; offset >= minimum; offset -= 1) {
    if (readUint32(view, offset) === 0x06054b50) {
      return offset;
    }
  }

  throw new Error("This Excel file could not be read. The ZIP directory is missing.");
}

function zipDirectory(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = locateEndOfCentralDirectory(bytes);
  const entryCount = readUint16(view, eocd + 10);
  const directoryOffset = readUint32(view, eocd + 16);
  const decoder = new TextDecoder("utf-8");
  const entries = new Map();
  let offset = directoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (readUint32(view, offset) !== 0x02014b50) {
      throw new Error("This Excel file has an unsupported ZIP directory.");
    }

    const compressionMethod = readUint16(view, offset + 10);
    const compressedSize = readUint32(view, offset + 20);
    const uncompressedSize = readUint32(view, offset + 24);
    const fileNameLength = readUint16(view, offset + 28);
    const extraLength = readUint16(view, offset + 30);
    const commentLength = readUint16(view, offset + 32);
    const localHeaderOffset = readUint32(view, offset + 42);
    const fileName = decoder.decode(
      bytes.slice(offset + 46, offset + 46 + fileNameLength)
    );

    entries.set(fileName, {
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

async function unzipText(bytes, entry) {
  if (!entry) {
    return "";
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const localOffset = entry.localHeaderOffset;

  if (readUint32(view, localOffset) !== 0x04034b50) {
    throw new Error("This Excel file contains an invalid ZIP entry.");
  }

  const fileNameLength = readUint16(view, localOffset + 26);
  const extraLength = readUint16(view, localOffset + 28);
  const dataStart = localOffset + 30 + fileNameLength + extraLength;
  const compressed = bytes.slice(dataStart, dataStart + entry.compressedSize);
  let output;

  if (entry.compressionMethod === 0) {
    output = compressed;
  } else if (entry.compressionMethod === 8) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error(
        "Your browser cannot read .xlsx files here. Use current Chrome/Edge or upload the CSV version."
      );
    }

    const stream = new Blob([compressed])
      .stream()
      .pipeThrough(new DecompressionStream("deflate-raw"));
    output = new Uint8Array(await new Response(stream).arrayBuffer());
  } else {
    throw new Error("This Excel file uses an unsupported compression method.");
  }

  return new TextDecoder("utf-8").decode(output);
}

function sharedStringsFromXml(xml) {
  if (!xml) {
    return [];
  }

  const values = [];
  const stringItems = xml.match(/<si(?:\s[^>]*)?>[\s\S]*?<\/si>/gi) || [];

  for (const item of stringItems) {
    const parts = [];
    const pattern = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gi;

    for (const match of item.matchAll(pattern)) {
      parts.push(decodeXml(match[1]));
    }

    values.push(parts.join(""));
  }

  return values;
}

function workbookSheetPath(workbookXml, relationshipXml) {
  const sheetMatch = workbookXml.match(
    /<sheet\b[^>]*name=["']Products["'][^>]*r:id=["']([^"']+)["'][^>]*\/?\s*>/i
  );

  if (!sheetMatch) {
    return "xl/worksheets/sheet1.xml";
  }

  const relationshipId = sheetMatch[1];
  const relationshipPattern = new RegExp(
    `<Relationship\\b[^>]*Id=["']${relationshipId}["'][^>]*Target=["']([^"']+)["'][^>]*/?>`,
    "i"
  );
  const relationshipMatch = relationshipXml.match(relationshipPattern);

  if (!relationshipMatch) {
    return "xl/worksheets/sheet1.xml";
  }

  const target = relationshipMatch[1].replace(/^\//, "");

  if (target.startsWith("xl/")) {
    return target;
  }

  return `xl/${target.replace(/^\.\//, "")}`;
}

function inlineStringFromCell(cellXml) {
  const parts = [];
  const pattern = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gi;
  for (const match of cellXml.matchAll(pattern)) {
    parts.push(decodeXml(match[1]));
  }

  return parts.join("");
}

function rowsFromWorksheetXml(xml, sharedStrings) {
  const rows = [];
  const rowPattern = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
  for (const rowMatch of xml.matchAll(rowPattern)) {
    const values = [];
    const cellPattern = /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/gi;

    for (const cellMatch of rowMatch[1].matchAll(cellPattern)) {
      const attributes = cellMatch[1] || cellMatch[3] || "";
      const body = cellMatch[2] || "";
      const reference = attributes.match(/\br=["']([^"']+)["']/i)?.[1] || "";
      const type = attributes.match(/\bt=["']([^"']+)["']/i)?.[1] || "";
      const index = columnIndexFromReference(reference);
      let value = "";

      if (type === "inlineStr") {
        value = inlineStringFromCell(body);
      } else {
        const raw = body.match(/<v>([\s\S]*?)<\/v>/i)?.[1] ?? "";

        if (type === "s") {
          value = sharedStrings[Number(raw)] ?? "";
        } else if (type === "b") {
          value = raw === "1";
        } else if (type === "str") {
          value = decodeXml(raw);
        } else if (raw !== "") {
          const numeric = Number(raw);
          value = Number.isFinite(numeric) ? numeric : decodeXml(raw);
        }
      }

      values[index] = value;
    }

    rows.push(values);
  }

  return rows;
}

function objectRows(matrix) {
  if (!matrix.length) {
    return [];
  }

  let headerIndex = matrix.findIndex((row) =>
    row.some((cell) => String(cell || "").trim() === "merchantSku")
  );

  if (headerIndex < 0) {
    headerIndex = 0;
  }

  const headers = matrix[headerIndex].map((value) => String(value || "").trim());

  return matrix
    .slice(headerIndex + 1)
    .map((row, offset) => {
      const item = {
        __rowNumber: headerIndex + offset + 2,
      };

      headers.forEach((header, index) => {
        if (header) {
          item[header] = row[index] ?? "";
        }
      });

      return item;
    })
    .filter((item) =>
      Object.entries(item).some(
        ([key, value]) => key !== "__rowNumber" && String(value ?? "").trim() !== ""
      )
    );
}

function parseCsvLine(line) {
  const result = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      result.push(value);
      value = "";
    } else {
      value += char;
    }
  }

  result.push(value);
  return result;
}

function parseCsvText(text) {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");

  return objectRows(lines.map(parseCsvLine));
}

async function parseXlsx(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = zipDirectory(bytes);
  const workbookXml = await unzipText(bytes, entries.get("xl/workbook.xml"));
  const relationshipsXml = await unzipText(
    bytes,
    entries.get("xl/_rels/workbook.xml.rels")
  );
  const sharedStringsXml = await unzipText(bytes, entries.get("xl/sharedStrings.xml"));
  const worksheetPath = workbookSheetPath(workbookXml, relationshipsXml);
  const worksheetXml = await unzipText(bytes, entries.get(worksheetPath));

  if (!worksheetXml) {
    throw new Error("The Excel workbook does not contain a readable Products sheet.");
  }

  return objectRows(
    rowsFromWorksheetXml(worksheetXml, sharedStringsFromXml(sharedStringsXml))
  );
}

export async function parseBulkNpiWorkbook(file) {
  if (!file) {
    return [];
  }

  const lowerName = String(file.name || "").toLowerCase();

  if (lowerName.endsWith(".csv") || file.type === "text/csv") {
    return parseCsvText(await file.text());
  }

  if (lowerName.endsWith(".xlsx") || XLSX_MIME_TYPES.has(file.type)) {
    return parseXlsx(file);
  }

  throw new Error("Upload the EPANTRY .xlsx template or an exported .csv file.");
}
