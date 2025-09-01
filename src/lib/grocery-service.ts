/**
 * Main grocery shopping service - ports the Python SmartGroceryShoppingSystem
 */

import type {
  Product,
  ShoppingItem,
  ProductMatch,
  ShoppingResult,
  SearchTiers
} from '@/types';
import { VolumeParser } from './volume-parser';
import { OpenAIClient } from './openai-client';

export class GroceryService {
  private products: Product[];
  private volumeParser: VolumeParser;

  // Available Rewe categories
  private static readonly REWE_CATEGORIES = [
    "Obst & Gemüse",
    "Fertiggerichte & Konserven",
    "Fleisch & Fisch",
    "Kochen & Backen",
    "Käse, Eier & Molkerei",
    "Brot, Cerealien & Aufstriche",
    "Süßes & Salziges",
    "Öle, Soßen & Gewürze"
  ];

  constructor(products: Product[]) {
    this.products = products;
    this.volumeParser = new VolumeParser();
    console.log(`🧠 GroceryService initialized with ${products.length} products`);
    
    // Log product distribution across categories
    const categoryStats = this.getCategoryStats();
    console.log('📊 Product distribution:', categoryStats);
  }

  /**
   * Main processing method - converts shopping list to results
   */
  async processShoppingList(shoppingList: string): Promise<ShoppingResult> {
    console.log('🛒 Starting grocery shopping process');
    const timestamp = new Date().toISOString();
    const candidatesLog: Record<string, Array<{ product: Product; score: number; tier: string }>> = {};

    try {
      // Step 1: Parse shopping list with AI
      console.log('📝 Parsing shopping list...');
      const shoppingItems = await this.parseShoppingList(shoppingList);
      console.log(`📋 Parsed ${shoppingItems.length} items`);

      const foundItems: ProductMatch[] = [];
      const notFound: string[] = [];

      // Step 2: Process each item
      for (let i = 0; i < shoppingItems.length; i++) {
        const item = shoppingItems[i];
        console.log(`🔄 Processing item ${i + 1}/${shoppingItems.length}: ${item.originalText}`);

        // Find matching products
        const candidates = await this.findMatchingProducts(item);
        candidatesLog[item.originalText] = candidates.slice(0, 3);

        if (candidates.length === 0) {
          notFound.push(item.originalText);
          console.log(`❌ No matches found for ${item.item}`);
          continue;
        }

        // Try to calculate quantity for best match
        const bestMatch = await this.calculateQuantityForProduct(item, candidates[0]);
        
        if (bestMatch) {
          foundItems.push(bestMatch);
          console.log(`✅ Added to basket: ${bestMatch.product.title}`);
        } else {
          notFound.push(item.originalText);
          console.log(`❌ Couldn't calculate quantities for ${item.item}`);
        }
      }

      const totalCost = foundItems.reduce((sum, item) => sum + item.totalPrice, 0);

      const result: ShoppingResult = {
        foundItems,
        notFound,
        totalCost,
        timestamp,
        originalList: shoppingList,
        candidatesConsidered: candidatesLog,
        summary: {
          totalItemsRequested: shoppingItems.length,
          itemsFound: foundItems.length,
          itemsNotFound: notFound.length,
          successRate: (foundItems.length / Math.max(1, shoppingItems.length)) * 100
        }
      };

      console.log(`📊 Final summary: ${foundItems.length}/${shoppingItems.length} items found, €${totalCost.toFixed(2)} total`);
      return result;

    } catch (error) {
      console.error('❌ Error processing shopping list:', error);
      throw error;
    }
  }

  /**
   * Parse shopping list using AI
   */
  private async parseShoppingList(shoppingList: string): Promise<ShoppingItem[]> {
    try {
      const parsed = await OpenAIClient.parseShoppingList(shoppingList);
      
      return parsed.items.map(item => ({
        item: item.item,
        amount: item.amount,
        unit: item.unit,
        originalText: item.original,
        attributes: item.attributes || [],
        alternatives: item.alternatives || [],
        itemType: item.item_type as ShoppingItem['itemType']
      }));
    } catch (error) {
      console.error('❌ AI parsing failed, using fallback:', error);
      return this.fallbackParse(shoppingList);
    }
  }

  /**
   * Fallback parsing for when AI fails
   */
  private fallbackParse(shoppingList: string): ShoppingItem[] {
    const lines = shoppingList.trim().split('\n').filter(line => line.trim());
    
    return lines.map(line => ({
      item: line.trim(),
      amount: 1,
      unit: 'stück',
      originalText: line.trim(),
      attributes: [],
      alternatives: [],
      itemType: 'unknown' as const
    }));
  }

