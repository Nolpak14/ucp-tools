/**
 * Product Feed Quality Analyzer
 * Deep analysis of product data quality for AI agent visibility
 */

import type {
    ProductData,
    ProductOffer,
    ProductAnalysis,
    QualityCheck,
    FeedAnalysisResult,
    FeedAnalysisInput,
    CategoryScores,
    Recommendation,
    FeedSummary,
    GtinValidation,
    CheckCategory,
} from './types.js';

import {
    QUALITY_CHECKS,
    VALID_AVAILABILITY_VALUES,
    CATEGORY_WEIGHTS,
    GRADE_THRESHOLDS,
} from './types.js';

/**
 * Default maximum products to analyze
 */
const DEFAULT_MAX_PRODUCTS = 50;

/**
 * Minimum description length considered "good"
 */
const MIN_DESCRIPTION_LENGTH = 50;

/**
 * Validate a GTIN/UPC/EAN identifier
 */
export function validateGtin(gtin: string): GtinValidation {
    if (!gtin || typeof gtin !== 'string') {
        return { isValid: false, error: 'GTIN is empty or not a string' };
    }

    // Remove any spaces or dashes
    const cleaned = gtin.replace(/[\s-]/g, '');

    // Check if it's all digits
    if (!/^\d+$/.test(cleaned)) {
        return { isValid: false, error: 'GTIN must contain only digits' };
    }

    const length = cleaned.length;

    // Determine type based on length
    let type: GtinValidation['type'];
    switch (length) {
        case 8:
            type = 'GTIN-8';
            break;
        case 12:
            type = 'UPC';
            break;
        case 13:
            type = 'EAN';
            break;
        case 14:
            type = 'GTIN-14';
            break;
        default:
            return { isValid: false, error: `Invalid GTIN length: ${length}. Expected 8, 12, 13, or 14 digits` };
    }

    // Validate check digit
    if (!validateGtinCheckDigit(cleaned)) {
        return { isValid: false, type, error: 'Invalid check digit' };
    }

    return { isValid: true, type };
}

/**
 * Validate GTIN check digit using modulo 10 algorithm
 */
function validateGtinCheckDigit(gtin: string): boolean {
    const digits = gtin.split('').map(Number);
    const checkDigit = digits.pop()!;

    let sum = 0;
    const multipliers = gtin.length === 13 || gtin.length === 8
        ? [1, 3] // EAN-13, GTIN-8
        : [3, 1]; // UPC-12, GTIN-14

    for (let i = 0; i < digits.length; i++) {
        sum += digits[i] * multipliers[i % 2];
    }

    const calculatedCheck = (10 - (sum % 10)) % 10;
    return calculatedCheck === checkDigit;
}

/**
 * Extract products from HTML content
 */
export function extractProductsFromHtml(html: string): ProductData[] {
    const products: ProductData[] = [];

    // Find all JSON-LD script tags
    const jsonLdRegex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;

    while ((match = jsonLdRegex.exec(html)) !== null) {
        try {
            const jsonContent = match[1].trim();
            const data = JSON.parse(jsonContent);

            // Handle single object or array
            const items = Array.isArray(data) ? data : [data];

            for (const item of items) {
                // Check if it's a Product
                if (item['@type'] === 'Product') {
                    products.push(item as ProductData);
                }
                // Check for @graph containing products
                else if (item['@graph'] && Array.isArray(item['@graph'])) {
                    for (const graphItem of item['@graph']) {
                        if (graphItem['@type'] === 'Product') {
                            products.push(graphItem as ProductData);
                        }
                    }
                }
                // Check for ItemList containing products
                else if (item['@type'] === 'ItemList' && item.itemListElement) {
                    const listItems = Array.isArray(item.itemListElement)
                        ? item.itemListElement
                        : [item.itemListElement];
                    for (const listItem of listItems) {
                        if (listItem.item && listItem.item['@type'] === 'Product') {
                            products.push(listItem.item as ProductData);
                        } else if (listItem['@type'] === 'Product') {
                            products.push(listItem as ProductData);
                        }
                    }
                }
            }
        } catch {
            // Skip invalid JSON
            continue;
        }
    }

    return products;
}

/**
 * Get the primary offer from a product
 */
