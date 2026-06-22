import { Injectable, inject } from '@angular/core';
import { ShoppingCategory } from '../interfaces/tile-settings';
import { SHOPPING_STORE_TEMPLATES, ShoppingStoreTemplate } from '../components/tile/shopping-tile/shopping-template.data';
import { LanguageService } from './language.service';
import { TranslationHelperService } from './translation-helper.service';
import { createShoppingId } from '../components/tile/shopping-tile/shopping-list.util';

export interface ShoppingTemplateMergeResult {
  categories: ShoppingCategory[];
  addedCategories: number;
  addedProducts: number;
}

@Injectable({ providedIn: 'root' })
export class ShoppingTemplateService {
  private readonly translation = inject(TranslationHelperService);
  private readonly language = inject(LanguageService);
  readonly templates = SHOPPING_STORE_TEMPLATES;

  merge(categories: ShoppingCategory[], templateId: string): ShoppingTemplateMergeResult {
    const template = this.templates.find(item => item.id === templateId);
    if (!template) return { categories, addedCategories: 0, addedProducts: 0 };

    const merged = categories.map(category => ({ ...category, products: category.products.map(product => ({ ...product })) }));
    let addedCategories = 0;
    let addedProducts = 0;

    for (const categoryTemplate of template.categories) {
      const categoryKey = this.categoryKey(template, categoryTemplate.id);
      const categoryName = this.categoryName(categoryTemplate.id);
      let category = merged.find(item => item.templateKey === categoryKey)
        ?? merged.find(item => this.normalize(item.name) === this.normalize(categoryName));
      if (!category) {
        category = {
          id: createShoppingId('category'),
          templateKey: categoryKey,
          name: categoryName,
          order: merged.length,
          products: []
        };
        merged.push(category);
        addedCategories++;
      } else if (!category.templateKey) {
        category.templateKey = categoryKey;
      }

      for (const productTemplate of categoryTemplate.products) {
        const productKey = this.productKey(productTemplate.id);
        const productName = this.productName(productTemplate.id);
        const existingProduct = category.products.find(item => item.templateKey === productKey
          || this.normalize(item.name) === this.normalize(productName));
        if (existingProduct) {
          existingProduct.templateKey ??= productKey;
          continue;
        }
        category.products.push({
          id: createShoppingId('product'),
          templateKey: productKey,
          name: productName,
          quantity: productTemplate.quantity,
          unit: productTemplate.unit,
          needed: false,
          done: false,
          order: category.products.length
        });
        addedProducts++;
      }
    }

    const collator = new Intl.Collator(this.language.effectiveLanguage(), { sensitivity: 'base', numeric: true });
    const sorted = merged
      .map(category => ({
        ...category,
        products: [...category.products]
          .sort((a, b) => collator.compare(a.name, b.name))
          .map((item, order) => ({ ...item, order }))
      }))
      .sort((a, b) => collator.compare(a.name, b.name))
      .map((item, order) => ({ ...item, order }));
    return { categories: sorted, addedCategories, addedProducts };
  }

  templateName(template: ShoppingStoreTemplate): string {
    return this.translation.t(`common.tiles.shopping.templates.stores.${template.id}`);
  }

  private categoryName(id: string): string {
    return this.translation.t(`common.tiles.shopping.templates.categories.${id}`);
  }

  private productName(id: string): string {
    return this.translation.t(`common.tiles.shopping.templates.products.${id}`);
  }

  private categoryKey(template: ShoppingStoreTemplate, id: string): string {
    return `${template.id}:${id}`;
  }

  private productKey(id: string): string {
    return `product:${id}`;
  }

  private normalize(value: string): string {
    return value.trim().toLocaleLowerCase(this.language.effectiveLanguage());
  }
}
