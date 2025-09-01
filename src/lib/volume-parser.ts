/**
 * Volume parser utility - handles volume/weight parsing with regex patterns
 * Ported from Python VolumeParser class
 */

export class VolumeParser {
  private patterns: Array<{
    regex: RegExp;
    extractor: (match: RegExpMatchArray) => { amount: number; unit: string } | null;
  }>;

  constructor() {
    this.patterns = [
      {
        regex: /(\d+(?:,\d+)?)\s*(kg|g|ml|l|stück|stuck)/i,
        extractor: (match) => {
          const amount = parseFloat(match[1].replace(',', '.'));
          const unit = match[2];
          return { amount, unit };
        }
      },
      {
        regex: /(\d+)x(\d+)(g|ml|l)/i,
        extractor: (match) => {
          const amount = parseFloat(match[1]) * parseFloat(match[2]);
          const unit = match[3];
          return { amount, unit };
        }
      },
      {
        regex: /ca\.\s*(\d+)(g|ml|l|kg)/i,
        extractor: (match) => {
          const amount = parseFloat(match[1]);
          const unit = match[2];
          return { amount, unit };
        }
      },
      {
        regex: /(\d+(?:,\d+)?)\s+(g|ml|l|kg|stück|stuck)/i,
        extractor: (match) => {
          const amount = parseFloat(match[1].replace(',', '.'));
          const unit = match[2];
          return { amount, unit };
        }
      }
    ];
  }

  /**
   * Parse volume from text, return { amount, unit } or null
   */
  parseVolume(text: string): { amount: number; unit: string } | null {
    const cleanText = text.toLowerCase().trim();

    for (const pattern of this.patterns) {
      const match = cleanText.match(pattern.regex);
      if (match) {
        try {
          const result = pattern.extractor(match);
          if (result) {
            result.unit = this.normalizeUnit(result.unit);
            return result;
          }
        } catch {
          continue;
        }
      }
    }
    
    return null;
  }

  /**
   * Normalize unit variations
   */
  private normalizeUnit(unit: string): string {
    const unitLower = unit.toLowerCase();
    const unitMap: Record<string, string> = {
      'stuck': 'stück',
      'stueck': 'stück',
      'piece': 'stück',
      'pcs': 'stück',
    };
    
    return unitMap[unitLower] || unitLower;
  }

  /**
   * Convert various units to grams for comparison
   */
  convertToGrams(amount: number, unit: string): number | null {
    const unitLower = unit.toLowerCase();
    const conversions: Record<string, number> = {
      'g': 1,
      'kg': 1000,
      'ml': 1, // Assuming 1ml ≈ 1g for most groceries
      'l': 1000,
      // 'stück' cannot be converted to weight
    };

    const conversion = conversions[unitLower];
    return conversion !== undefined ? amount * conversion : null;
  }

  /**
   * Calculate how many units are needed for a given amount
   */
  calculateUnitsNeeded(neededAmount: number, neededUnit: string, productAmount: number, productUnit: string): number | null {
    const neededGrams = this.convertToGrams(neededAmount, neededUnit);
    const productGrams = this.convertToGrams(productAmount, productUnit);

    if (neededGrams !== null && productGrams !== null) {
      return Math.ceil(neededGrams / productGrams);
    }

    // Handle piece-based calculations
    if (neededUnit.toLowerCase() === 'stück' && productUnit.toLowerCase() === 'stück') {
      return Math.ceil(neededAmount / productAmount);
    }

    return null;
  }
}