function getPrimaryOffer(product: ProductData): ProductOffer | undefined {
    if (!product.offers) return undefined;

    if (Array.isArray(product.offers)) {
        return product.offers[0];
    }

    return product.offers;
}

/**
 * Get image count from product data
 */
function getImageCount(product: ProductData): number {
    if (!product.image) return 0;

    if (typeof product.image === 'string') return 1;

    if (Array.isArray(product.image)) {
        return product.image.length;
    }

    return 1;
}

/**
 * Get brand name from product
 */
function getBrandName(product: ProductData): string | undefined {
    if (!product.brand) return undefined;

    if (typeof product.brand === 'string') return product.brand;

    return product.brand.name;
}

/**
 * Get any GTIN value from product
 */
function getGtin(product: ProductData): string | undefined {
    return product.gtin || product.gtin13 || product.gtin12 || product.gtin14 || product.gtin8;
}

/**
 * Analyze a single product
 */
export function analyzeProduct(product: ProductData): ProductAnalysis {
    const issues: QualityCheck[] = [];
    const offer = getPrimaryOffer(product);
    const brandName = getBrandName(product);
    const gtin = getGtin(product);
    const imageCount = getImageCount(product);
    const descriptionLength = product.description?.length || 0;

    // Build attributes object
    const attributes = {
        hasName: Boolean(product.name && product.name.trim()),
        hasDescription: Boolean(product.description && product.description.trim()),
        hasSku: Boolean(product.sku),
        hasGtin: Boolean(gtin),
        hasBrand: Boolean(brandName),
        hasImage: imageCount > 0,
        hasPrice: offer?.price !== undefined && offer?.price !== null,
        hasAvailability: Boolean(offer?.availability),
        hasCategory: Boolean(product.category),
        descriptionLength,
        imageCount,
    };

    // Completeness checks
    if (!attributes.hasName) {
        issues.push(createIssue('missing-name', product.name));
    }

    if (!attributes.hasDescription) {
        issues.push(createIssue('missing-description', product.name));
    } else if (descriptionLength < MIN_DESCRIPTION_LENGTH) {
        issues.push(createIssue('short-description', product.name, `Description is only ${descriptionLength} characters`));
    }

    if (!attributes.hasBrand) {
        issues.push(createIssue('missing-brand', product.name));
    }

    // Identifier checks
    if (!attributes.hasSku) {
        issues.push(createIssue('missing-sku', product.name));
    }

    if (!attributes.hasGtin) {
        issues.push(createIssue('missing-gtin', product.name));
    } else {
        const gtinValidation = validateGtin(gtin!);
        if (!gtinValidation.isValid) {
            issues.push(createIssue('invalid-gtin', product.name, gtinValidation.error));
        }
    }

    // Image checks
    if (!attributes.hasImage) {
        issues.push(createIssue('missing-image', product.name));
    } else if (imageCount === 1) {
        issues.push(createIssue('single-image', product.name));
    }

    // Pricing checks
    if (!offer) {
        issues.push(createIssue('missing-price', product.name));
    } else {
        if (!offer.price && offer.price !== 0) {
            issues.push(createIssue('missing-price', product.name));
        } else {
            const price = typeof offer.price === 'string' ? parseFloat(offer.price) : offer.price;
            if (isNaN(price)) {
                issues.push(createIssue('invalid-price', product.name, `Price value: "${offer.price}"`));
            }
        }

        if (!offer.priceCurrency) {
            issues.push(createIssue('missing-currency', product.name));
        }
    }

    // Availability checks
    if (!attributes.hasAvailability) {
        issues.push(createIssue('missing-availability', product.name));
    } else if (offer?.availability && !VALID_AVAILABILITY_VALUES.includes(offer.availability)) {
        issues.push(createIssue('invalid-availability', product.name, `Value: "${offer.availability}"`));
    }

    // Category checks
    if (!attributes.hasCategory) {
        issues.push(createIssue('missing-category', product.name));
    }

    // Calculate product score
    const score = calculateProductScore(attributes);

    return {
        name: product.name || 'Unknown Product',
        url: product.url,
        sku: product.sku,
        score,
        issues,
        attributes,
    };
}

/**
 * Create a quality check issue
 */
