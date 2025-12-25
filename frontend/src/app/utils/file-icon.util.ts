export function getFileExtension(fileName: string): string {
  const trimmed = fileName.trim();
  const lastDot = trimmed.lastIndexOf('.');
  if (lastDot <= 0 || lastDot >= trimmed.length - 1) {
    return '';
  }
  return trimmed.slice(lastDot + 1).toLowerCase();
}

export function getFileIcon(fileName: string, mimeType?: string): string {
  const extension = getFileExtension(fileName);

  const extensionMap: Record<string, string> = {
    pdf: 'picture_as_pdf',
    doc: 'description',
    docx: 'description',
    odt: 'description',
    rtf: 'description',
    txt: 'text_snippet',
    md: 'text_snippet',
    csv: 'table_chart',
    xls: 'table_chart',
    xlsx: 'table_chart',
    ods: 'table_chart',
    ppt: 'slideshow',
    pptx: 'slideshow',
    odp: 'slideshow',
    zip: 'archive',
    rar: 'archive',
    '7z': 'archive',
    tar: 'archive',
    gz: 'archive',
    json: 'code',
    js: 'code',
    ts: 'code',
    html: 'code',
    css: 'code',
    yml: 'code',
    yaml: 'code',
    png: 'image',
    jpg: 'image',
    jpeg: 'image',
    gif: 'image',
    webp: 'image',
    bmp: 'image',
    svg: 'image',
    mp3: 'audiotrack',
    wav: 'audiotrack',
    ogg: 'audiotrack',
    flac: 'audiotrack',
    mp4: 'movie',
    mov: 'movie',
    avi: 'movie',
    mkv: 'movie',
    webm: 'movie'
  };

  if (extension && extensionMap[extension]) {
    return extensionMap[extension];
  }

  if (mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('audio/')) return 'audiotrack';
    if (mimeType.startsWith('video/')) return 'movie';
    if (mimeType === 'application/pdf') return 'picture_as_pdf';
    if (mimeType.includes('zip')) return 'archive';
  }

  return 'insert_drive_file';
}
