# UCP.tools Brand Style Guide

Comprehensive brand guidelines based on the official logo.

---

## 1. LOGO

### Primary Logo
- File: `public/logo.jpeg`
- Usage: App icons, favicons, social media avatars
- Concept: Shopping bag with checkmark = "validated commerce"

### Logo Variations
| Variant | Use Case |
|---------|----------|
| Full color | Primary use, light backgrounds |
| White | Dark backgrounds, overlays |
| Monochrome | Print, low-color contexts |

### Clear Space
Maintain padding equal to the height of the bag handle on all sides.

### Minimum Size
- Digital: 32x32px minimum
- Print: 0.5 inch minimum

---

## 2. COLOR PALETTE

### Primary Colors (from logo gradient)

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Blue** | `#2E86AB` | rgb(46, 134, 171) | Primary actions, links |
| **Teal** | `#36B5A2` | rgb(54, 181, 162) | Gradient midpoint, accents |
| **Green** | `#47C97A` | rgb(71, 201, 122) | Success states, validation |

### Brand Gradient
```css
background: linear-gradient(135deg, #2E86AB 0%, #36B5A2 50%, #47C97A 100%);
```

### Secondary Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Dark** | `#1A2B3C` | Text, headings |
| **Medium** | `#5A6978` | Secondary text |
| **Light** | `#94A3B8` | Muted text, placeholders |
| **Border** | `#E2E8F0` | Dividers, borders |
| **Background** | `#F8FAFC` | Page background |
| **Card** | `#FFFFFF` | Card backgrounds |

### Semantic Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Success** | `#47C97A` | Valid, success states |
| **Warning** | `#F59E0B` | Warnings, caution |
| **Error** | `#EF4444` | Errors, invalid states |
| **Info** | `#2E86AB` | Information, tips |

### Grade Colors

| Grade | Background | Text |
|-------|------------|------|
| A | `#DCFCE7` | `#16A34A` |
| B | `#DBEAFE` | `#2563EB` |
| C | `#FEF9C3` | `#CA8A04` |
| D | `#FED7AA` | `#EA580C` |
| F | `#FEE2E2` | `#DC2626` |

---

## 3. TYPOGRAPHY

### Font Stack
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### Type Scale

| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| H1 | 48px / 3rem | 700 | 1.2 |
| H2 | 36px / 2.25rem | 700 | 1.25 |
| H3 | 24px / 1.5rem | 600 | 1.3 |
| H4 | 20px / 1.25rem | 600 | 1.4 |
| Body | 16px / 1rem | 400 | 1.6 |
| Small | 14px / 0.875rem | 400 | 1.5 |
| Caption | 12px / 0.75rem | 500 | 1.4 |

### Logo Typography
```css
.logo {
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(135deg, #2E86AB, #47C97A);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.logo .suffix {
  font-weight: 400;
  color: #5A6978;
}
```

---

## 4. SPACING

### Base Unit
8px grid system

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Tight spacing |
| `--space-2` | 8px | Default gap |
| `--space-3` | 12px | Small padding |
| `--space-4` | 16px | Medium padding |
| `--space-5` | 20px | Form groups |
| `--space-6` | 24px | Section gaps |
| `--space-8` | 32px | Card padding |
| `--space-10` | 40px | Section padding |
| `--space-12` | 48px | Large sections |
| `--space-16` | 64px | Hero sections |

---

## 5. BORDER RADIUS

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 4px | Small elements, badges |
| `--radius-md` | 8px | Buttons, inputs |
| `--radius-lg` | 12px | Cards |
| `--radius-xl` | 16px | Modals |
| `--radius-full` | 9999px | Pills, avatars |

---

## 6. SHADOWS

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
```

---

## 7. COMPONENTS

### Buttons

#### Primary Button
```css
.btn-primary {
  background: linear-gradient(135deg, #2E86AB, #36B5A2);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}
.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(46, 134, 171, 0.4);
}
```

#### Secondary Button
```css
.btn-secondary {
  background: white;
  color: #1A2B3C;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  border: 2px solid #E2E8F0;
  cursor: pointer;
}
.btn-secondary:hover {
  border-color: #2E86AB;
  color: #2E86AB;
}
```

### Cards
```css
.card {
  background: white;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #E2E8F0;
}
```

### Input Fields
```css
input, select, textarea {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
input:focus {
  outline: none;
  border-color: #2E86AB;
  box-shadow: 0 0 0 3px rgba(46, 134, 171, 0.1);
}
```

### Grade Badges
```css
.grade-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 700;
  font-size: 18px;
}
```

---

## 8. ICONOGRAPHY

### Style Guidelines
- Line weight: 2px stroke
- Corner radius: Rounded caps and joins
- Size: 24x24px default, 20x20px small, 32x32px large

### Common Icons
| Icon | Usage |
|------|-------|
| Checkmark | Success, valid, complete |
| X/Cross | Error, invalid, close |
| Warning triangle | Warnings, caution |
| Info circle | Information, tips |
| Shopping bag | Commerce, UCP |
| Shield | Security, validation |

---

## 9. MOTION

### Transitions
```css
--transition-fast: 150ms ease;
--transition-base: 200ms ease;
--transition-slow: 300ms ease;
```

### Hover Effects
- Buttons: `translateY(-1px)` + shadow increase
- Cards: `translateY(-2px)` + shadow increase
- Links: Color change only

---

## 10. RESPONSIVE BREAKPOINTS

| Name | Width | Usage |
|------|-------|-------|
| Mobile | < 640px | Single column |
| Tablet | 640-1024px | Two columns |
| Desktop | > 1024px | Full layout |

---

## 11. VOICE & TONE

### Brand Voice
- **Developer-first**: Technical but accessible
- **Direct**: Clear, no fluff
- **Helpful**: Solution-oriented
- **Independent**: Not affiliated with Google/Shopify

### Writing Guidelines
- Use active voice
- Lead with benefits
- Include code examples
- Avoid jargon unless necessary

### Example Copy

**Headlines:**
- "Get ready for AI commerce"
- "Validate your UCP profile"
- "Check your AI commerce readiness"

**CTAs:**
- "Validate Now"
- "Generate Profile"
- "Get Started"

---

## 12. FILE ASSETS

### Required Files
```
public/
├── logo.jpeg           # Primary logo (square)
├── logo-white.png      # White version for dark bg
├── favicon.ico         # Browser favicon
├── favicon-32x32.png   # 32px favicon
├── favicon-16x16.png   # 16px favicon
├── apple-touch-icon.png # 180x180 iOS icon
├── og-image.png        # 1200x630 social share
└── brand.css           # CSS design tokens
```

---

## 13. CSS DESIGN TOKENS

See `public/brand.css` for the complete implementation of all design tokens as CSS custom properties.

---

## 14. USAGE EXAMPLES

### Hero Section
```html
<section class="hero">
  <h1>UCP Profile <span class="gradient-text">Validator</span></h1>
  <p>Check if your store is ready for AI shopping agents</p>
  <button class="btn-primary">Validate Now</button>
</section>
```

### Gradient Text
```css
.gradient-text {
  background: linear-gradient(135deg, #2E86AB, #47C97A);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

---

*Last updated: January 2026*