function createIssue(checkId: string, productName?: string, details?: string): QualityCheck {
    const checkDef = QUALITY_CHECKS[checkId];

    return {
        id: checkId,
        name: checkDef.name,
        category: checkDef.category,
        passed: false,
        severity: checkDef.severity,
        message: checkDef.description,
        details,
        affectedProducts: productName ? [productName] : undefined,
    };
}

/**
 * Calculate product score based on attributes
 */
function calculateProductScore(attributes: ProductAnalysis['attributes']): number {
    let score = 0;
    const weights = {
        hasName: 15,
        hasDescription: 10,
        hasSku: 5,
        hasGtin: 10,
        hasBrand: 10,
        hasImage: 15,
        hasPrice: 20,
        hasAvailability: 5,
        hasCategory: 5,
        descriptionQuality: 5,
    };

    if (attributes.hasName) score += weights.hasName;
    if (attributes.hasDescription) score += weights.hasDescription;
    if (attributes.hasSku) score += weights.hasSku;
    if (attributes.hasGtin) score += weights.hasGtin;
    if (attributes.hasBrand) score += weights.hasBrand;
    if (attributes.hasImage) score += weights.hasImage;
    if (attributes.hasPrice) score += weights.hasPrice;
    if (attributes.hasAvailability) score += weights.hasAvailability;
    if (attributes.hasCategory) score += weights.hasCategory;

    // Bonus for good description length
    if (attributes.descriptionLength >= MIN_DESCRIPTION_LENGTH) {
        score += weights.descriptionQuality;
    }

    return Math.min(100, score);
}

/**
 * Calculate category scores from product analyses
 */
function calculateCategoryScores(products: ProductAnalysis[]): CategoryScores {
    if (products.length === 0) {
        return {
            completeness: 0,
            identifiers: 0,
            images: 0,
            pricing: 0,
            descriptions: 0,
            categories: 0,
            availability: 0,
        };
    }

    const totals = products.reduce(
        (acc, p) => {
            // Completeness: name, brand
            acc.completeness += (p.attributes.hasName ? 50 : 0) + (p.attributes.hasBrand ? 50 : 0);

            // Identifiers: SKU, GTIN
            acc.identifiers += (p.attributes.hasSku ? 50 : 0) + (p.attributes.hasGtin ? 50 : 0);

            // Images
            acc.images += p.attributes.hasImage ? (p.attributes.imageCount > 1 ? 100 : 70) : 0;

            // Pricing
            acc.pricing += p.attributes.hasPrice ? 100 : 0;

            // Descriptions
            if (p.attributes.hasDescription) {
                acc.descriptions += p.attributes.descriptionLength >= MIN_DESCRIPTION_LENGTH ? 100 : 60;
            }

            // Categories
            acc.categories += p.attributes.hasCategory ? 100 : 0;

            // Availability
            acc.availability += p.attributes.hasAvailability ? 100 : 0;

            return acc;
        },
        { completeness: 0, identifiers: 0, images: 0, pricing: 0, descriptions: 0, categories: 0, availability: 0 }
    );

    const count = products.length;
    return {
        completeness: Math.round(totals.completeness / count),
        identifiers: Math.round(totals.identifiers / count),
        images: Math.round(totals.images / count),
        pricing: Math.round(totals.pricing / count),
        descriptions: Math.round(totals.descriptions / count),
        categories: Math.round(totals.categories / count),
        availability: Math.round(totals.availability / count),
    };
}

/**
 * Calculate overall score from category scores
 */
function calculateOverallScore(categoryScores: CategoryScores): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const [category, score] of Object.entries(categoryScores)) {
        const weight = CATEGORY_WEIGHTS[category as CheckCategory];
        weightedSum += score * weight;
        totalWeight += weight;
    }

    return Math.round(weightedSum / totalWeight);
}

/**
 * Calculate agent visibility score
 * This is a specialized score focusing on what AI agents need most
 */
function calculateAgentVisibilityScore(summary: FeedSummary): number {
    if (summary.totalProducts === 0) return 0;

    const total = summary.totalProducts;

    // Critical factors for AI agents (weighted heavily)
    const criticalScore =
        ((summary.withName / total) * 30) +
        ((summary.withPrice / total) * 30) +
        ((summary.withImages / total) * 20);

    // Important factors
    const importantScore =
        ((summary.withDescription / total) * 10) +
        ((summary.withGtin / total) * 5) +
        ((summary.withAvailability / total) * 5);

    return Math.round(criticalScore + importantScore);
}