  /**
   * Find matching products using multi-tier search
   */
  private async findMatchingProducts(item: ShoppingItem): Promise<Array<{ product: Product; score: number; tier: string }>> {
    console.log(`🔍 Finding products for: ${item.item}`);

    try {
      // Step 1: Determine target categories
      const categoryResult = await OpenAIClient.determineCategories(
        item.item,
        item.itemType,
        item.attributes,
        item.originalText
      );
      const targetCategories = categoryResult.categories;
      console.log(`📂 Target categories: ${targetCategories.join(', ')}`);

      // Step 2: Generate search terms
      const searchTiers = await OpenAIClient.generateSearchTiers(
        item.item,
        item.attributes,
        item.alternatives,
        item.itemType
      );
      console.log('🎯 Search tiers generated');

      // Step 3: Multi-tier search with category filtering
      const allCandidates: Array<{ product: Product; score: number; tier: string }> = [];

      // Tier 1: Exact/Specific search
      const tier1Candidates = this.searchProductsWithCategories(searchTiers.tier1, targetCategories, 'tier1', 0.8);
      allCandidates.push(...tier1Candidates);

      // Tier 2: Category search if needed
      if (allCandidates.length < 5) {
        const tier2Candidates = this.searchProductsWithCategories(searchTiers.tier2, targetCategories, 'tier2', 0.5);
        allCandidates.push(...tier2Candidates);
      }

      // Tier 3: Alternative search if needed
      if (allCandidates.length < 3) {
        const tier3Candidates = this.searchProductsWithCategories(searchTiers.tier3, targetCategories, 'tier3', 0.3);
        allCandidates.push(...tier3Candidates);
      }

      // Step 4: Calculate smart scores and sort
      const scoredCandidates = allCandidates.map(candidate => ({
        ...candidate,
        score: this.calculateSmartScore(candidate.product, searchTiers, item, candidate.score, candidate.tier)
      }));

      scoredCandidates.sort((a, b) => b.score - a.score);

      // Step 5: LLM quality filtering if we have enough candidates
      if (scoredCandidates.length > 10) {
        return this.applyQualityFilter(scoredCandidates.slice(0, 15), item);
      }

      console.log(`🏆 Found ${scoredCandidates.length} candidates`);
      return scoredCandidates.slice(0, 5);

    } catch (error) {
      console.error('❌ Product search failed:', error);
      return [];
    }
  }

  /**
   * Search products with category filtering
   */
  private searchProductsWithCategories(
    searchTerms: string[],
    targetCategories: string[],
    tier: string,
    threshold: number
  ): Array<{ product: Product; score: number; tier: string }> {
    const candidates: Array<{ product: Product; score: number; tier: string }> = [];
    let filtered = 0;
    let matches = 0;

    for (const product of this.products) {
      // Filter by category first
      if (!targetCategories.includes(product.category)) {
        continue;
      }
      filtered++;

      // Apply keyword scoring
      const score = this.basicKeywordScore(product, searchTerms);
      if (score >= threshold) {
        candidates.push({ product, score, tier });
        matches++;
      }
    }

    console.log(`   ${tier}: ${filtered} products in categories, ${matches} matches`);
    return candidates;
  }

  /**
   * Basic keyword scoring algorithm
   */
  private basicKeywordScore(product: Product, searchTerms: string[]): number {
    const titleLower = product.title.toLowerCase();
    const titleWords = new Set(titleLower.split(' '));
    let score = 0;

    for (const term of searchTerms) {
      const termLower = term.toLowerCase();

      // Exact word match (highest score)
      if (titleWords.has(termLower)) {
        score += 2.0;
      }
      // Compound word match (medium score)
      else if ([...titleWords].some(word => word.length > termLower.length && word.includes(termLower))) {
        score += 1.5;
      }
      // Substring match (lower score)
      else if (titleLower.includes(termLower)) {
        score += 1.0;
      }
    }

    return score;
  }

  /**
   * Calculate smart score with tier weighting and bonuses
   */
  private calculateSmartScore(
    product: Product,
    searchTiers: SearchTiers,
    item: ShoppingItem,
    baseScore: number,
    tier: string
  ): number {
    // Apply tier weights
    const tierWeights: Record<string, number> = {
      tier1: 3.0,
      tier2: 1.5,
      tier3: 0.8
    };
    
    const weightedScore = baseScore * (tierWeights[tier] || 1.0);

    // Attribute bonuses
    let attributeBonus = 0;
    const titleLower = product.title.toLowerCase();

    for (const attr of item.attributes) {
      const attrLower = attr.toLowerCase();
      if (['organic', 'bio'].includes(attrLower) && titleLower.includes('bio')) {
        attributeBonus += 1.0;
      } else if (['whole_wheat', 'vollkorn'].includes(attrLower) && titleLower.includes('vollkorn')) {
        attributeBonus += 1.0;
      } else if (['fresh', 'frisch'].includes(attrLower) && (titleLower.includes('frisch') || titleLower.includes('fresh'))) {
        attributeBonus += 0.5;
      } else if (['firm', 'fest'].includes(attrLower) && titleLower.includes('fest')) {
        attributeBonus += 1.0;
      }
    }

    // Size appropriateness bonus (simplified)
    const sizeBonus = this.calculateSizeBonus(product, item);

    return weightedScore + attributeBonus + sizeBonus;
  }

