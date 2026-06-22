import { Injectable, inject } from '@angular/core';
import { ShoppingCategory, ShoppingList, ShoppingProduct } from '../interfaces/tile-settings';
import { AvatarStorageService } from './avatar-storage.service';

@Injectable({ providedIn: 'root' })
export class ShoppingImageStorageService {
  private readonly storage = inject(AvatarStorageService);

  async hydrate(list: ShoppingList): Promise<ShoppingList> {
    return {
      ...list,
      categories: await Promise.all(list.categories.map(category => this.hydrateCategory(category)))
    };
  }

  async hydrateCategory(category: ShoppingCategory): Promise<ShoppingCategory> {
    const [image, backgroundImage, products] = await Promise.all([
      this.resolveUrl(category.image, category.imageFileId),
      this.resolveUrl(category.backgroundImage, category.backgroundImageFileId),
      Promise.all(category.products.map(product => this.hydrateProduct(product)))
    ]);
    return { ...category, image, backgroundImage, products };
  }

  async hydrateProduct(product: ShoppingProduct): Promise<ShoppingProduct> {
    return { ...product, image: await this.resolveUrl(product.image, product.imageFileId) };
  }

  async prepareForStorage(list: ShoppingList): Promise<ShoppingList> {
    const categories = await Promise.all(list.categories.map(async category => ({
      ...category,
      image: undefined,
      imageFileId: await this.persistDataUrl('avatar', category.image, category.imageFileId),
      backgroundImage: undefined,
      backgroundImageFileId: await this.persistDataUrl('background', category.backgroundImage, category.backgroundImageFileId),
      products: await Promise.all(category.products.map(async product => ({
        ...product,
        image: undefined,
        imageFileId: await this.persistDataUrl('avatar', product.image, product.imageFileId)
      })))
    })));
    return { ...list, categories };
  }

  stripRuntimeUrls(list: ShoppingList): ShoppingList {
    return {
      ...list,
      categories: list.categories.map(category => ({
        ...category,
        image: undefined,
        backgroundImage: undefined,
        products: category.products.map(product => ({ ...product, image: undefined }))
      }))
    };
  }

  private async resolveUrl(current: string | undefined, id: string | undefined): Promise<string | undefined> {
    if (current) return current;
    return (await this.storage.getImageUrl(id)) ?? undefined;
  }

  private async persistDataUrl(
    kind: 'avatar' | 'background',
    image: string | undefined,
    existingId: string | undefined
  ): Promise<string | undefined> {
    if (!image?.startsWith('data:image/')) return existingId;
    const stored = await this.storage.saveImageFromDataUrl(kind, image);
    if (!stored) throw new Error('Shopping image could not be stored in OPFS.');
    return stored.id;
  }

  async deleteRemovedFiles(previous: ShoppingList, current: ShoppingList): Promise<void> {
    const previousIds = this.collectFileIds(previous);
    const currentIds = this.collectFileIds(current);
    await Promise.all([...previousIds]
      .filter(id => !currentIds.has(id))
      .map(id => this.storage.deleteImage(id)));
  }

  private collectFileIds(list: ShoppingList): Set<string> {
    const ids = new Set<string>();
    for (const category of list.categories) {
      if (category.imageFileId) ids.add(category.imageFileId);
      if (category.backgroundImageFileId) ids.add(category.backgroundImageFileId);
      for (const product of category.products) {
        if (product.imageFileId) ids.add(product.imageFileId);
      }
    }
    return ids;
  }
}