/**
 * Get grade from score
 */
function getGrade(score: number): FeedAnalysisResult['grade'] {
    if (score >= GRADE_THRESHOLDS.A) return 'A';
    if (score >= GRADE_THRESHOLDS.B) return 'B';
    if (score >= GRADE_THRESHOLDS.C) return 'C';
    if (score >= GRADE_THRESHOLDS.D) return 'D';
    return 'F';
}

/**
 * Generate recommendations based on analysis
 */
function generateRecommendations(summary: FeedSummary, issues: QualityCheck[]): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const total = summary.totalProducts;

    if (total === 0) return recommendations;

    // Missing prices - critical
    const missingPrices = total - summary.withPrice;
    if (missingPrices > 0) {
        recommendations.push({
            priority: 'high',
            category: 'pricing',
            title: 'Add Missing Prices',
            description: `${missingPrices} products are missing price information. AI agents cannot complete purchases without prices.`,
            impact: 'Critical - Products without prices cannot be purchased through AI agents',
            affectedCount: missingPrices,
        });
    }

    // Missing images - critical
    const missingImages = total - summary.withImages;
    if (missingImages > 0) {
        recommendations.push({
            priority: 'high',
            category: 'images',
            title: 'Add Product Images',
            description: `${missingImages} products are missing images. Visual product information is essential for AI shopping.`,
            impact: 'High - Products without images are less likely to be recommended',
            affectedCount: missingImages,
        });
    }

    // Missing names - critical
    const missingNames = total - summary.withName;
    if (missingNames > 0) {
        recommendations.push({
            priority: 'high',
            category: 'completeness',
            title: 'Add Product Names',
            description: `${missingNames} products are missing names. This is required for product identification.`,
            impact: 'Critical - Products cannot be identified without names',
            affectedCount: missingNames,
        });
    }

    // Missing GTIN - medium priority
    const missingGtin = total - summary.withGtin;
    if (missingGtin > 0 && missingGtin / total > 0.5) {
        recommendations.push({
            priority: 'medium',
            category: 'identifiers',
            title: 'Add Global Identifiers (GTIN/UPC/EAN)',
            description: `${missingGtin} products are missing global identifiers. These enable cross-platform product matching.`,
            impact: 'Medium - Improves product matching across AI platforms',
            affectedCount: missingGtin,
        });
    }

    // Missing descriptions - medium priority
    const missingDescriptions = total - summary.withDescription;
    if (missingDescriptions > 0 && missingDescriptions / total > 0.3) {
        recommendations.push({
            priority: 'medium',
            category: 'descriptions',
            title: 'Add Product Descriptions',
            description: `${missingDescriptions} products are missing descriptions. Good descriptions help AI agents understand and recommend products.`,
            impact: 'Medium - Better descriptions improve AI recommendations',
            affectedCount: missingDescriptions,
        });
    }

    // Short descriptions
    if (summary.averageDescriptionLength < MIN_DESCRIPTION_LENGTH && summary.withDescription > 0) {
        recommendations.push({
            priority: 'low',
            category: 'descriptions',
            title: 'Improve Description Length',
            description: `Average description length is ${Math.round(summary.averageDescriptionLength)} characters. Aim for at least ${MIN_DESCRIPTION_LENGTH} characters.`,
            impact: 'Low - Longer descriptions provide more context for AI agents',
            affectedCount: summary.withDescription,
        });
    }

    // Missing availability
    const missingAvailability = total - summary.withAvailability;
    if (missingAvailability > 0 && missingAvailability / total > 0.3) {
        recommendations.push({
            priority: 'medium',
            category: 'availability',
            title: 'Add Availability Status',
            description: `${missingAvailability} products are missing availability information.`,
            impact: 'Medium - Availability helps AI agents make informed purchase decisions',
            affectedCount: missingAvailability,
        });
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return recommendations;
}

/**
 * Aggregate issues across all products
 */
function aggregateIssues(products: ProductAnalysis[]): QualityCheck[] {
    const issueMap = new Map<string, QualityCheck>();

    for (const product of products) {
        for (const issue of product.issues) {
            const existing = issueMap.get(issue.id);
            if (existing) {
                // Aggregate affected products
                if (issue.affectedProducts && existing.affectedProducts) {
                    existing.affectedProducts.push(...issue.affectedProducts);
                }
            } else {
                issueMap.set(issue.id, { ...issue, affectedProducts: [...(issue.affectedProducts || [])] });
            }
        }
    }

    return Array.from(issueMap.values());
}

