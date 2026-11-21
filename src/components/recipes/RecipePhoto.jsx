import React from 'react';
import { useRecipeImageUrl } from '../../hooks/useRecipes';
import { chapterStyle } from '../../utils/recipeColors';
import { PlateIllustration } from './doodles';
import '../../css/recipes/RecipePhoto.css';

/**
 * A recipe's photo in a slightly rounded "sticker" frame, or a cute plate doodle tinted by its
 * chapter when there is no photo. `previewUrl` (a local object URL) wins over the server copy so
 * a freshly picked photo shows at once. Decorative by default (empty alt) because the title sits
 * beside it; pass `alt` when the photo stands alone.
 */
export default function RecipePhoto({ imageId, previewUrl, tabColor, alt = '', size = 'card', tilt = false }) {
  const { url, error } = useRecipeImageUrl(previewUrl ? null : imageId);
  const src = previewUrl || url;
  const wanted = Boolean(imageId || previewUrl);
  return (
    <div
      className={`recipe-photo recipe-photo--${size}${tilt ? ' recipe-photo--tilt' : ''}${src ? ' recipe-photo--has-image' : ''}`}
      style={chapterStyle(tabColor)}
      data-state={src ? 'ready' : wanted && !error ? 'loading' : 'empty'}
    >
      {src ? <img src={src} alt={alt} loading="lazy" decoding="async" /> : <PlateIllustration className="recipe-photo__plate" />}
    </div>
  );
}
