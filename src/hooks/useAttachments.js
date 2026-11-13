import { useCallback, useEffect, useRef, useState } from 'react';
import { uploadAttachment } from '../services/aiChatApi';
import { downsizeImage } from '../utils/imageDownsize';
import { IMAGE_TYPES, MAX_ATTACHMENTS } from '../components/ai/aiChatUtils';

const revoke = (item) => {
  if (item.previewUrl) URL.revokeObjectURL?.(item.previewUrl);
};

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('The image could not be read.'));
    reader.readAsDataURL(blob);
  });
}

let nextKey = 1;

/**
 * Images waiting to go out with the next message. Each file is type-checked, downsized in the
 * browser, uploaded at once and tracked as an item:
 * `{ key, name, status: 'uploading' | 'ready' | 'error', previewUrl, attachment?, error? }`.
 * `message` holds the last rejection ("Only PNG, JPEG and WebP...", the 4-image limit).
 */
export default function useAttachments({ token }) {
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState(null);
  const itemsRef = useRef([]);

  const commit = useCallback((next) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  const patch = useCallback(
    (key, changes) => {
      // The item may have been removed while it was uploading.
      if (!itemsRef.current.some((i) => i.key === key)) return false;
      commit(itemsRef.current.map((i) => (i.key === key ? { ...i, ...changes } : i)));
      return true;
    },
    [commit]
  );

  const process = useCallback(
    async (key, file) => {
      try {
        const shrunk = await downsizeImage(file);
        const previewUrl = URL.createObjectURL?.(shrunk.blob) ?? null;
        if (!patch(key, { previewUrl, name: shrunk.name })) {
          if (previewUrl) URL.revokeObjectURL?.(previewUrl);
          return;
        }
        const attachment = await uploadAttachment(token, {
          name: shrunk.name,
          mimeType: 'image/jpeg',
          dataBase64: await toBase64(shrunk.blob),
        });
        patch(key, { status: 'ready', attachment });
      } catch (err) {
        patch(key, { status: 'error', error: err.message || 'Upload failed.' });
      }
    },
    [token, patch]
  );

  /** Adds files (from the picker, a paste or a drop), enforcing the type and count limits. */
  const add = useCallback(
    (fileList) => {
      let files = [...fileList];
      setMessage(null);

      const valid = files.filter((f) => IMAGE_TYPES.includes(f.type));
      if (valid.length < files.length) setMessage('Only PNG, JPEG and WebP images can be attached.');
      files = valid;

      const room = MAX_ATTACHMENTS - itemsRef.current.length;
      if (files.length > room) {
        setMessage(`You can attach up to ${MAX_ATTACHMENTS} images per message.`);
        files = files.slice(0, Math.max(room, 0));
      }
      if (files.length === 0) return;

      const added = files.map((file) => ({
        key: `att-${nextKey++}`,
        name: file.name || 'image',
        status: 'uploading',
        previewUrl: null,
        file,
      }));
      commit([...itemsRef.current, ...added]);
      added.forEach((item) => process(item.key, item.file));
    },
    [commit, process]
  );

  const remove = useCallback(
    (key) => {
      const gone = itemsRef.current.find((i) => i.key === key);
      if (gone) revoke(gone);
      commit(itemsRef.current.filter((i) => i.key !== key));
      setMessage(null);
    },
    [commit]
  );

  /** Takes everything out for sending; the previews stay valid until `release` or `restore`. */
  const take = useCallback(() => {
    const taken = itemsRef.current;
    commit([]);
    setMessage(null);
    return taken;
  }, [commit]);

  const restore = useCallback((taken) => commit([...taken, ...itemsRef.current]), [commit]);
  const release = useCallback((taken) => taken.forEach(revoke), []);

  useEffect(
    () => () => {
      itemsRef.current.forEach(revoke);
    },
    []
  );

  return { items, message, setMessage, add, remove, take, restore, release };
}