  /**
   * Calculate size appropriateness bonus
   */
  private calculateSizeBonus(product: Product, item: ShoppingItem): number {
    const productVolume = this.volumeParser.parseVolume(`${product.title} ${product.volume}`);
    if (!productVolume) return 0;

    const neededGrams = this.volumeParser.convertToGrams(item.amount, item.unit);
    const productGrams = this.volumeParser.convertToGrams(productVolume.amount, productVolume.unit);

    if (neededGrams && productGrams) {
      const ratio = neededGrams / productGrams;
      if (ratio >= 0.5 && ratio <= 2.0) return 0.5;
      if (ratio > 10) return -1.0;
    }

    return 0;
  }

  /**
   * Apply AI quality filtering
   */
  private async applyQualityFilter(
    candidates: Array<{ product: Product; score: number; tier: string }>,
    item: ShoppingItem
  ): Promise<Array<{ product: Product; score: number; tier: string }>> {
    try {
      const qualityResult = await OpenAIClient.qualityFilter(
        candidates,
        item.originalText,
        item.attributes,
        item.itemType,
        item.amount,
        item.unit
      );

      const filteredCandidates: Array<{ product: Product; score: number; tier: string }> = [];
      
      for (const selection of qualityResult.selectedCandidates) {
        if (selection.index >= 0 && selection.index < candidates.length) {
          filteredCandidates.push(candidates[selection.index]);
        }
      }

      console.log(`🤖 Quality filter applied: ${qualityResult.overallReasoning}`);
      return filteredCandidates;
    } catch (error) {
      console.error('❌ Quality filtering failed:', error);
      return candidates;
    }
  }

  /**
   * Calculate quantity needed for a specific product
   */
  private async calculateQuantityForProduct(
    item: ShoppingItem,
    candidate: { product: Product; score: number; tier: string }
  ): Promise<ProductMatch | null> {
    const { product } = candidate;

    try {
      // Try deterministic calculation first
      const productVolume = this.volumeParser.parseVolume(`${product.title} ${product.volume}`);
      
      if (productVolume) {
        const unitsNeeded = this.volumeParser.calculateUnitsNeeded(
          item.amount,
          item.unit,
          productVolume.amount,
          productVolume.unit
        );

        if (unitsNeeded !== null) {
          const totalPrice = unitsNeeded * product.price;
          let actualAmount = unitsNeeded * productVolume.amount;
          let actualUnit = productVolume.unit;

          // Convert to more readable units if needed
          if (actualUnit === 'g' && actualAmount >= 1000) {
            actualAmount = actualAmount / 1000;
            actualUnit = 'kg';
          } else if (actualUnit === 'ml' && actualAmount >= 1000) {
            actualAmount = actualAmount / 1000;
            actualUnit = 'l';
          }

          return {
            product,
            unitsNeeded,
            actualAmount,
            actualUnit,
            totalPrice,
            confidence: candidate.score,
            matchTier: candidate.tier,
            matchReasoning: `Deterministic calculation: ${unitsNeeded} units = ${actualAmount}${actualUnit}`
          };
        }
      }

      // Fall back to AI calculation for complex cases
      const smartQuantity = await OpenAIClient.calculateQuantity(
        item.item,
        item.amount,
        item.unit,
        item.itemType,
        product.title,
        product.volume,
        product.price
      );

      return {
        product,
        unitsNeeded: smartQuantity.unitsNeeded,
        actualAmount: smartQuantity.actualAmount,
        actualUnit: smartQuantity.actualUnit,
        totalPrice: smartQuantity.unitsNeeded * product.price,
        confidence: candidate.score * 0.75, // Slightly lower for AI calculations
        matchTier: 'ai_smart',
        matchReasoning: smartQuantity.reasoning
      };

    } catch (error) {
      console.error('❌ Quantity calculation failed:', error);
      return null;
    }
  }

  /**
   * Get category statistics for debugging
   */
  private getCategoryStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const product of this.products) {
      stats[product.category] = (stats[product.category] || 0) + 1;
    }
    return stats;
  }
}