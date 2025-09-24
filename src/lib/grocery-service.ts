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
import { AdvancedSearchEngine, SearchConfig, SearchResult as AdvancedSearchResult } from './advanced-search-engine';

export class GroceryService {
  private products: Product[];
  private volumeParser: VolumeParser;
  private advancedSearchEngine: AdvancedSearchEngine;

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
    this.advancedSearchEngine = new AdvancedSearchEngine(products);
    console.log(`🧠 GroceryService initialized with ${products.length} products`);
    
    // Log product distribution across categories
    const categoryStats = this.getCategoryStats();
    console.log('📊 Product distribution:', categoryStats);
  }

  /**
   * Main processing method - converts shopping list to results
   */
  async processShoppingList(shoppingList: string): Promise<ShoppingResult> {
    console.log('🛒 Starting grocery shopping process (optimized mode)');
    const timestamp = new Date().toISOString();
    const candidatesLog: Record<string, Array<{ product: Product; score: number; tier: string }>> = {};

    try {
      // Step 1: Parse shopping list with AI (with timeout handling)
      console.log('📝 Parsing shopping list...');
      let shoppingItems: ShoppingItem[];
      
      try {
        const parsePromise = this.parseShoppingList(shoppingList);
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Parsing timeout')), 10000)
        );
        shoppingItems = await Promise.race([parsePromise, timeoutPromise]);
      } catch (error) {
        console.warn('⚠️ AI parsing failed, using fallback parsing:', error);
        shoppingItems = this.fallbackParse(shoppingList);
      }
      
      console.log(`📋 Parsed ${shoppingItems.length} items`);

      const foundItems: ProductMatch[] = [];
      const notFound: string[] = [];

      // Step 2: Process items with optimized search (minimal AI calls)
      for (let i = 0; i < shoppingItems.length; i++) {
        const item = shoppingItems[i];
        console.log(`🔄 Processing item ${i + 1}/${shoppingItems.length}: ${item.originalText}`);

        try {
          // Use world-class advanced search engine
          const candidates = await this.findMatchingProductsWorldClass(item);
          candidatesLog[item.originalText] = candidates.slice(0, 3);

          if (candidates.length === 0) {
            console.log(`❌ No matches found for ${item.item}`);
            notFound.push(item.originalText);
            continue;
          }

          // Use simplified quantity calculation
          const bestMatch = this.calculateQuantitySimple(item, candidates[0]);
          
          if (bestMatch) {
            console.log(`✅ Added to basket: ${bestMatch.product.title}`);
            foundItems.push(bestMatch);
          } else {
            console.log(`❌ Couldn't calculate quantities for ${item.item}`);
            notFound.push(item.originalText);
          }
        } catch (error) {
          console.error(`❌ Error processing ${item.item}:`, error);
          notFound.push(item.originalText);
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

      // Step 5: Enhanced candidate selection like Python implementation
      let finalCandidates = scoredCandidates;
      
      // Apply quality filtering for complex cases with many candidates
      if (scoredCandidates.length > 12) {
        console.log(`🤖 Applying LLM quality filter to ${scoredCandidates.length} candidates...`);
        finalCandidates = await this.applyQualityFilter(scoredCandidates.slice(0, 20), item);
      }
      
      // Ensure we have diverse results by removing very similar products
      finalCandidates = this.removeDuplicateSimilarProducts(finalCandidates);

      console.log(`🏆 Found ${finalCandidates.length} final candidates`);
      return finalCandidates.slice(0, 8); // Return more candidates for better selection

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
   * Basic keyword scoring exactly matching Python implementation
   */
  private basicKeywordScore(product: Product, searchTerms: string[]): number {
    const titleLower = product.title.toLowerCase();
    const titleWords = new Set(titleLower.split(' '));
    let score = 0.0;
    
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
   * World-class product matching using advanced search engine
   * Implements Google/Elasticsearch-level search with multiple algorithms
   */
  private async findMatchingProductsWorldClass(item: ShoppingItem): Promise<Array<{ product: Product; score: number; tier: string }>> {
    try {
      console.log(`🌟 World-class search for: ${item.item}`);
      
      // Step 1: Determine target categories (fast mode for performance)
      const targetCategories = await this.determineCategoriesNoAI(item);
      console.log(`📂 Target categories: ${targetCategories.join(', ')}`);
      
      // Step 2: Build comprehensive search query
      const searchQuery = this.buildAdvancedSearchQuery(item);
      console.log(`🔍 Search query: "${searchQuery}"`);
      
      // Step 3: Configure advanced search parameters
      const searchConfig: SearchConfig = {
        maxResults: 15,
        fuzzyThreshold: 0.2, // Lower threshold for more tolerance
        enableSemanticSearch: true,
        diversityFactor: 0.4, // Higher diversity for better selection
        queryExpansion: true
      };
      
      // Step 4: Execute world-class search
      const searchResults = await this.advancedSearchEngine.search(
        searchQuery,
        targetCategories,
        searchConfig
      );
      
      // Step 5: Convert to grocery service format with enhanced scoring
      const candidates = searchResults.map(result => ({
        product: result.product,
        score: this.enhanceScoreWithGroceryContext(result, item),
        tier: this.mapAdvancedTierToGroceryTier(result.tier),
        relevanceBreakdown: result.relevanceBreakdown
      }));
      
      console.log(`🎯 Advanced search found ${candidates.length} world-class results`);
      return candidates;
      
    } catch (error) {
      console.error('❌ World-class search failed, falling back to ultra-fast:', error);
      // Fallback to ultra-fast search if advanced search fails
      return this.findMatchingProductsUltraFast(item);
    }
  }

  /**
   * Build advanced search query from shopping item
   */
  private buildAdvancedSearchQuery(item: ShoppingItem): string {
    let query = item.item;
    
    // Add attributes to query for better matching
    if (item.attributes.length > 0) {
      const attributeString = item.attributes.join(' ');
      query = `${attributeString} ${query}`;
    }
    
    // Add context from original text if different
    if (item.originalText !== item.item && 
        item.originalText.toLowerCase() !== item.item.toLowerCase()) {
      const originalTerms = item.originalText
        .toLowerCase()
        .replace(/\d+\s*(g|kg|ml|l|stück|x)\s*/g, '') // Remove quantities
        .trim();
      
      if (originalTerms && !query.toLowerCase().includes(originalTerms)) {
        query = `${query} ${originalTerms}`;
      }
    }
    
    return query.trim();
  }

  /**
   * Enhance search engine score with grocery-specific context
   */
  private enhanceScoreWithGroceryContext(
    result: AdvancedSearchResult, 
    item: ShoppingItem
  ): number {
    let enhancedScore = result.score;
    
    // Quantity appropriateness bonus
    const quantityBonus = this.calculateQuantityAppropriatenessBonus(result.product, item);
    enhancedScore += quantityBonus * 0.1;
    
    // Price reasonableness check
    const priceBonus = this.calculatePriceReasonablenessBonus(result.product, item);
    enhancedScore += priceBonus * 0.05;
    
    // Freshness preference for produce
    if (item.itemType === 'fresh_produce') {
      const freshnessBonus = this.calculateFreshnessBonus(result.product);
      enhancedScore += freshnessBonus * 0.1;
    }
    
    // Brand trust factor
    const trustBonus = this.calculateBrandTrustBonus(result.product);
    enhancedScore += trustBonus * 0.05;
    
    return Math.min(1.0, enhancedScore);
  }

  /**
   * Calculate quantity appropriateness bonus
   */
  private calculateQuantityAppropriatenessBonus(product: Product, item: ShoppingItem): number {
    const productVolume = this.volumeParser.parseVolume(product.volume);
    if (!productVolume) return 0;

    const neededGrams = this.volumeParser.convertToGrams(item.amount, item.unit);
    const productGrams = this.volumeParser.convertToGrams(productVolume.amount, productVolume.unit);

    if (neededGrams && productGrams) {
      const ratio = neededGrams / productGrams;
      
      // Ideal ratios get highest bonus
      if (ratio >= 0.5 && ratio <= 2.0) return 1.0;
      if (ratio >= 0.25 && ratio <= 4.0) return 0.7;
      if (ratio >= 0.1 && ratio <= 10.0) return 0.4;
      
      // Penalty for very inappropriate sizes
      if (ratio > 20 || ratio < 0.05) return -0.5;
    }

    return 0;
  }

  /**
   * Calculate price reasonableness bonus
   */
  private calculatePriceReasonablenessBonus(product: Product, item: ShoppingItem): number {
    // Simple price reasonableness check based on category
    const categoryPriceRanges: Record<string, [number, number]> = {
      'Obst & Gemüse': [0.5, 5.0],
      'Käse, Eier & Molkerei': [1.0, 8.0],
      'Fleisch & Fisch': [2.0, 20.0],
      'Kochen & Backen': [0.5, 6.0],
      'Brot, Cerealien & Aufstriche': [1.0, 8.0]
    };

    const [minPrice, maxPrice] = categoryPriceRanges[product.category] || [0.5, 10.0];
    
    if (product.price >= minPrice && product.price <= maxPrice) {
      return 1.0;
    } else if (product.price > maxPrice) {
      return Math.max(0, 1 - (product.price - maxPrice) / maxPrice);
    } else {
      // Very cheap might indicate poor quality
      return 0.5;
    }
  }

  /**
   * Calculate freshness bonus for produce
   */
  private calculateFreshnessBonus(product: Product): number {
    const title = product.title.toLowerCase();
    
    // Bonus for freshness indicators
    if (title.includes('frisch') || title.includes('fresh')) return 1.0;
    if (title.includes('bio') || title.includes('organic')) return 0.8;
    if (title.includes('premium') || title.includes('extra')) return 0.6;
    
    return 0;
  }

  /**
   * Calculate brand trust bonus
   */
  private calculateBrandTrustBonus(product: Product): number {
    const title = product.title.toLowerCase();
    
    // Trusted brands and quality indicators
    if (title.includes('bio') || title.includes('organic')) return 1.0;
    if (title.includes('rewe')) return 0.8;
    if (title.includes('premium') || title.includes('extra')) return 0.6;
    if (title.includes('ja!') || title.includes('basic')) return 0.4;
    
    return 0;
  }

  /**
   * Map advanced search tier to grocery service tier
   */
  private mapAdvancedTierToGroceryTier(advancedTier: string): string {
    switch (advancedTier) {
      case 'tier1': return 'advanced_tier1';
      case 'tier2': return 'advanced_tier2';
      case 'tier3': return 'advanced_tier3';
      default: return 'advanced_match';
    }
  }

  /**
   * Ultra-fast product matching with minimal AI calls - maximum performance
   */
  private async findMatchingProductsUltraFast(item: ShoppingItem): Promise<Array<{ product: Product; score: number; tier: string }>> {
    try {
      console.log(`🔍 Ultra-fast search for: ${item.item}`);

      // Step 1: Use simple category mapping (no AI)
      const targetCategories = await this.determineCategoriesNoAI(item);
      console.log(`📂 Target categories: ${targetCategories.join(', ')}`);

      // Step 2: Generate search tiers without AI
      const searchTiers = this.generateSimpleSearchTiers(item);
      console.log(`🎯 Simple search tiers generated`);

      const allCandidates: Array<{ product: Product; score: number; tier: string }> = [];

      // Tier 1: Exact matches
      const tier1Candidates = this.searchProductsWithCategories(searchTiers.tier1, targetCategories, 'tier1', 0.8);
      allCandidates.push(...tier1Candidates);

      // Tier 2: General matches if needed
      if (allCandidates.length < 3) {
        const tier2Candidates = this.searchProductsWithCategories(searchTiers.tier2, targetCategories, 'tier2', 0.5);
        allCandidates.push(...tier2Candidates);
      }

      // Calculate smart scores and sort
      const scoredCandidates = allCandidates.map(candidate => ({
        ...candidate,
        score: this.calculateSmartScore(candidate.product, searchTiers, item, candidate.score, candidate.tier)
      }));

      scoredCandidates.sort((a, b) => b.score - a.score);

      // Remove duplicates
      const finalCandidates = this.removeDuplicateSimilarProducts(scoredCandidates);
      
      console.log(`🏆 Found ${finalCandidates.length} candidates (ultra-fast)`);
      return finalCandidates.slice(0, 5); // Return fewer candidates for speed

    } catch (error) {
      console.error('❌ Ultra-fast product search failed:', error);
      return [];
    }
  }

  /**
   * Fast product matching without heavy AI filtering - optimized for speed
   */
  private async findMatchingProductsFast(item: ShoppingItem): Promise<Array<{ product: Product; score: number; tier: string }>> {
    try {
      console.log(`🔍 Finding products for: ${item.item}`);

      // Step 1: Determine target categories using cached or simplified logic
      const targetCategories = await this.determineCategoriesSimple(item);
      console.log(`📂 Target categories: ${targetCategories.join(', ')}`);

      // Step 2: Generate search tiers with AI (falls back to simple if needed)
      const searchTiers = await this.generateSearchTiers(item);
      console.log(`🎯 Search tiers generated`);

      const allCandidates: Array<{ product: Product; score: number; tier: string }> = [];

      // Tier 1: Exact matches
      const tier1Candidates = this.searchProductsWithCategories(searchTiers.tier1, targetCategories, 'tier1', 0.8);
      allCandidates.push(...tier1Candidates);
      console.log(`   tier1: ${targetCategories.length * this.products.filter(p => targetCategories.includes(p.category)).length} products in categories, ${tier1Candidates.length} matches`);

      // Tier 2: General matches if needed
      if (allCandidates.length < 5) {
        const tier2Candidates = this.searchProductsWithCategories(searchTiers.tier2, targetCategories, 'tier2', 0.5);
        allCandidates.push(...tier2Candidates);
        console.log(`   tier2: ${targetCategories.length * this.products.filter(p => targetCategories.includes(p.category)).length} products in categories, ${tier2Candidates.length} matches`);
      }

      // Calculate smart scores and sort
      const scoredCandidates = allCandidates.map(candidate => ({
        ...candidate,
        score: this.calculateSmartScore(candidate.product, searchTiers, item, candidate.score, candidate.tier)
      }));

      scoredCandidates.sort((a, b) => b.score - a.score);

      // Enhanced candidate selection for fast mode
      const finalCandidates = this.removeDuplicateSimilarProducts(scoredCandidates);
      
      console.log(`🏆 Found ${finalCandidates.length} candidates`);
      return finalCandidates.slice(0, 8);

    } catch (error) {
      console.error('❌ Fast product search failed:', error);
      return [];
    }
  }

  /**
   * Category determination without AI - pure mapping for ultra-fast performance
   */
  private async determineCategoriesNoAI(item: ShoppingItem): Promise<string[]> {
    // Enhanced fallback mapping based on Python implementation patterns
    const categoryMap: Record<string, string[]> = {
      // Fresh produce - enhanced with more terms
      'avocado': ['Obst & Gemüse'],
      'tomate': ['Obst & Gemüse'],
      'tomates': ['Obst & Gemüse'],
      'tomato': ['Obst & Gemüse'],
      'tomatoes': ['Obst & Gemüse'],
      'brokkoli': ['Obst & Gemüse'],
      'broccoli': ['Obst & Gemüse'],
      'salat': ['Obst & Gemüse'],
      'salad': ['Obst & Gemüse'],
      'gurke': ['Obst & Gemüse'],
      'cucumber': ['Obst & Gemüse'],
      'paprika': ['Obst & Gemüse'],
      'pepper': ['Obst & Gemüse'],
      'zwiebel': ['Obst & Gemüse'],
      'onion': ['Obst & Gemüse'],
      'karotte': ['Obst & Gemüse'],
      'carrot': ['Obst & Gemüse'],
      'kartoffel': ['Obst & Gemüse'],
      'potato': ['Obst & Gemüse'],
      'apfel': ['Obst & Gemüse'],
      'apple': ['Obst & Gemüse'],
      'banane': ['Obst & Gemüse'],
      'banana': ['Obst & Gemüse'],
      
      // Pasta and grains - enhanced
      'nudeln': ['Kochen & Backen', 'Brot, Cerealien & Aufstriche'],
      'pasta': ['Kochen & Backen', 'Brot, Cerealien & Aufstriche'],
      'spaghetti': ['Kochen & Backen', 'Brot, Cerealien & Aufstriche'],
      'vollkorn': ['Kochen & Backen', 'Brot, Cerealien & Aufstriche'],
      'wheat': ['Kochen & Backen', 'Brot, Cerealien & Aufstriche'],
      'reis': ['Kochen & Backen'],
      'rice': ['Kochen & Backen'],
      'mehl': ['Kochen & Backen'],
      'flour': ['Kochen & Backen'],
      
      // Proteins - enhanced
      'tofu': ['Fleisch & Fisch'],
      'hähnchen': ['Fleisch & Fisch'],
      'chicken': ['Fleisch & Fisch'],
      'fleisch': ['Fleisch & Fisch'],
      'meat': ['Fleisch & Fisch'],
      'fisch': ['Fleisch & Fisch'],
      'fish': ['Fleisch & Fisch'],
      'chorizo': ['Fleisch & Fisch'],
      'soyrizo': ['Fleisch & Fisch'],
      
      // Dairy - enhanced
      'milch': ['Käse, Eier & Molkerei'],
      'milk': ['Käse, Eier & Molkerei'],
      'käse': ['Käse, Eier & Molkerei'],
      'cheese': ['Käse, Eier & Molkerei'],
      'cheddar': ['Käse, Eier & Molkerei'],
      'joghurt': ['Käse, Eier & Molkerei'],
      'yogurt': ['Käse, Eier & Molkerei'],
      'butter': ['Käse, Eier & Molkerei'],
      'eier': ['Käse, Eier & Molkerei'],
      'eggs': ['Käse, Eier & Molkerei'],
      
      // Condiments and spreads
      'peanut': ['Brot, Cerealien & Aufstriche'],
      'erdnuss': ['Brot, Cerealien & Aufstriche'],
      'butter': ['Käse, Eier & Molkerei', 'Brot, Cerealien & Aufstriche'],
      'öl': ['Öle, Soßen & Gewürze'],
      'oil': ['Öle, Soßen & Gewürze'],
      
      // Herbs and spices - enhanced
      'green onion': ['Obst & Gemüse'],
      'spring onion': ['Obst & Gemüse'],
      'scallion': ['Obst & Gemüse'],
      'frühlingszwiebel': ['Obst & Gemüse'],
      'lauchzwiebel': ['Obst & Gemüse'],
    };

    const itemLower = item.item.toLowerCase();
    const originalLower = item.originalText.toLowerCase();
    
    // Check both item and original text for broader matching
    for (const [key, categories] of Object.entries(categoryMap)) {
      if (itemLower.includes(key) || originalLower.includes(key)) {
        console.log(`📋 Mapped "${item.item}" to categories: ${categories.join(', ')} (key: "${key}")`);
        return categories;
      }
    }

    // Enhanced fallback based on item type
    const typeCategories: Record<string, string[]> = {
      'fresh_produce': ['Obst & Gemüse'],
      'dairy': ['Käse, Eier & Molkerei'],
      'meat': ['Fleisch & Fisch'],
      'dry_goods': ['Kochen & Backen', 'Brot, Cerealien & Aufstriche'],
      'herbs_spices': ['Öle, Soßen & Gewürze'],
      'canned': ['Fertiggerichte & Konserven'],
      'condiments': ['Öle, Soßen & Gewürze'],
      'grains': ['Kochen & Backen', 'Brot, Cerealien & Aufstriche'],
      'spreads': ['Brot, Cerealien & Aufstriche'],
    };
    
    if (item.itemType && typeCategories[item.itemType]) {
      console.log(`📋 Used item type "${item.itemType}" to determine categories: ${typeCategories[item.itemType].join(', ')}`);
      return typeCategories[item.itemType];
    }

    // Ultimate fallback - return most common categories
    console.log(`📋 Using default fallback categories for "${item.item}"`);
    return ['Kochen & Backen', 'Obst & Gemüse'];
  }

  /**
   * Enhanced category determination - tries AI first, falls back to mapping
   */
  private async determineCategoriesSimple(item: ShoppingItem): Promise<string[]> {
    try {
      // First try AI category determination like Python implementation
      const categoryResult = await OpenAIClient.determineCategories(
        item.item,
        item.itemType,
        item.attributes,
        item.originalText
      );
      
      if (categoryResult.categories.length > 0) {
        console.log(`🤖 AI determined categories: ${categoryResult.categories.join(', ')}`);
        return categoryResult.categories;
      }
    } catch (error) {
      console.warn('⚠️ AI category determination failed, using fallback:', error);
    }

    // Enhanced fallback mapping based on Python implementation patterns
    const categoryMap: Record<string, string[]> = {
      // Fresh produce - enhanced with more terms
      'avocado': ['Obst & Gemüse'],
      'tomate': ['Obst & Gemüse'],
      'tomates': ['Obst & Gemüse'],
      'tomato': ['Obst & Gemüse'],
      'tomatoes': ['Obst & Gemüse'],
      'brokkoli': ['Obst & Gemüse'],
      'broccoli': ['Obst & Gemüse'],
      'salat': ['Obst & Gemüse'],
      'salad': ['Obst & Gemüse'],
      'gurke': ['Obst & Gemüse'],
      'cucumber': ['Obst & Gemüse'],
      'paprika': ['Obst & Gemüse'],
      'pepper': ['Obst & Gemüse'],
      'zwiebel': ['Obst & Gemüse'],
      'onion': ['Obst & Gemüse'],
      'karotte': ['Obst & Gemüse'],
      'carrot': ['Obst & Gemüse'],
      'kartoffel': ['Obst & Gemüse'],
      'potato': ['Obst & Gemüse'],
      'apfel': ['Obst & Gemüse'],
      'apple': ['Obst & Gemüse'],
      'banane': ['Obst & Gemüse'],
      'banana': ['Obst & Gemüse'],
      
      // Pasta and grains - enhanced
      'nudeln': ['Kochen & Backen', 'Brot, Cerealien & Aufstriche'],
      'pasta': ['Kochen & Backen', 'Brot, Cerealien & Aufstriche'],
      'spaghetti': ['Kochen & Backen', 'Brot, Cerealien & Aufstriche'],
      'vollkorn': ['Kochen & Backen', 'Brot, Cerealien & Aufstriche'],
      'wheat': ['Kochen & Backen', 'Brot, Cerealien & Aufstriche'],
      'reis': ['Kochen & Backen'],
      'rice': ['Kochen & Backen'],
      'mehl': ['Kochen & Backen'],
      'flour': ['Kochen & Backen'],
      
      // Proteins - enhanced
      'tofu': ['Fleisch & Fisch'],
      'hähnchen': ['Fleisch & Fisch'],
      'chicken': ['Fleisch & Fisch'],
      'fleisch': ['Fleisch & Fisch'],
      'meat': ['Fleisch & Fisch'],
      'fisch': ['Fleisch & Fisch'],
      'fish': ['Fleisch & Fisch'],
      'chorizo': ['Fleisch & Fisch'],
      'soyrizo': ['Fleisch & Fisch'],
      
      // Dairy - enhanced
      'milch': ['Käse, Eier & Molkerei'],
      'milk': ['Käse, Eier & Molkerei'],
      'käse': ['Käse, Eier & Molkerei'],
      'cheese': ['Käse, Eier & Molkerei'],
      'cheddar': ['Käse, Eier & Molkerei'],
      'joghurt': ['Käse, Eier & Molkerei'],
      'yogurt': ['Käse, Eier & Molkerei'],
      'butter': ['Käse, Eier & Molkerei'],
      'eier': ['Käse, Eier & Molkerei'],
      'eggs': ['Käse, Eier & Molkerei'],
      
      // Condiments and spreads
      'peanut': ['Brot, Cerealien & Aufstriche'],
      'erdnuss': ['Brot, Cerealien & Aufstriche'],
      'butter': ['Käse, Eier & Molkerei', 'Brot, Cerealien & Aufstriche'],
      'öl': ['Öle, Soßen & Gewürze'],
      'oil': ['Öle, Soßen & Gewürze'],
      
      // Herbs and spices
      'onion': ['Obst & Gemüse'],
      'green': ['Obst & Gemüse'],
      'green onion': ['Obst & Gemüse'],
      'spring onion': ['Obst & Gemüse'],
      'scallion': ['Obst & Gemüse'],
      'frühlingszwiebel': ['Obst & Gemüse'],
      'lauchzwiebel': ['Obst & Gemüse'],
    };

    const itemLower = item.item.toLowerCase();
    const originalLower = item.originalText.toLowerCase();
    
    // Check both item and original text for broader matching
    for (const [key, categories] of Object.entries(categoryMap)) {
      if (itemLower.includes(key) || originalLower.includes(key)) {
        console.log(`📋 Mapped "${item.item}" to categories: ${categories.join(', ')} (key: "${key}")`);
        return categories;
      }
    }

    // Enhanced fallback based on item type
    const typeCategories: Record<string, string[]> = {
      'fresh_produce': ['Obst & Gemüse'],
      'dairy': ['Käse, Eier & Molkerei'],
      'meat': ['Fleisch & Fisch'],
      'dry_goods': ['Kochen & Backen', 'Brot, Cerealien & Aufstriche'],
      'herbs_spices': ['Öle, Soßen & Gewürze'],
      'canned': ['Fertiggerichte & Konserven'],
      'condiments': ['Öle, Soßen & Gewürze'],
      'grains': ['Kochen & Backen', 'Brot, Cerealien & Aufstriche'],
      'spreads': ['Brot, Cerealien & Aufstriche'],
    };
    
    if (item.itemType && typeCategories[item.itemType]) {
      console.log(`📋 Used item type "${item.itemType}" to determine categories: ${typeCategories[item.itemType].join(', ')}`);
      return typeCategories[item.itemType];
    }

    // Ultimate fallback - return most common categories
    console.log(`📋 Using default fallback categories for "${item.item}"`);
    return ['Kochen & Backen', 'Obst & Gemüse'];
  }

  /**
   * Generate search tiers using LLM - enhanced from Python implementation
   */
  private async generateSearchTiers(item: ShoppingItem): Promise<SearchTiers> {
    try {
      // Use AI to generate proper search tiers like the Python implementation
      const searchTiers = await OpenAIClient.generateSearchTiers(
        item.item,
        item.attributes,
        item.alternatives,
        item.itemType
      );
      
      console.log(`🎯 LLM generated search tiers for "${item.item}"`);
      console.log(`   Tier 1 (${searchTiers.tier1.length} terms): ${searchTiers.tier1.slice(0, 3).join(', ')}${searchTiers.tier1.length > 3 ? '...' : ''}`);
      console.log(`   Tier 2 (${searchTiers.tier2.length} terms): ${searchTiers.tier2.slice(0, 3).join(', ')}${searchTiers.tier2.length > 3 ? '...' : ''}`);
      console.log(`   Tier 3 (${searchTiers.tier3.length} terms): ${searchTiers.tier3.slice(0, 3).join(', ')}${searchTiers.tier3.length > 3 ? '...' : ''}`);
      
      return searchTiers;
    } catch (error) {
      console.warn('⚠️ LLM search tier generation failed, using fallback:', error);
      return this.generateSimpleSearchTiers(item);
    }
  }

  /**
   * Fallback: Generate simple search tiers without AI
   */
  private generateSimpleSearchTiers(item: ShoppingItem): SearchTiers {
    const baseItem = item.item.toLowerCase();
    const attributes = item.attributes.map(a => a.toLowerCase());
    const originalText = item.originalText.toLowerCase();
    
    // Special handling for green onion/scallion terminology
    let tier1: string[] = [];
    let tier2: string[] = [];
    let tier3: string[] = [];
    
    if (originalText.includes('green onion') || originalText.includes('spring onion') || originalText.includes('scallion')) {
      // Special case for green onions - use proper German terms
      tier1 = [
        'lauchzwiebeln',
        'frühlingszwiebeln', 
        'green onion',
        'spring onion',
        'scallion',
        'lauch zwiebeln'
      ];
      tier2 = [
        'zwiebeln',
        'lauch',
        'onion',
        'zwiebel'
      ];
      tier3 = [
        'schnittlauch',
        'porree'
      ];
    } else {
      // Standard fallback logic
      const baseWords = baseItem.split(' ').filter(word => word.length > 0);
      const attributeWords = attributes.flatMap(attr => attr.split(' ')).filter(word => word.length > 0);
      
      // Tier 1: Individual words, exact phrases, and combinations
      tier1 = [
        // Original phrase
        baseItem,
        // Individual words (most important for German word order flexibility)
        ...baseWords,
        // Reverse word order for phrases
        ...(baseWords.length > 1 ? [baseWords.slice().reverse().join(' ')] : []),
        // Attributes with base item (different orders)
        ...attributes.map(attr => `${attr} ${baseItem}`),
        ...attributes.map(attr => `${baseItem} ${attr}`),
        // Individual attribute words
        ...attributeWords,
      ];
      
      // Tier 2: Variations and alternatives
      tier2 = [
        // Character replacements for umlauts
        baseItem.replace('ö', 'oe').replace('ä', 'ae').replace('ü', 'ue'),
        // Individual words with umlaut replacements
        ...baseWords.map(word => word.replace('ö', 'oe').replace('ä', 'ae').replace('ü', 'ue')),
        // Common variations
        ...baseWords.filter(word => word.length > 3), // Only longer words to avoid noise
      ];
      
      // Tier 3: Alternatives from LLM
      tier3 = item.alternatives.slice(0, 3);
    }
    
    // Remove duplicates and limit sizes
    return { 
      tier1: [...new Set(tier1)].slice(0, 8),
      tier2: [...new Set(tier2)].slice(0, 6), 
      tier3: [...new Set(tier3)].slice(0, 4)
    };
  }

  /**
   * Simple quantity calculation without AI
   */
  private calculateQuantitySimple(item: ShoppingItem, candidate: { product: Product; score: number; tier: string }): ProductMatch | null {
    try {
      const { product } = candidate;
      
      // Parse product volume
      const productVolume = this.volumeParser.parseVolume(product.volume);
      
      if (!productVolume || productVolume.amount === 0) {
        // No volume info - assume 1 unit needed
        return {
          product,
          unitsNeeded: 1,
          actualAmount: 1,
          actualUnit: 'stück',
          totalPrice: product.price,
          confidence: candidate.score,
          matchTier: candidate.tier,
          matchReasoning: 'Deterministic calculation: 1 units = 1stück'
        };
      }

      // Simple unit conversion and calculation
      const targetAmount = item.amount;
      const targetUnit = item.unit;
      const productAmount = productVolume.amount;
      const productUnit = productVolume.unit;

      // Direct unit match
      if (targetUnit === productUnit) {
        const unitsNeeded = Math.max(1, Math.ceil(targetAmount / productAmount));
        return {
          product,
          unitsNeeded,
          actualAmount: unitsNeeded * productAmount,
          actualUnit: productUnit,
          totalPrice: unitsNeeded * product.price,
          confidence: candidate.score,
          matchTier: candidate.tier,
          matchReasoning: `Deterministic calculation: ${unitsNeeded} units = ${unitsNeeded * productAmount}${productUnit}`
        };
      }

      // Simple unit conversions
      let convertedProductAmount = productAmount;
      let convertedTargetAmount = targetAmount;

      // kg to g
      if (productUnit === 'kg' && targetUnit === 'g') {
        convertedProductAmount *= 1000;
      } else if (productUnit === 'g' && targetUnit === 'kg') {
        convertedTargetAmount *= 1000;
      }
      // l to ml  
      else if (productUnit === 'l' && targetUnit === 'ml') {
        convertedProductAmount *= 1000;
      } else if (productUnit === 'ml' && targetUnit === 'l') {
        convertedTargetAmount *= 1000;
      }

      const unitsNeeded = Math.max(1, Math.ceil(convertedTargetAmount / convertedProductAmount));
      const finalAmount = unitsNeeded * convertedProductAmount;
      const finalUnit = productUnit === 'kg' || targetUnit === 'g' ? 'g' : 
                       productUnit === 'l' || targetUnit === 'ml' ? 'ml' : productUnit;

      return {
        product,
        unitsNeeded,
        actualAmount: finalAmount,
        actualUnit: finalUnit,
        totalPrice: unitsNeeded * product.price,
        confidence: candidate.score,
        matchTier: candidate.tier,
        matchReasoning: `Deterministic calculation: ${unitsNeeded} units = ${finalAmount}${finalUnit}`
      };

    } catch (error) {
      console.error('❌ Simple quantity calculation failed:', error);
      return null;
    }
  }

  /**
   * Remove duplicate or very similar products to ensure diverse results
   */
  private removeDuplicateSimilarProducts(
    candidates: Array<{ product: Product; score: number; tier: string }>
  ): Array<{ product: Product; score: number; tier: string }> {
    const uniqueCandidates: Array<{ product: Product; score: number; tier: string }> = [];
    const seenTitles = new Set<string>();
    
    for (const candidate of candidates) {
      const title = candidate.product.title.toLowerCase();
      const normalizedTitle = title.replace(/\s+/g, ' ').trim();
      
      // Check if we've seen this exact title
      if (seenTitles.has(normalizedTitle)) {
        continue;
      }
      
      // Check for very similar titles (>80% similarity)
      let isSimilar = false;
      for (const seenTitle of seenTitles) {
        if (this.calculateTitleSimilarity(normalizedTitle, seenTitle) > 0.8) {
          isSimilar = true;
          break;
        }
      }
      
      if (!isSimilar) {
        uniqueCandidates.push(candidate);
        seenTitles.add(normalizedTitle);
      }
    }
    
    return uniqueCandidates;
  }
  
  /**
   * Calculate similarity between two product titles
   */
  private calculateTitleSimilarity(title1: string, title2: string): number {
    const words1 = new Set(title1.split(' '));
    const words2 = new Set(title2.split(' '));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size; // Jaccard similarity
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