/**
 * Calculate feed summary statistics
 */
function calculateSummary(products: ProductAnalysis[]): FeedSummary {
    const total = products.length;

    if (total === 0) {
        return {
            totalProducts: 0,
            withName: 0,
            withDescription: 0,
            withSku: 0,
            withGtin: 0,
            withBrand: 0,
            withImages: 0,
            withPrice: 0,
            withAvailability: 0,
            withCategory: 0,
            averageDescriptionLength: 0,
            averageImageCount: 0,
        };
    }

    const summary = products.reduce(
        (acc, p) => {
            if (p.attributes.hasName) acc.withName++;
            if (p.attributes.hasDescription) acc.withDescription++;
            if (p.attributes.hasSku) acc.withSku++;
            if (p.attributes.hasGtin) acc.withGtin++;
            if (p.attributes.hasBrand) acc.withBrand++;
            if (p.attributes.hasImage) acc.withImages++;
            if (p.attributes.hasPrice) acc.withPrice++;
            if (p.attributes.hasAvailability) acc.withAvailability++;
            if (p.attributes.hasCategory) acc.withCategory++;
            acc.totalDescriptionLength += p.attributes.descriptionLength;
            acc.totalImageCount += p.attributes.imageCount;
            return acc;
        },
        {
            withName: 0,
            withDescription: 0,
            withSku: 0,
            withGtin: 0,
            withBrand: 0,
            withImages: 0,
            withPrice: 0,
            withAvailability: 0,
            withCategory: 0,
            totalDescriptionLength: 0,
            totalImageCount: 0,
        }
    );

    return {
        totalProducts: total,
        withName: summary.withName,
        withDescription: summary.withDescription,
        withSku: summary.withSku,
        withGtin: summary.withGtin,
        withBrand: summary.withBrand,
        withImages: summary.withImages,
        withPrice: summary.withPrice,
        withAvailability: summary.withAvailability,
        withCategory: summary.withCategory,
        averageDescriptionLength: summary.totalDescriptionLength / total,
        averageImageCount: summary.totalImageCount / total,
    };
}

/**
 * Analyze product feed from raw product data
 */
export function analyzeProductFeed(
    products: ProductData[],
    url: string,
    maxProducts: number = DEFAULT_MAX_PRODUCTS,
    includeProductDetails: boolean = true
): FeedAnalysisResult {
    const productsToAnalyze = products.slice(0, maxProducts);
    const productAnalyses = productsToAnalyze.map(analyzeProduct);

    const summary = calculateSummary(productAnalyses);
    const categoryScores = calculateCategoryScores(productAnalyses);
    const overallScore = calculateOverallScore(categoryScores);
    const agentVisibilityScore = calculateAgentVisibilityScore(summary);
    const issues = aggregateIssues(productAnalyses);
    const recommendations = generateRecommendations(summary, issues);

    // Get top issues (most impactful)
    const topIssues = issues
        .filter(i => i.severity === 'critical' || i.severity === 'warning')
        .sort((a, b) => {
            const severityOrder = { critical: 0, warning: 1, info: 2 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        })
        .slice(0, 5);

    return {
        url,
        analyzedAt: new Date().toISOString(),
        productsFound: products.length,
        productsAnalyzed: productsToAnalyze.length,
        overallScore,
        agentVisibilityScore,
        grade: getGrade(overallScore),
        categoryScores,
        issues,
        topIssues,
        products: includeProductDetails ? productAnalyses : [],
        recommendations,
        summary,
    };
}

/**
 * Analyze a product feed from HTML content
 */
export function analyzeProductFeedFromHtml(
    html: string,
    url: string,
    options: Partial<FeedAnalysisInput> = {}
): FeedAnalysisResult {
    const products = extractProductsFromHtml(html);
    const maxProducts = options.maxProducts ?? DEFAULT_MAX_PRODUCTS;
    const includeProductDetails = options.includeProductDetails ?? true;

    return analyzeProductFeed(products, url, maxProducts, includeProductDetails);
}
