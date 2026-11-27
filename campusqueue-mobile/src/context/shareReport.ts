import { Directory, File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { Platform } from 'react-native';
import type { ApiDownload } from './apiClient';

export async function shareReport(report: ApiDownload) {
  const filename = report.filename ?? (report.contentType === 'application/pdf' ? 'campusqueue.pdf' : 'campusqueue.csv');
  if (Platform.OS === 'web') {
    const data = new Uint8Array(report.bytes.byteLength);
    data.set(report.bytes);
    const url = URL.createObjectURL(new Blob([data.buffer], { type: report.contentType }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  if (!(await isAvailableAsync())) throw new Error('File sharing is unavailable on this device.');
  const directory = new Directory(Paths.cache, 'campusqueue-' + Date.now());
  const file = new File(directory, filename);
  directory.create();
  try {
    await file.write(report.bytes);
    await shareAsync(file.uri, { mimeType: report.contentType, dialogTitle: 'CampusQueue report' });
  } finally {
    await directory.delete();
  }
}
