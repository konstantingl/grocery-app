import OpenAI from 'openai';
import type {
  ParsedShoppingList,
  CategorySelection,
  SearchTiersResult,
  QualityFilterResult,
  SmartQuantityResult,
  Product
} from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 15000, // 15 second timeout
});

export class OpenAIClient {
  /**
   * Retry wrapper for OpenAI calls with exponential backoff
   */
  private static async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 2,
    initialDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          break;
        }
        
        // Don't retry on certain errors
        if (error instanceof Error && 
            (error.message.includes('Invalid API key') || 
             error.message.includes('rate limit') ||
             error.message.includes('quota'))) {
          break;
        }
        
        const delay = initialDelay * Math.pow(2, attempt);
        console.warn(`OpenAI call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  /**
   * Parse shopping list using LLM for intelligent extraction
   */
  static async parseShoppingList(shoppingList: string): Promise<ParsedShoppingList> {
    const prompt = `
Parse this detailed shopping list into structured items. Extract ALL important information:

Input shopping list:
${shoppingList}

For each item, extract:
1. Base item name (in German for grocery search)
2. Quantity needed (amount + unit)
3. Specific attributes (organic, whole wheat, firm, fresh, etc.)
4. Alternative names mentioned (like "rocket" for arugula)
5. Item category type for smart handling

Example:
"650g broccoli florets" →
- item: "brokkoli", amount: 650, unit: "g"  
- attributes: ["fresh", "florets"]
- item_type: "fresh_produce"

"whole wheat pasta" →
- item: "nudeln", amount: 500, unit: "g" (assume standard if not specified)
- attributes: ["whole_wheat", "vollkorn"] 
- item_type: "dry_goods"
`;

    const response = await this.retryWithBackoff(() => 
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "parsed_shopping_list",
            schema: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      item: { type: "string", description: "Base item in German" },
                      amount: { type: "number", description: "Quantity needed" },
                      unit: { type: "string", enum: ["g", "kg", "ml", "l", "stück"] },
                      original: { type: "string", description: "Original text" },
                      attributes: { type: "array", items: { type: "string" } },
                      alternatives: { type: "array", items: { type: "string" } },
                      item_type: {
                        type: "string",
                        enum: ["fresh_produce", "dry_goods", "dairy", "meat", "herbs_spices", "canned", "condiments"]
                      }
                    },
                    required: ["item", "amount", "unit", "original", "item_type"]
                  }
                }
              },
              required: ["items"]
            }
          }
        },
        temperature: 0.1
      })
    );

    const responseContent = response.choices[0].message.content;
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(responseContent);
  }

  /**
   * Determine target categories for shopping item
   */
  static async determineCategories(item: string, itemType: string, attributes: string[], originalText: string): Promise<CategorySelection> {

    const prompt = `
Map this shopping item to 1-2 appropriate German grocery store (Rewe) categories:

Item: ${item}
Type: ${itemType}
Attributes: ${attributes.join(', ') || 'none'}
Original text: ${originalText}

Available Rewe categories:
- "Obst & Gemüse" (fresh produce, fruits, vegetables)
- "Fertiggerichte & Konserven" (ready meals, canned goods, preserved foods)
- "Fleisch & Fisch" (meat, fish, seafood, plant-based protein alternatives like tofu, tempeh, seitan)
- "Kochen & Backen" (cooking & baking ingredients)
- "Käse, Eier & Molkerei" (cheese, eggs, dairy products)
- "Brot, Cerealien & Aufstriche" (bread, cereals, spreads)
- "Süßes & Salziges" (sweets, snacks, chips)
- "Öle, Soßen & Gewürze" (oils, sauces, spices, condiments)

Critical rules:
- Fresh produce (tomatoes, broccoli, etc.) → ONLY "Obst & Gemüse"
- Canned/preserved items → "Fertiggerichte & Konserven"
- Plant-based proteins (tofu, tempeh, seitan, vegan alternatives) → "Fleisch & Fisch"
- Never mix fresh and canned categories for the same item

Return 1-2 most appropriate category names exactly as shown above.
`;

    const response = await this.retryWithBackoff(() =>
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "category_selection",
            schema: {
              type: "object",
              properties: {
                categories: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 1,
                  maxItems: 2
                },
                reasoning: { type: "string" }
              },
              required: ["categories", "reasoning"]
            }
          }
        },
        temperature: 0.1
      })
    );

    const responseContent = response.choices[0].message.content;
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(responseContent);
  }

  /**
   * Generate tiered search terms
   */
  static async generateSearchTiers(item: string, attributes: string[], alternatives: string[], itemType: string): Promise<SearchTiersResult> {
    const attributesStr = attributes.length ? `, attributes: ${attributes.join(', ')}` : '';
    const alternativesStr = alternatives.length ? `, alternatives: ${alternatives.join(', ')}` : '';

    const prompt = `
Generate German grocery store search terms in 3 tiers for: "${item}"${attributesStr}${alternativesStr}
Item type: ${itemType}

IMPORTANT: German grocery stores often use BOTH German and anglicized spellings. Include ALL common spelling variants!

TIER 1 - Exact/Specific (most important):
- Include ALL specific attributes mentioned (organic=bio, whole wheat=vollkorn, firm=fest, etc.)
- Include BOTH German AND anglicized spellings (brokkoli AND broccoli)
- Include common product variations
- Maximum 6 terms

TIER 2 - Category/General (fallback):
- Basic item without specific qualifiers
- Include both spelling variants  
- Common varieties without attributes
- Maximum 6 terms

TIER 3 - Alternatives (last resort):
- Similar items that could substitute
- Different forms of same ingredient
- Maximum 4 terms

Critical examples for spelling variants:
"brokkoli" → Include BOTH "brokkoli" AND "broccoli" (stores use both!)
"zucchini" → Include BOTH "zucchini" AND "zuchini"
"paprika" → Include BOTH "paprika" AND "pepper"

Examples:
"firm tofu" → 
Tier 1: ["fester tofu", "tofu fest", "natur tofu fest", "firm tofu", "naturtofu fest", "tofu natur fest"]
Tier 2: ["tofu", "soja tofu", "naturtofu", "bio tofu", "tofu bio", "sojatorfu"]
Tier 3: ["seitan", "tempeh", "soja protein"]

"broccoli florets" →
Tier 1: ["broccoli röschen", "brokkoli röschen", "frischer broccoli", "frischer brokkoli", "bio broccoli röschen", "bio brokkoli röschen"] 
Tier 2: ["broccoli", "brokkoli", "broccoli frisch", "brokkoli frisch", "broccoli köpfe", "brokkoli köpfe"]
Tier 3: ["blumenkohl röschen", "romanesco", "grünkohl"]

"green onion" (spring onion/scallion) →
Tier 1: ["lauchzwiebeln", "frühlingszwiebeln", "green onion", "spring onion", "scallion", "lauch zwiebeln"]
Tier 2: ["zwiebeln", "lauch", "onion", "zwiebel", "grün zwiebel"]
Tier 3: ["schnittlauch", "porree", "chives"]

Item to process: "${item}"${attributesStr}
`;

    const response = await this.retryWithBackoff(() =>
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "search_tiers",
            schema: {
              type: "object",
              properties: {
                tier1: { type: "array", items: { type: "string" }, maxItems: 6 },
                tier2: { type: "array", items: { type: "string" }, maxItems: 6 },
                tier3: { type: "array", items: { type: "string" }, maxItems: 4 }
              },
              required: ["tier1", "tier2", "tier3"]
            }
          }
        },
        temperature: 0.1
      })
    );

    const responseContent = response.choices[0].message.content;
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(responseContent);
  }

  /**
   * Quality filter and re-rank candidates
   */
  static async qualityFilter(
    candidates: Array<{ product: Product; score: number; tier: string }>,
    originalText: string,
    attributes: string[],
    itemType: string,
    amount: number,
    unit: string
  ): Promise<QualityFilterResult> {
    const candidateList = candidates.map((c, i) => 
      `${i}: ${c.product.title} - €${c.product.price} - ${c.product.category} (score: ${c.score.toFixed(2)}, ${c.tier})`
    );

    const attributesStr = attributes.length ? ` with attributes: ${attributes.join(', ')}` : '';

    const prompt = `
Evaluate and re-rank these grocery products for: "${originalText}"${attributesStr}

Item type: ${itemType}
Needed quantity: ${amount}${unit}

Candidates:
${candidateList.join('\n')}

Rank the TOP 10 most appropriate products considering:

PRIORITIZE:
1. Exact attribute matches (bio, vollkorn, fest, frisch, etc.)
2. Appropriate package sizes (not 10x too big/small)
3. Fresh versions over processed (for produce)
4. Right food category match

ACCEPT:
- Different brands of same product type
- Reasonable package size differences  
- Close alternatives if exact unavailable

STRONGLY REJECT:
- Completely different food types
- Highly processed when fresh requested
- Sauces/condiments when ingredient requested
- Extremely inappropriate sizes

Return indices of best candidates in preference order with brief reasoning for each.
`;

    const response = await this.retryWithBackoff(() =>
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "quality_filter",
            schema: {
              type: "object",
              properties: {
                selectedCandidates: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      index: { type: "integer", minimum: 0 },
                      reasoning: { type: "string" }
                    },
                    required: ["index", "reasoning"]
                  },
                  maxItems: 10,
                  description: "Best candidates with reasoning in preference order"
                },
                overallReasoning: {
                  type: "string",
                  description: "Brief explanation of overall selection criteria"
                }
              },
              required: ["selectedCandidates", "overallReasoning"]
            }
          }
        },
        temperature: 0.1
      })
    );

    const responseContent = response.choices[0].message.content;
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(responseContent);
  }

  /**
   * Smart quantity calculation for complex cases
   */
  static async calculateQuantity(
    item: string,
    amount: number,
    unit: string,
    itemType: string,
    productTitle: string,
    productVolume: string,
    productPrice: number
  ): Promise<SmartQuantityResult> {
    const itemTypeContext: Record<string, string> = {
      "fresh_produce": "Fresh produce is perishable - reasonable overage (20-50%) is acceptable",
      "dry_goods": "Dry goods have long shelf life - larger packages are often economical",
      "dairy": "Dairy products are perishable but have some shelf life",
      "herbs_spices": "Small quantities needed - even large packages may be appropriate",
      "canned": "Canned goods last long - larger sizes often better value",
      "condiments": "Condiments last long - standard package sizes usually fine"
    };

    const context = itemTypeContext[itemType] || "Standard grocery item";

    const prompt = `
Calculate optimal purchase quantity for grocery shopping:

Needed: ${amount} ${unit} of ${item}
Available product: ${productTitle}
Product size: ${productVolume} 
Price per unit: €${productPrice}
Item type: ${itemType}

Context: ${context}

Calculate:
1. How many units to buy (consider perishability and practicality)
2. Total amount received
3. Appropriate unit for total amount

For fresh produce: Some overage acceptable (up to 50%)
For dry goods: Larger packages often economical
For small quantities: Standard package sizes usually appropriate

Provide practical shopping decisions, not just strict math.
`;

    const response = await this.retryWithBackoff(() =>
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "smart_quantity",
            schema: {
              type: "object",
              properties: {
                unitsNeeded: { type: "integer", minimum: 1 },
                actualAmount: { type: "number" },
                actualUnit: { type: "string" },
                reasoning: { type: "string" },
                overageAcceptable: { type: "boolean" }
              },
              required: ["unitsNeeded", "actualAmount", "actualUnit", "reasoning"]
            }
          }
        },
        temperature: 0.1
      })
    );

    const responseContent = response.choices[0].message.content;
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(responseContent);
  }
}