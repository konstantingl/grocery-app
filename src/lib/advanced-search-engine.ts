/**
 * Advanced Search Engine - World-class product search with modern IR techniques
 * Implements: TF-IDF, fuzzy matching, semantic similarity, query expansion, and advanced ranking
 */

import type { Product } from '@/types';

export interface SearchResult {
  product: Product;
  score: number;
  tier: string;
  relevanceBreakdown: {
    tfidf: number;
    fuzzy: number;
    semantic: number;
    exact: number;
    attribute: number;
    category: number;
    final: number;
  };
}

export interface SearchConfig {
  maxResults: number;
  fuzzyThreshold: number;
  enableSemanticSearch: boolean;
  diversityFactor: number;
  queryExpansion: boolean;
}

export class AdvancedSearchEngine {
  private products: Product[];
  private documentFrequency: Map<string, number> = new Map();
  private termFrequency: Map<string, Map<string, number>> = new Map();
  private productIndex: Map<string, Set<number>> = new Map();
  private semanticCache: Map<string, number[]> = new Map();
  private synonyms: Map<string, string[]> = new Map();
  
  constructor(products: Product[]) {
    this.products = products;
    this.buildSearchIndex();
    this.initializeSynonyms();
    console.log('🔍 Advanced Search Engine initialized with', products.length, 'products');
  }

  /**
   * Main search method - implements multi-stage ranking like Google
   */
  async search(
    query: string,
    categories: string[],
    config: SearchConfig = this.getDefaultConfig()
  ): Promise<SearchResult[]> {
    console.log(`🔎 Advanced search for: "${query}" in categories: [${categories.join(', ')}]`);
    
    // Stage 1: Query Processing & Expansion
    const processedQuery = this.preprocessQuery(query);
    const expandedQueries = config.queryExpansion ? this.expandQuery(processedQuery) : [processedQuery];
    
    // Stage 2: Multi-Algorithm Candidate Retrieval
    const candidates = new Map<number, SearchResult>();
    
    for (const expandedQuery of expandedQueries) {
      const queryResults = await this.retrieveCandidates(expandedQuery, categories, config);
      
      // Merge results with score boosting for original query
      const boost = expandedQuery === processedQuery ? 1.0 : 0.8;
      for (const result of queryResults) {
        const productId = this.products.indexOf(result.product);
        if (candidates.has(productId)) {
          const existing = candidates.get(productId)!;
          existing.score = Math.max(existing.score, result.score * boost);
        } else {
          result.score *= boost;
          candidates.set(productId, result);
        }
      }
    }
    
    // Stage 3: Advanced Ranking Fusion
    let rankedResults = Array.from(candidates.values());
    rankedResults = this.applyRankingFusion(rankedResults, processedQuery);
    
    // Stage 4: Result Diversification & Re-ranking
    rankedResults = this.diversifyResults(rankedResults, config.diversityFactor);
    
    // Stage 5: Quality Filtering
    rankedResults = this.applyQualityFilters(rankedResults, processedQuery, categories);
    
    console.log(`🎯 Found ${rankedResults.length} high-quality results`);
    return rankedResults.slice(0, config.maxResults);
  }

  /**
   * Stage 1: Advanced Query Preprocessing
   */
  private preprocessQuery(query: string): string {
    let processed = query.toLowerCase();
    
    // Unicode normalization
    processed = processed.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // German-specific character handling
    processed = processed
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/ae/g, 'ä').replace(/oe/g, 'ö').replace(/ue/g, 'ü'); // Bidirectional
    
    // Remove punctuation but keep meaningful separators
    processed = processed.replace(/[^\w\s-]/g, ' ');
    
    // Normalize whitespace
    processed = processed.replace(/\s+/g, ' ').trim();
    
