/** Reads a File or Blob as bare base64 (no `data:` prefix), the shape the upload endpoints take. */
export default function fileToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('The image could not be read.'));
    reader.readAsDataURL(blob);
  });
}
