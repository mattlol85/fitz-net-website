import React, { useRef, useState } from 'react';
import { PHOTO_TYPES } from '../../services/recipesApi';
import RecipePhoto from './RecipePhoto';
import { CameraIcon } from './doodles';
import '../../css/recipes/PhotoPicker.css';

/**
 * One optional photo: click or drop to add, a sticker preview with Replace and Remove once there
 * is one. It only reports the picked file (`onPick`); the form uploads it.
 */
export default function PhotoPicker({ imageId, previewUrl, tabColor, uploading = false, error = '', onPick, onRemove }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const has = Boolean(imageId || previewUrl);

  const choose = () => inputRef.current?.click();
  const hasFiles = (event) => [...(event.dataTransfer?.types || [])].includes('Files');

  return (
    <div
      className={`photo-picker${over ? ' photo-picker--over' : ''}${has ? ' photo-picker--filled' : ''}`}
      onDragOver={(event) => {
        if (hasFiles(event)) {
          event.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        const file = event.dataTransfer.files?.[0];
        if (file) onPick(file);
      }}
    >
      {has ? (
        <>
          <RecipePhoto imageId={imageId} previewUrl={previewUrl} tabColor={tabColor} alt="Your recipe's photo" size="picker" tilt />
          <div className="photo-picker__actions">
            <button type="button" className="rb-button rb-button--small" onClick={choose} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Replace'}
            </button>
            <button type="button" className="rb-button rb-button--small rb-button--ghost" onClick={onRemove} disabled={uploading}>
              Remove
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="photo-picker__empty" onClick={choose} disabled={uploading}>
          <CameraIcon size={28} />
          <span className="photo-picker__label">{uploading ? 'Uploading…' : 'Add a photo'}</span>
          <span className="photo-picker__hint">Drop one here or tap to choose</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={PHOTO_TYPES.join(',')}
        className="rb-visually-hidden"
        tabIndex={-1}
        aria-label="Choose a photo"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onPick(file);
        }}
      />
      {error && (
        <p className="photo-picker__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
