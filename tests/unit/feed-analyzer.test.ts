/**
 * Tests for Product Feed Quality Analyzer
 */

import { describe, it, expect } from 'vitest';
import {
    validateGtin,
    extractProductsFromHtml,
    analyzeProduct,
    analyzeProductFeed,
    analyzeProductFeedFromHtml,
    QUALITY_CHECKS,
    VALID_AVAILABILITY_VALUES,
    CATEGORY_WEIGHTS,
    GRADE_THRESHOLDS,
} from '../../src/feed-analyzer/index.js';
import type { ProductData } from '../../src/feed-analyzer/index.js';

describe('Feed Analyzer', () => {
    describe('validateGtin', () => {
        it('should validate a correct GTIN-13 (EAN)', () => {
            const result = validateGtin('4006381333931');
            expect(result.isValid).toBe(true);
            expect(result.type).toBe('EAN');
        });

        it('should validate a correct UPC-12', () => {
            const result = validateGtin('012345678905');
            expect(result.isValid).toBe(true);
            expect(result.type).toBe('UPC');
        });

        it('should validate a correct GTIN-8', () => {
            const result = validateGtin('96385074');
            expect(result.isValid).toBe(true);
            expect(result.type).toBe('GTIN-8');
        });

        it('should validate a correct GTIN-14', () => {
            const result = validateGtin('00012345678905');
            expect(result.isValid).toBe(true);
            expect(result.type).toBe('GTIN-14');
        });

        it('should reject invalid GTIN with wrong check digit', () => {
            const result = validateGtin('4006381333932'); // Wrong check digit
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('check digit');
        });

        it('should reject GTIN with invalid length', () => {
            const result = validateGtin('12345');
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Invalid GTIN length');
        });

        it('should reject GTIN with non-numeric characters', () => {
            const result = validateGtin('400638133393A');
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('digits');
        });

        it('should reject empty GTIN', () => {
            const result = validateGtin('');
            expect(result.isValid).toBe(false);
        });

        it('should handle GTIN with spaces', () => {
            const result = validateGtin('4006 3813 3393 1');
            expect(result.isValid).toBe(true);
        });
    });

    describe('extractProductsFromHtml', () => {
        it('should extract products from JSON-LD script', () => {
            const html = `
                <html>
                <head>
                    <script type="application/ld+json">
                    {
                        "@type": "Product",
                        "name": "Test Product",
                        "sku": "TEST-001"
                    }
                    </script>
                </head>
                </html>
            `;
            const products = extractProductsFromHtml(html);
            expect(products).toHaveLength(1);
            expect(products[0].name).toBe('Test Product');
            expect(products[0].sku).toBe('TEST-001');
        });

        it('should extract products from @graph structure', () => {
            const html = `
                <script type="application/ld+json">
                {
                    "@context": "https://schema.org",
                    "@graph": [
                        {"@type": "WebSite", "name": "Store"},
                        {"@type": "Product", "name": "Product 1"},
                        {"@type": "Product", "name": "Product 2"}
                    ]
                }
                </script>
            `;
            const products = extractProductsFromHtml(html);
            expect(products).toHaveLength(2);
            expect(products[0].name).toBe('Product 1');
            expect(products[1].name).toBe('Product 2');
        });

        it('should extract products from ItemList', () => {
            const html = `
                <script type="application/ld+json">
                {
                    "@type": "ItemList",
                    "itemListElement": [
                        {"@type": "ListItem", "item": {"@type": "Product", "name": "Item 1"}},
                        {"@type": "ListItem", "item": {"@type": "Product", "name": "Item 2"}}
                    ]
                }
                </script>
            `;
            const products = extractProductsFromHtml(html);
            expect(products).toHaveLength(2);
        });

        it('should handle multiple JSON-LD scripts', () => {
            const html = `
                <script type="application/ld+json">{"@type": "Product", "name": "P1"}</script>
                <script type="application/ld+json">{"@type": "Product", "name": "P2"}</script>
            `;
            const products = extractProductsFromHtml(html);
            expect(products).toHaveLength(2);
        });

        it('should skip invalid JSON', () => {
            const html = `
                <script type="application/ld+json">{invalid json}</script>
                <script type="application/ld+json">{"@type": "Product", "name": "Valid"}</script>
            `;
            const products = extractProductsFromHtml(html);
            expect(products).toHaveLength(1);
            expect(products[0].name).toBe('Valid');
        });

        it('should return empty array when no products found', () => {
            const html = `<html><body>No products here</body></html>`;
            const products = extractProductsFromHtml(html);
            expect(products).toHaveLength(0);
        });
    });

    describe('analyzeProduct', () => {
        const completeProduct: ProductData = {
            name: 'Complete Product',
            description: 'This is a complete product description with enough characters to pass the minimum length requirement for good SEO.',
            sku: 'SKU-001',
            gtin: '4006381333931',
            brand: { name: 'Test Brand' },
            image: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
            category: 'Electronics',
            offers: {
                '@type': 'Offer',
                price: 99.99,
                priceCurrency: 'USD',
                availability: 'https://schema.org/InStock',
            },
        };

        it('should analyze a complete product with high score', () => {
            const result = analyzeProduct(completeProduct);
            expect(result.score).toBeGreaterThanOrEqual(90);
            expect(result.issues).toHaveLength(0);
            expect(result.attributes.hasName).toBe(true);
            expect(result.attributes.hasDescription).toBe(true);
            expect(result.attributes.hasSku).toBe(true);
            expect(result.attributes.hasGtin).toBe(true);
            expect(result.attributes.hasBrand).toBe(true);
            expect(result.attributes.hasImage).toBe(true);
            expect(result.attributes.hasPrice).toBe(true);
            expect(result.attributes.hasAvailability).toBe(true);
        });

        it('should flag missing name as critical', () => {
            const product: ProductData = { ...completeProduct, name: undefined };
            const result = analyzeProduct(product);
            const nameIssue = result.issues.find(i => i.id === 'missing-name');
            expect(nameIssue).toBeDefined();
            expect(nameIssue?.severity).toBe('critical');
        });

        it('should flag missing description as warning', () => {
            const product: ProductData = { ...completeProduct, description: undefined };
            const result = analyzeProduct(product);
            const descIssue = result.issues.find(i => i.id === 'missing-description');
            expect(descIssue).toBeDefined();
            expect(descIssue?.severity).toBe('warning');
        });

        it('should flag short description', () => {
            const product: ProductData = { ...completeProduct, description: 'Short desc' };
            const result = analyzeProduct(product);
            const shortIssue = result.issues.find(i => i.id === 'short-description');
            expect(shortIssue).toBeDefined();
            expect(shortIssue?.severity).toBe('info');
        });

        it('should flag missing price as critical', () => {
            const product: ProductData = { ...completeProduct, offers: undefined };
            const result = analyzeProduct(product);
            const priceIssue = result.issues.find(i => i.id === 'missing-price');
            expect(priceIssue).toBeDefined();
            expect(priceIssue?.severity).toBe('critical');
        });

        it('should flag missing image as critical', () => {
            const product: ProductData = { ...completeProduct, image: undefined };
            const result = analyzeProduct(product);
            const imageIssue = result.issues.find(i => i.id === 'missing-image');
            expect(imageIssue).toBeDefined();
            expect(imageIssue?.severity).toBe('critical');
        });

        it('should flag single image as info', () => {
            const product: ProductData = { ...completeProduct, image: 'single.jpg' };
            const result = analyzeProduct(product);
            const singleImageIssue = result.issues.find(i => i.id === 'single-image');
            expect(singleImageIssue).toBeDefined();
            expect(singleImageIssue?.severity).toBe('info');
        });

        it('should flag invalid GTIN', () => {
            const product: ProductData = { ...completeProduct, gtin: '1234567890' };
            const result = analyzeProduct(product);
            const gtinIssue = result.issues.find(i => i.id === 'invalid-gtin');
            expect(gtinIssue).toBeDefined();
            expect(gtinIssue?.severity).toBe('critical');
        });

        it('should flag missing availability', () => {
            const product: ProductData = {
                ...completeProduct,
                offers: { price: 99.99, priceCurrency: 'USD' },
            };
            const result = analyzeProduct(product);
            const availIssue = result.issues.find(i => i.id === 'missing-availability');
            expect(availIssue).toBeDefined();
        });

        it('should flag invalid availability value', () => {
            const product: ProductData = {
                ...completeProduct,
                offers: {
                    price: 99.99,
                    priceCurrency: 'USD',
                    availability: 'available',
                },
            };
            const result = analyzeProduct(product);
            const availIssue = result.issues.find(i => i.id === 'invalid-availability');
            expect(availIssue).toBeDefined();
        });

        it('should handle string brand', () => {
            const product: ProductData = { ...completeProduct, brand: 'String Brand' };
            const result = analyzeProduct(product);
            expect(result.attributes.hasBrand).toBe(true);
        });

        it('should handle price as string', () => {
            const product: ProductData = {
                ...completeProduct,
                offers: { price: '99.99', priceCurrency: 'USD', availability: 'InStock' },
            };
            const result = analyzeProduct(product);
            expect(result.attributes.hasPrice).toBe(true);
        });

        it('should flag invalid price format', () => {
            const product: ProductData = {
                ...completeProduct,
                offers: { price: 'free', priceCurrency: 'USD' },
            };
            const result = analyzeProduct(product);
            const priceIssue = result.issues.find(i => i.id === 'invalid-price');
            expect(priceIssue).toBeDefined();
        });
    });

    describe('analyzeProductFeed', () => {
        const products: ProductData[] = [
            {
                name: 'Product 1',
                description: 'A great product with a detailed description that provides all necessary information.',
                sku: 'P1',
                gtin: '4006381333931',
                brand: 'Brand A',
                image: ['img1.jpg', 'img2.jpg'],
                offers: { price: 50, priceCurrency: 'USD', availability: 'InStock' },
                category: 'Category A',
            },
            {
                name: 'Product 2',
                description: 'Another product',
                sku: 'P2',
                image: 'img.jpg',
                offers: { price: 30, priceCurrency: 'USD' },
            },
            {
                name: 'Product 3',
                offers: { price: 20 },
            },
        ];

        it('should analyze multiple products', () => {
            const result = analyzeProductFeed(products, 'https://example.com');
            expect(result.productsFound).toBe(3);
            expect(result.productsAnalyzed).toBe(3);
            expect(result.products).toHaveLength(3);
        });

        it('should calculate overall score', () => {
            const result = analyzeProductFeed(products, 'https://example.com');
            expect(result.overallScore).toBeGreaterThan(0);
            expect(result.overallScore).toBeLessThanOrEqual(100);
        });

        it('should calculate agent visibility score', () => {
            const result = analyzeProductFeed(products, 'https://example.com');
            expect(result.agentVisibilityScore).toBeGreaterThan(0);
            expect(result.agentVisibilityScore).toBeLessThanOrEqual(100);
        });

        it('should assign appropriate grade', () => {
            const result = analyzeProductFeed(products, 'https://example.com');
            expect(['A', 'B', 'C', 'D', 'F']).toContain(result.grade);
        });

        it('should calculate category scores', () => {
            const result = analyzeProductFeed(products, 'https://example.com');
            expect(result.categoryScores).toBeDefined();
            expect(result.categoryScores.completeness).toBeGreaterThanOrEqual(0);
            expect(result.categoryScores.pricing).toBeGreaterThanOrEqual(0);
            expect(result.categoryScores.images).toBeGreaterThanOrEqual(0);
        });

        it('should aggregate issues across products', () => {
            const result = analyzeProductFeed(products, 'https://example.com');
            expect(result.issues.length).toBeGreaterThan(0);
        });

        it('should identify top issues', () => {
            const result = analyzeProductFeed(products, 'https://example.com');
            expect(result.topIssues).toBeDefined();
            // Top issues should be critical or warning severity
            result.topIssues.forEach(issue => {
                expect(['critical', 'warning']).toContain(issue.severity);
            });
        });

        it('should generate recommendations', () => {
            const result = analyzeProductFeed(products, 'https://example.com');
            expect(result.recommendations.length).toBeGreaterThan(0);
            // Recommendations should have required fields
            result.recommendations.forEach(rec => {
                expect(rec.priority).toBeDefined();
                expect(rec.title).toBeDefined();
                expect(rec.description).toBeDefined();
                expect(rec.affectedCount).toBeGreaterThan(0);
            });
        });

        it('should calculate summary statistics', () => {
            const result = analyzeProductFeed(products, 'https://example.com');
            expect(result.summary.totalProducts).toBe(3);
            expect(result.summary.withName).toBe(3);
            expect(result.summary.withPrice).toBe(3);
            expect(result.summary.withImages).toBe(2); // Product 3 has no image
            expect(result.summary.withGtin).toBe(1);
        });

        it('should respect maxProducts limit', () => {
            const result = analyzeProductFeed(products, 'https://example.com', 2);
            expect(result.productsFound).toBe(3);
            expect(result.productsAnalyzed).toBe(2);
            expect(result.products).toHaveLength(2);
        });

        it('should exclude product details when requested', () => {
            const result = analyzeProductFeed(products, 'https://example.com', 50, false);
            expect(result.products).toHaveLength(0);
        });

        it('should handle empty product array', () => {
            const result = analyzeProductFeed([], 'https://example.com');
            expect(result.productsFound).toBe(0);
            expect(result.productsAnalyzed).toBe(0);
            expect(result.overallScore).toBe(0);
            expect(result.grade).toBe('F');
        });

        it('should include analyzed URL', () => {
            const result = analyzeProductFeed(products, 'https://example.com/products');
            expect(result.url).toBe('https://example.com/products');
        });

        it('should include timestamp', () => {
            const result = analyzeProductFeed(products, 'https://example.com');
            expect(result.analyzedAt).toBeDefined();
            expect(new Date(result.analyzedAt).getTime()).not.toBeNaN();
        });
    });

    describe('analyzeProductFeedFromHtml', () => {
        it('should analyze products extracted from HTML', () => {
            const html = `
                <script type="application/ld+json">
                {"@type": "Product", "name": "HTML Product", "offers": {"price": 10}}
                </script>
            `;
            const result = analyzeProductFeedFromHtml(html, 'https://example.com');
            expect(result.productsFound).toBe(1);
            expect(result.products[0].name).toBe('HTML Product');
        });

        it('should pass options through', () => {
            const html = `
                <script type="application/ld+json">{"@type": "Product", "name": "P1"}</script>
                <script type="application/ld+json">{"@type": "Product", "name": "P2"}</script>
                <script type="application/ld+json">{"@type": "Product", "name": "P3"}</script>
            `;
            const result = analyzeProductFeedFromHtml(html, 'https://example.com', {
                maxProducts: 2,
                includeProductDetails: false,
            });
            expect(result.productsAnalyzed).toBe(2);
            expect(result.products).toHaveLength(0);
        });
    });

    describe('Constants', () => {
        it('should have quality check definitions', () => {
            expect(QUALITY_CHECKS['missing-name']).toBeDefined();
            expect(QUALITY_CHECKS['missing-price']).toBeDefined();
            expect(QUALITY_CHECKS['missing-image']).toBeDefined();
            expect(QUALITY_CHECKS['invalid-gtin']).toBeDefined();
        });

        it('should have valid availability values', () => {
            expect(VALID_AVAILABILITY_VALUES).toContain('InStock');
            expect(VALID_AVAILABILITY_VALUES).toContain('https://schema.org/InStock');
            expect(VALID_AVAILABILITY_VALUES).toContain('OutOfStock');
        });

        it('should have category weights summing to 100', () => {
            const totalWeight = Object.values(CATEGORY_WEIGHTS).reduce((a, b) => a + b, 0);
            expect(totalWeight).toBe(100);
        });

        it('should have grade thresholds in descending order', () => {
            expect(GRADE_THRESHOLDS.A).toBeGreaterThan(GRADE_THRESHOLDS.B);
            expect(GRADE_THRESHOLDS.B).toBeGreaterThan(GRADE_THRESHOLDS.C);
            expect(GRADE_THRESHOLDS.C).toBeGreaterThan(GRADE_THRESHOLDS.D);
            expect(GRADE_THRESHOLDS.D).toBeGreaterThan(GRADE_THRESHOLDS.F);
        });
    });

    describe('Edge cases', () => {
        it('should handle product with array of offers', () => {
            const product: ProductData = {
                name: 'Multi-offer Product',
                offers: [
                    { price: 100, priceCurrency: 'USD' },
                    { price: 90, priceCurrency: 'EUR' },
                ],
            };
            const result = analyzeProduct(product);
            expect(result.attributes.hasPrice).toBe(true);
        });

        it('should handle product with zero price', () => {
            const product: ProductData = {
                name: 'Free Product',
                offers: { price: 0, priceCurrency: 'USD' },
            };
            const result = analyzeProduct(product);
            expect(result.attributes.hasPrice).toBe(true);
            const priceIssue = result.issues.find(i => i.id === 'missing-price');
            expect(priceIssue).toBeUndefined();
        });

        it('should handle product with image object array', () => {
            const product: ProductData = {
                name: 'Product with Image Objects',
                offers: { price: 10 },
                image: [{ url: 'img1.jpg' }, { url: 'img2.jpg' }],
            };
            const result = analyzeProduct(product);
            expect(result.attributes.hasImage).toBe(true);
            expect(result.attributes.imageCount).toBe(2);
        });

        it('should count description length correctly', () => {
            const description = 'A'.repeat(100);
            const product: ProductData = {
                name: 'Product',
                description,
                offers: { price: 10 },
            };
            const result = analyzeProduct(product);
            expect(result.attributes.descriptionLength).toBe(100);
        });
    });
});