    return processed;
  }

  /**
   * Query Expansion using synonyms and common variations
   */
  private expandQuery(query: string): string[] {
    const terms = query.split(' ');
    const expanded = [query];
    
    // Add synonym variations
    for (const term of terms) {
      const synonymsForTerm = this.synonyms.get(term) || [];
      for (const synonym of synonymsForTerm) {
        const synonymQuery = query.replace(term, synonym);
        if (!expanded.includes(synonymQuery)) {
          expanded.push(synonymQuery);
        }
      }
    }
    
    // Add common variations (plural/singular, compound words)
    for (const term of terms) {
      if (term.length > 4) {
        // Try singular/plural
        if (term.endsWith('s') && term.length > 3) {
          const singular = term.slice(0, -1);
          const singularQuery = query.replace(term, singular);
          if (!expanded.includes(singularQuery)) {
            expanded.push(singularQuery);
          }
        } else {
          const plural = term + 's';
          const pluralQuery = query.replace(term, plural);
          if (!expanded.includes(pluralQuery)) {
            expanded.push(pluralQuery);
          }
        }
      }
    }
    
    return expanded.slice(0, 5); // Limit expansion
  }

  /**
   * Stage 2: Multi-Algorithm Candidate Retrieval
   */
  private async retrieveCandidates(
    query: string,
    categories: string[],
    config: SearchConfig
  ): Promise<SearchResult[]> {
    const terms = this.tokenize(query);
    const candidates: SearchResult[] = [];
    
    // Filter products by category first (improves performance)
    const categoryProducts = this.products.filter(p => 
      categories.length === 0 || categories.includes(p.category)
    );
    
    for (let i = 0; i < categoryProducts.length; i++) {
      const product = categoryProducts[i];
      const productId = `${product.title}_${i}`;
      
      // Calculate multiple relevance scores
      const tfidfScore = this.calculateTFIDF(terms, productId, product);
      const fuzzyScore = this.calculateFuzzyScore(query, product, config.fuzzyThreshold);
      const exactScore = this.calculateExactMatches(terms, product);
      const attributeScore = this.calculateAttributeScore(terms, product);
      const categoryScore = categories.includes(product.category) ? 1.0 : 0.5;
      
      // Semantic similarity (if enabled)
      let semanticScore = 0;
      if (config.enableSemanticSearch) {
        semanticScore = await this.calculateSemanticSimilarity(query, product);
      }
      
      // Early filtering - skip very low relevance items
      const preliminaryScore = Math.max(tfidfScore, fuzzyScore, exactScore);
      if (preliminaryScore < 0.1) {
        continue;
      }
      
      const relevanceBreakdown = {
        tfidf: tfidfScore,
        fuzzy: fuzzyScore,
        semantic: semanticScore,
        exact: exactScore,
        attribute: attributeScore,
        category: categoryScore,
        final: 0 // Will be calculated in ranking fusion
      };
      
      candidates.push({
        product,
        score: preliminaryScore,
        tier: this.determineTier(relevanceBreakdown),
        relevanceBreakdown
      });
    }
    
    return candidates;
  }

  /**
   * TF-IDF Implementation for relevance scoring
   */
  private calculateTFIDF(terms: string[], productId: string, product: Product): number {
    const productText = this.getProductText(product);
    const productTerms = this.tokenize(productText);
    const productTF = this.termFrequency.get(productId) || new Map();
    
    let tfidfScore = 0;
    const docLength = productTerms.length;
    
    for (const term of terms) {
      const termFreq = productTF.get(term) || 0;
      if (termFreq === 0) continue;
      
      const tf = termFreq / docLength; // Normalized term frequency
      const df = this.documentFrequency.get(term) || 1;
      const idf = Math.log(this.products.length / df); // Inverse document frequency
      
      tfidfScore += tf * idf;
    }
    
    // Apply length normalization (longer documents get penalized slightly)
    const lengthNorm = 1 / Math.sqrt(docLength);
    return tfidfScore * lengthNorm;
  }

  /**
   * Advanced Fuzzy Matching with multiple algorithms
   */
  private calculateFuzzyScore(query: string, product: Product, threshold: number): number {
    const productText = this.getProductText(product).toLowerCase();
    const queryLower = query.toLowerCase();
    
    let maxScore = 0;
    
    // 1. Levenshtein distance for exact fuzzy matching
    const levenshteinScore = this.levenshteinSimilarity(queryLower, productText);
    maxScore = Math.max(maxScore, levenshteinScore);
    
    // 2. Jaro-Winkler for name similarity (good for brand names)
    const jaroWinklerScore = this.jaroWinklerSimilarity(queryLower, productText);
    maxScore = Math.max(maxScore, jaroWinklerScore);
    
    // 3. N-gram similarity for partial matches
    const ngramScore = this.ngramSimilarity(queryLower, productText, 3);
    maxScore = Math.max(maxScore, ngramScore);
    
    // 4. Substring matching with position weighting
    const substringScore = this.weightedSubstringMatch(queryLower, productText);
    maxScore = Math.max(maxScore, substringScore);
    
    return maxScore >= threshold ? maxScore : 0;
  }

  /**
   * Exact Match Scoring (highest precision)
   */
  private calculateExactMatches(terms: string[], product: Product): number {
    const productText = this.getProductText(product).toLowerCase();
    const productWords = new Set(this.tokenize(productText));
    
    let exactMatches = 0;
    let wordMatches = 0;
    let phraseMatches = 0;
    
    // Word-level exact matches
    for (const term of terms) {
      if (productWords.has(term)) {
        exactMatches++;
        wordMatches++;
      }
    }
    
    // Phrase-level matches
    const queryPhrase = terms.join(' ');
    if (productText.includes(queryPhrase)) {
      phraseMatches = 1;
    }
    
    // Calculate score with phrase bonus
    const wordScore = exactMatches / terms.length;
    const phraseBonus = phraseMatches * 0.5;
    
    return Math.min(1.0, wordScore + phraseBonus);
  }

  /**
   * Attribute-based scoring (bio, vollkorn, etc.)
   */
  private calculateAttributeScore(terms: string[], product: Product): number {
    const attributeKeywords = [
      'bio', 'organic', 'vollkorn', 'whole', 'wheat', 'fresh', 'frisch',
      'natural', 'natur', 'premium', 'extra', 'virgin', 'cold', 'pressed'
    ];
    
    const productText = this.getProductText(product).toLowerCase();
    let score = 0;
    
    for (const term of terms) {
      if (attributeKeywords.includes(term) && productText.includes(term)) {
        score += 0.2;
      }
    }
    
    return Math.min(1.0, score);
  }

  /**
   * Semantic Similarity using simple word embeddings simulation
   * In a real implementation, this would use actual embeddings like Word2Vec or BERT
   */
  private async calculateSemanticSimilarity(query: string, product: Product): Promise<number> {
    // Simplified semantic similarity based on category and context
    const productText = this.getProductText(product).toLowerCase();
    const queryLower = query.toLowerCase();
    
    // Category-based semantic boosting
    const semanticGroups = {
      'produce': ['fresh', 'vegetable', 'fruit', 'organic', 'bio'],
      'dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream'],
      'protein': ['meat', 'fish', 'tofu', 'protein', 'chicken'],
      'grains': ['bread', 'pasta', 'rice', 'wheat', 'flour', 'cereal']
    };
    
    let semanticScore = 0;
    
    for (const [group, keywords] of Object.entries(semanticGroups)) {
      const queryInGroup = keywords.some(kw => queryLower.includes(kw));
      const productInGroup = keywords.some(kw => productText.includes(kw));
      
      if (queryInGroup && productInGroup) {
        semanticScore += 0.3;
      }
    }
    
    return Math.min(1.0, semanticScore);
  }

  /**
   * Advanced Ranking Fusion - combines multiple scores intelligently
   */
  private applyRankingFusion(results: SearchResult[], query: string): SearchResult[] {
    const weights = {
      exact: 0.35,      // Exact matches are most important
      tfidf: 0.25,      // TF-IDF for relevance
      fuzzy: 0.15,      // Fuzzy for typo tolerance
      semantic: 0.10,   // Semantic for context
      attribute: 0.10,  // Attributes for quality
      category: 0.05    // Category for filtering
    };
    
    for (const result of results) {
      const breakdown = result.relevanceBreakdown;
      
      // Weighted linear combination
      const fusedScore = 
        breakdown.exact * weights.exact +
        breakdown.tfidf * weights.tfidf +
        breakdown.fuzzy * weights.fuzzy +
        breakdown.semantic * weights.semantic +
        breakdown.attribute * weights.attribute +
        breakdown.category * weights.category;
      
      // Apply query-specific boosting
      let finalScore = fusedScore;
      
      // Boost for title matches
      if (result.product.title.toLowerCase().includes(query.toLowerCase())) {
        finalScore *= 1.2;
      }
      
      // Boost for exact brand matches
      const brands = ['bio', 'rewe', 'ja!', 'edeka'];
      for (const brand of brands) {
        if (query.toLowerCase().includes(brand) && 
            result.product.title.toLowerCase().includes(brand)) {
          finalScore *= 1.1;
        }
      }
      
      breakdown.final = finalScore;
      result.score = finalScore;
    }
    
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Result Diversification - prevents too many similar products
   */
  private diversifyResults(results: SearchResult[], diversityFactor: number): SearchResult[] {
    if (diversityFactor <= 0 || results.length <= 5) {
      return results;
    }
    
    const diversified: SearchResult[] = [];
    const seenBrands = new Set<string>();
    const seenCategories = new Set<string>();
    
    for (const result of results) {
      const brand = this.extractBrand(result.product.title);
      const category = result.product.category;
      
      // Always include top results
      if (diversified.length < 3) {
        diversified.push(result);
        seenBrands.add(brand);
        seenCategories.add(category);
        continue;
      }
      
      // Apply diversity constraints
      const brandOverlap = seenBrands.has(brand);
      const categoryOverlap = seenCategories.has(category);
      
      const diversityPenalty = (brandOverlap ? 0.5 : 0) + (categoryOverlap ? 0.3 : 0);
      const adjustedScore = result.score * (1 - diversityPenalty * diversityFactor);
      
      if (adjustedScore > 0.1 || diversified.length < 10) {
        diversified.push(result);
        seenBrands.add(brand);
        seenCategories.add(category);
      }
      
      if (diversified.length >= 20) break;
    }
    
    return diversified;
  }

  /**
   * Quality Filters - remove obviously irrelevant results
   */
  private applyQualityFilters(
    results: SearchResult[],
    query: string,
    categories: string[]
  ): SearchResult[] {
    return results.filter(result => {
      // Minimum score threshold
      if (result.score < 0.05) return false;
      
      // Category relevance check
      if (categories.length > 0 && !categories.includes(result.product.category)) {
        // Allow if score is very high (might be mislabeled)
        if (result.score < 0.8) return false;
      }
      
      // Avoid completely irrelevant matches
      const productText = this.getProductText(result.product).toLowerCase();
      const queryTerms = this.tokenize(query.toLowerCase());
      
      // At least one query term should appear in product
      const hasQueryTerm = queryTerms.some(term => 
        productText.includes(term) || 
        result.relevanceBreakdown.fuzzy > 0.3
      );
      
      return hasQueryTerm;
    });
  }

  /**
   * Build inverted index for fast retrieval
   */
  private buildSearchIndex(): void {
    console.log('🔧 Building search index...');
    
    this.products.forEach((product, index) => {
      const productId = `${product.title}_${index}`;
      const text = this.getProductText(product);
      const terms = this.tokenize(text);
      
      // Build term frequency for this product
      const tf = new Map<string, number>();
      for (const term of terms) {
        tf.set(term, (tf.get(term) || 0) + 1);
      }
      this.termFrequency.set(productId, tf);
      
      // Build document frequency and inverted index
      const uniqueTerms = new Set(terms);
      for (const term of uniqueTerms) {
        this.documentFrequency.set(term, (this.documentFrequency.get(term) || 0) + 1);
        
        if (!this.productIndex.has(term)) {
          this.productIndex.set(term, new Set());
        }
        this.productIndex.get(term)!.add(index);
      }
    });
    
    console.log(`📊 Index built: ${this.documentFrequency.size} unique terms`);
  }

  /**
   * Initialize synonym mappings for query expansion
   */
  private initializeSynonyms(): void {
    const synonymMappings = {
      'tomate': ['tomato', 'tomates'],
      'tomato': ['tomate', 'tomates'],
      'brokkoli': ['broccoli'],
      'broccoli': ['brokkoli'],
      'nudeln': ['pasta', 'spaghetti', 'noodles'],
      'pasta': ['nudeln', 'spaghetti', 'noodles'],
      'milch': ['milk'],
      'milk': ['milch'],
      'käse': ['cheese'],
      'cheese': ['käse'],
      'bio': ['organic', 'biologisch'],
      'organic': ['bio', 'biologisch'],
      'vollkorn': ['wholemeal', 'whole grain', 'whole wheat'],
      'wholemeal': ['vollkorn', 'whole grain'],
      'zwiebel': ['onion', 'zwiebeln'],
      'onion': ['zwiebel', 'zwiebeln'],
      'hähnchen': ['chicken', 'huhn'],
      'chicken': ['hähnchen', 'huhn']
    };
    
    for (const [term, syns] of Object.entries(synonymMappings)) {
      this.synonyms.set(term, syns);
    }
  }

  // Helper methods for string processing and similarity
  private getProductText(product: Product): string {
    return `${product.title} ${product.category} ${product.volume}`;
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 1);
  }

  private determineTier(breakdown: any): string {
    if (breakdown.exact > 0.7) return 'tier1';
    if (breakdown.tfidf > 0.5 || breakdown.fuzzy > 0.6) return 'tier2';
    return 'tier3';
  }

  private extractBrand(title: string): string {
    const brands = ['REWE', 'ja!', 'Bio', 'EDEKA', 'K-Classic', 'Gut&Günstig'];
    for (const brand of brands) {
      if (title.includes(brand)) return brand;
    }
    return 'Other';
  }

  private getDefaultConfig(): SearchConfig {
    return {
      maxResults: 10,
      fuzzyThreshold: 0.3,
      enableSemanticSearch: true,
      diversityFactor: 0.3,
      queryExpansion: true
    };
  }

  // String similarity algorithms
  private levenshteinSimilarity(s1: string, s2: string): number {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(s1: string, s2: string): number {
    const matrix = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
    
    for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= s2.length; j++) {
      for (let i = 1; i <= s1.length; i++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }
    
    return matrix[s2.length][s1.length];
  }

  private jaroWinklerSimilarity(s1: string, s2: string): number {
    const jaro = this.jaroSimilarity(s1, s2);
    if (jaro < 0.7) return jaro;
    
    // Calculate common prefix length (up to 4 characters)
    let prefix = 0;
    for (let i = 0; i < Math.min(s1.length, s2.length, 4); i++) {
      if (s1[i] === s2[i]) prefix++;
      else break;
    }
    
    return jaro + (0.1 * prefix * (1 - jaro));
  }

  private jaroSimilarity(s1: string, s2: string): number {
    if (s1.length === 0 && s2.length === 0) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0.0;
    
    const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
    if (matchWindow < 0) return 0.0;
    
    const s1Matches = new Array(s1.length).fill(false);
    const s2Matches = new Array(s2.length).fill(false);
    
    let matches = 0;
    for (let i = 0; i < s1.length; i++) {
      const start = Math.max(0, i - matchWindow);
      const end = Math.min(i + matchWindow + 1, s2.length);
      
      for (let j = start; j < end; j++) {
        if (s2Matches[j] || s1[i] !== s2[j]) continue;
        s1Matches[i] = s2Matches[j] = true;
        matches++;
        break;
      }
    }
    
    if (matches === 0) return 0.0;
    
    // Calculate transpositions
    let transpositions = 0;
    let k = 0;
    for (let i = 0; i < s1.length; i++) {
      if (!s1Matches[i]) continue;
      while (!s2Matches[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }
    
    return (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3.0;
  }

  private ngramSimilarity(s1: string, s2: string, n: number): number {
    const ngrams1 = this.getNgrams(s1, n);
    const ngrams2 = this.getNgrams(s2, n);
    
    if (ngrams1.size === 0 && ngrams2.size === 0) return 1.0;
    if (ngrams1.size === 0 || ngrams2.size === 0) return 0.0;
    
    const intersection = new Set([...ngrams1].filter(x => ngrams2.has(x)));
    const union = new Set([...ngrams1, ...ngrams2]);
    
    return intersection.size / union.size;
  }

  private getNgrams(text: string, n: number): Set<string> {
    const ngrams = new Set<string>();
    for (let i = 0; i <= text.length - n; i++) {
      ngrams.add(text.substring(i, i + n));
    }
    return ngrams;
  }

  private weightedSubstringMatch(query: string, text: string): number {
    let maxScore = 0;
    
    // Check for query as substring with position weighting
    const index = text.indexOf(query);
    if (index >= 0) {
      // Earlier matches get higher scores
      const positionWeight = 1.0 - (index / text.length) * 0.5;
      const lengthWeight = query.length / text.length;
      maxScore = Math.max(maxScore, positionWeight * lengthWeight);
    }
    
    // Check for individual terms
    const queryTerms = query.split(' ');
    let termMatches = 0;
    
    for (const term of queryTerms) {
      if (text.includes(term)) {
        termMatches++;
      }
    }
    
    const termScore = termMatches / queryTerms.length * 0.8;
    return Math.max(maxScore, termScore);
  }
}