import type { Product } from '@/types';
import path from 'path';
import fs from 'fs';

/**
 * Load products from JSON file
 * This function loads your rewe_all_products.json file
 */
export function loadProducts(): Product[] {
  try {
    // Try to load from the data directory
    const dataPath = path.join(process.cwd(), 'src/data/rewe_all_products.json');
    
    if (fs.existsSync(dataPath)) {
      const data = fs.readFileSync(dataPath, 'utf-8');
      const products = JSON.parse(data) as Product[];
      console.log(`✅ Loaded ${products.length} products from ${dataPath}`);
      return products;
    }

    // Try to load from the root directory
    const rootPath = path.join(process.cwd(), 'rewe_all_products.json');
    
    if (fs.existsSync(rootPath)) {
      const data = fs.readFileSync(rootPath, 'utf-8');
      const products = JSON.parse(data) as Product[];
      console.log(`✅ Loaded ${products.length} products from ${rootPath}`);
      return products;
    }

    // If no file found, return sample data structure
    console.warn('⚠️ No products file found, using sample data structure');
    console.log('Expected locations:');
    console.log(`  - ${dataPath}`);
    console.log(`  - ${rootPath}`);
    
    // Return sample products for testing
    return getSampleProducts();

  } catch (error) {
    console.error('❌ Error loading products:', error);
    console.log('🔄 Falling back to sample products');
    return getSampleProducts();
  }
}

/**
 * Sample products for testing when the JSON file is not available
 */
function getSampleProducts(): Product[] {
  return [
    {
      category: "Obst & Gemüse",
      title: "Bio Avocados, 2 Stück",
      price: 2.99,
      volume: "2 Stück",
      url: "https://shop.rewe.de/p/bio-avocados-2-stueck/1234567"
    },
    {
      category: "Obst & Gemüse", 
      title: "Rispentomaten, 500g",
      price: 1.49,
      volume: "500g",
      url: "https://shop.rewe.de/p/rispentomaten-500g/2345678"
    },
    {
      category: "Obst & Gemüse",
      title: "Cherry Tomaten, 250g",
      price: 1.99,
      volume: "250g", 
      url: "https://shop.rewe.de/p/cherry-tomaten-250g/3456789"
    },
    {
      category: "Kochen & Backen",
      title: "Vollkorn Nudeln, 500g",
      price: 1.29,
      volume: "500g",
      url: "https://shop.rewe.de/p/vollkorn-nudeln-500g/4567890"
    },
    {
      category: "Käse, Eier & Molkerei",
      title: "Bio Vollmilch, 1L",
      price: 1.19,
      volume: "1L",
      url: "https://shop.rewe.de/p/bio-vollmilch-1l/5678901"
    }
  ];
}

/**
 * Validate product structure
 */
export function validateProducts(products: unknown[]): products is Product[] {
  if (!Array.isArray(products)) {
    return false;
  }

  // Check if all required fields are present in at least the first few items
  const sampleSize = Math.min(5, products.length);
  
  for (let i = 0; i < sampleSize; i++) {
    const product = products[i];
    
    if (typeof product !== 'object' || product === null) {
      return false;
    }

    const requiredFields = ['category', 'title', 'price', 'volume', 'url'];
    
    for (const field of requiredFields) {
      if (!(field in product)) {
        console.error(`❌ Missing required field '${field}' in product ${i}`);
        return false;
      }
    }

    // Validate field types
    const p = product as Record<string, unknown>;
    if (typeof p.category !== 'string' ||
        typeof p.title !== 'string' ||
        typeof p.price !== 'number' ||
        typeof p.volume !== 'string' ||
        typeof p.url !== 'string') {
      console.error(`❌ Invalid field types in product ${i}`);
      return false;
    }
  }

  return true;
}