# CampusCraves — Design System

**Version:** 1.0
**Scope:** `frontend/` (Vite + React 18 + Tailwind CSS 3)
**Theme:** Light only
**Status:** Normative. New UI must follow this document. Existing UI migrates toward it (see [§22](#22-migration-from-the-current-codebase)).

---

## 0. How to use this document

This is an implementation contract, not a mood board. Every rule below maps to a Tailwind class, a token, or a component API you can copy.

**Three rules that override everything else:**

1. **Use a token, never a raw value.** No `rounded-[28px]`, no `shadow-[0_15px_40px_rgba(0,0,0,0.08)]`, no `#2563EB` in JSX. If a token is missing, add it to `tailwind.config.js` — don't inline it.
2. **Mobile is the default.** Write the phone layout first with unprefixed classes; add `sm:` / `lg:` to grow it. Never write a desktop layout and shrink it.
3. **Restraint over decoration.** The product sells trust and speed, not visual novelty. When in doubt: flat white surface, one hairline border, one accent color, no gradient.

### Current stack (audited)

| Concern | Library | Notes |
| --- | --- | --- |
| Framework | React 18, JSX (not TypeScript) | `frontend/src` |
| Build | Vite 6 | |
| Styling | Tailwind CSS 3.3.6 | `frontend/tailwind.config.js` |
| Icons | `lucide-react` | Only icon library. Do not add another. |
| Motion | `framer-motion` 10 | Used in 30 files |
| Charts | `recharts` 3 | Admin analytics only |
| Toasts | `react-hot-toast` | Migrating to shadcn `sonner` — see §20 |
| Dialogs | `sweetalert2` | **Deprecated** — migrating to shadcn `alert-dialog` |
| Realtime | `socket.io-client` | Drives status / live UI states |
| shadcn/ui | **not yet installed** | Adoption plan in §20 |

---

## 1. Brand identity

### 1.1 What CampusCraves is

A canteen ordering product for a closed campus community. The student uses it three times a day, on a phone, in a queue, often on poor Wi-Fi. The canteen admin uses it all day on a laptop behind a counter.

That produces four design values, in priority order:

1. **Fast to read** — a student decides in under two seconds whether an item is available and what it costs.
2. **Trustworthy** — money, order tokens and live status must look like a payments product, not a hackathon demo.
3. **Calm** — the interface never competes with the food photography or the order status.
4. **Familiar** — Zomato/Swiggy interaction patterns (category chips, quantity steppers, sticky cart bar, status timeline) because the audience already knows them.

### 1.2 Name and wordmark

- Written **CampusCraves** — one word, two capitals. Never "Campus Craves", "campuscraves" or "CC" in UI copy.
- The wordmark lockup in text renders as `Campus` in `text-slate-900` + `Craves` in `text-primary`. One implementation only:

```jsx
export const Wordmark = ({ className = "" }) => (
  <span className={`font-bold tracking-tight ${className}`}>
    Campus<span className="text-primary">Craves</span>
  </span>
);
```

- The admin panel appends a separate eyebrow, never a differently-styled wordmark:
  `<Wordmark className="text-xl" />` + `<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin</span>`
- The logo mark (`src/assets/CampusCraves-Logo.png`) is used for: the app loader, auth screens, the sidebar header, and as the image fallback for menu items with no photo. Nowhere else.
- Clear space around the logo ≥ half its height. Minimum rendered width 32px.

### 1.3 Voice

- Short, factual, second person. "Your order is being prepared." not "We're cooking up something delicious for you!"
- Currency is always `₹` with no space: `₹120`. Format through `utils/formatPrice` — never hand-roll `toFixed` in a component.
- Order identifiers are **tokens**, always shown as `Token 042` (zero-padded, `tabular-nums`).
- One emoji maximum per screen, and only in celebratory terminal states (order collected). Never in labels, buttons, headings, table headers or admin UI.

---

## 2. Color system

### 2.1 Principles

- **One accent.** Blue is the only brand color. Everything else is neutral or semantic (status / feedback).
- **Color is never the only signal.** Every status carries an icon or text label alongside its color.
- **No decorative gradients.** Blue→cyan and blue→indigo gradients on buttons, sidebars, chips and active states are removed. Gradients are permitted in exactly two places: the auth split-screen hero panel, and recharts area fills at ≤12% opacity.

### 2.2 Tokens

Define once as CSS variables in `src/index.css`, consume through Tailwind semantic names.

```css
:root {
  /* Brand */
  --cc-primary:        #3B82F6;  /* brand blue — identity, focus rings, accents */
  --cc-primary-strong: #2563EB;  /* filled actions, links, small text on blue */
  --cc-primary-press:  #1D4ED8;  /* :active */
  --cc-primary-soft:   #EFF6FF;  /* tinted backgrounds */
  --cc-primary-border: #BFDBFE;  /* tinted borders */

  /* Surface */
  --cc-bg:             #F8FAFC;  /* app canvas */
  --cc-surface:        #FFFFFF;  /* cards, sheets, bars */
  --cc-surface-muted:  #F1F5F9;  /* inset rows, skeletons, disabled fills */
  --cc-border:         #E2E8F0;  /* default hairline */
  --cc-border-strong:  #CBD5E1;  /* hover / emphasis hairline */

  /* Text */
  --cc-text:           #0F172A;  /* headings, prices */
  --cc-text-body:      #334155;  /* body copy */
  --cc-text-muted:     #64748B;  /* secondary, timestamps, captions */
  --cc-text-disabled:  #94A3B8;  /* disabled labels only — never live text */

  /* Semantic */
  --cc-success:        #059669;
  --cc-warning:        #B45309;
  --cc-danger:         #DC2626;
  --cc-info:           #0284C7;
}
```

```js
// tailwind.config.js — theme.extend.colors
colors: {
  primary: {
    DEFAULT: 'var(--cc-primary)',
    strong:  'var(--cc-primary-strong)',
    press:   'var(--cc-primary-press)',
    soft:    'var(--cc-primary-soft)',
    border:  'var(--cc-primary-border)',
  },
  surface: {
    DEFAULT: 'var(--cc-surface)',
    muted:   'var(--cc-surface-muted)',
    canvas:  'var(--cc-bg)',
  },
}
```

Neutrals use Tailwind's **`slate`** scale directly. `gray`, `zinc` and `neutral` are forbidden — the codebase currently mixes `gray-*` and `slate-*`, which produces visibly different hairlines side by side.

### 2.3 The `#3B82F6` contrast rule (important)

White text on `#3B82F6` measures **3.68:1** — it passes AA for large text (≥18.66px bold / ≥24px) and for UI component boundaries, but **fails AA for normal-size text (needs 4.5:1)**.

Therefore:

| Use | Color | Contrast |
| --- | --- | --- |
| Filled buttons, any label < 18px | `primary-strong` `#2563EB` | 5.17:1 ✅ |
| Links and inline text on white | `primary-strong` `#2563EB` | 5.17:1 ✅ |
| Brand identity, focus ring, active indicator, chart series, icon accents | `primary` `#3B82F6` | 3.68:1 — non-text only ✅ |
| Large display text on blue (≥24px bold) | `primary` `#3B82F6` | ✅ |

Never put 12–16px white text on `#3B82F6`. This is the most common accessibility mistake in the current code (the "Add" buttons on `FoodCard`, the quantity stepper, the admin avatar).

### 2.4 Text color usage

| Token | Hex | On white | Use |
| --- | --- | --- | --- |
| `text-slate-900` | `#0F172A` | 17.9:1 | Headings, prices, item names |
| `text-slate-700` | `#334155` | 10.4:1 | Body copy, form labels |
| `text-slate-500` | `#64748B` | 4.8:1 | Descriptions, timestamps, captions, helper text |
| `text-slate-400` | `#94A3B8` | **2.5:1 — fails** | Disabled labels and purely decorative icons **only** |

`text-slate-400` / `text-gray-400` must not carry meaning. Timestamps, hints and empty-state copy currently using it move to `text-slate-500`.

### 2.5 Status palette

One source of truth. Create `src/utils/statusStyles.js` and import it everywhere — the current definitions in `index.css` (`.status-*`) and `AdminOrders.jsx` (`STATUS_STYLES`) have already drifted apart.

| Status (internal) | Student label | Chip classes | Icon |
| --- | --- | --- | --- |
| `pending`, `accepted` | Order Placed | `bg-amber-50 text-amber-700 ring-amber-200` | `Receipt` |
| `preparing` | Preparing | `bg-violet-50 text-violet-700 ring-violet-200` | `ChefHat` |
| `ready` | Ready for Pickup | `bg-emerald-50 text-emerald-700 ring-emerald-200` | `PackageCheck` |
| `completed` | Completed | `bg-slate-100 text-slate-600 ring-slate-200` | `CheckCircle2` |
| `cancelled`, `rejected` | Cancelled | `bg-rose-50 text-rose-700 ring-rose-200` | `XCircle` |
| `refunded` | Refund Initiated | `bg-sky-50 text-sky-700 ring-sky-200` | `RotateCcw` |

Payment status: `PAID` → emerald, `PENDING` → amber, `FAILED` → rose, same chip recipe.

`completed` is deliberately neutral, not green: it is a settled, archival state. `ready` is the only status that earns a saturated color and the only one permitted a live pulse indicator, because it is the one the student is waiting for.

All status text uses the `-700` step on a `-50`/`-100` fill — every pair above clears 4.5:1.

### 2.6 Availability and destructive color

- Out of stock: grayscale the image (`grayscale opacity-60`), `bg-rose-600 text-white` badge, disabled action. Never rely on the badge alone.
- Destructive actions: `text-rose-600`, filled variant `bg-rose-600 hover:bg-rose-700`. Rose, not `red-500` — `red-500` on white fails contrast for small text.

---

## 3. Typography

### 3.1 Family

**Inter only.** One family, loaded once.

`tailwind.config.js` currently declares a `display: ['Poppins', …]` family that is never loaded — remove it, along with the `font-display` utility and the Poppins entry in `sans`.

```js
fontFamily: {
  sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
}
```

Load Inter with `display=swap` and only the weights used: **400, 500, 600, 700**. `font-extrabold` and `font-black` are forbidden — consolidate every existing use to `font-bold`.

### 3.2 Scale

Mobile value first, desktop after `sm:`/`lg:`. Nothing below 12px, ever.

| Role | Classes | Use |
| --- | --- | --- |
| Display | `text-2xl sm:text-3xl font-bold tracking-tight text-slate-900` | Auth headline, empty-state headline |
| H1 / page title | `text-xl sm:text-2xl font-bold tracking-tight text-slate-900` | "Dashboard", "Your orders" |
| H2 / section | `text-lg font-semibold text-slate-900` | Card headers, "Order summary" |
| H3 / card title | `text-base font-semibold text-slate-900` | Food item name, order row title |
| Body | `text-sm sm:text-base text-slate-700` | Paragraphs |
| Body muted | `text-sm text-slate-500` | Item description, helper text |
| Label | `text-sm font-medium text-slate-700` | Form labels |
| Caption | `text-xs text-slate-500` | Timestamps, chart axes, metadata |
| Price | `text-lg font-bold text-slate-900 tabular-nums` | Item price |
| Price (total) | `text-2xl font-bold text-primary-strong tabular-nums` | Cart / checkout grand total |
| Metric | `text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums` | Admin stat cards |

### 3.3 Line length and leading

- Body/paragraph blocks: `max-w-prose` or `max-w-[60ch]`. Empty-state copy: `max-w-md mx-auto`.
- Headings `leading-tight`; body `leading-relaxed`; dense table cells `leading-snug`.
- Truncation: item names `line-clamp-1`, descriptions `line-clamp-2`. Always clamp — never let a long canteen item name reflow a grid.

### 3.4 Numbers

Every number that can change or sits in a column gets `tabular-nums`: prices, totals, token numbers, counts, chart axis labels, table cells. This is non-negotiable in the cart, the admin queue and analytics, where jittering digits read as unreliable.

---

## 4. Spacing

### 4.1 Scale

4px base. Use only: `0 · 1 (4) · 2 (8) · 3 (12) · 4 (16) · 5 (20) · 6 (24) · 8 (32) · 10 (40) · 12 (48) · 16 (64) · 20 (80)`.

`7`, `9`, `11`, `14` and any arbitrary `p-[13px]` are not part of the system.

### 4.2 Applied rules

| Context | Mobile | ≥ sm | ≥ lg |
| --- | --- | --- | --- |
| Page gutter | `px-4` | `px-6` | `px-8` |
| Page vertical | `py-5` | `py-6` | `py-8` |
| Card padding | `p-4` | `p-5` | `p-6` |
| Compact card (list row) | `p-3` | `p-4` | `p-4` |
| Grid / list gap | `gap-3` | `gap-4` | `gap-6` |
| Section separation | `mt-6` | `mt-8` | `mt-10` |
| Stacked form fields | `space-y-4` | `space-y-5` | `space-y-5` |
| Icon ↔ label | `gap-2` | | |
| Inline chips | `gap-2` | `gap-3` | |

### 4.3 Structural spacing

- **Bottom nav clearance:** any page rendering `MobileBottomNav` must pad its scroll container `pb-24` so the last row is never trapped under the bar. Add `pb-[env(safe-area-inset-bottom)]` to the bar itself.
- **Sticky checkout bar clearance:** `pb-28` on cart pages.
- **Content max width:** student pages `max-w-7xl mx-auto`; forms and auth `max-w-md`; reading/settings panes `max-w-2xl`.
- Prefer `gap` on a flex/grid parent over margins on children. Never `space-y-*` and `gap-*` on the same element.

---

## 5. Border radius

The codebase currently uses 15 distinct radii including twelve arbitrary pixel values. The system has **five**.

| Token | Value | Use |
| --- | --- | --- |
| `rounded-sm` | 4px | Progress bars, chart marks, table-cell chips |
| `rounded-lg` | 8px | Dense admin inputs, small/compact buttons, skeleton lines |
| `rounded-xl` | 12px | Inputs, dropdowns, popovers, toasts, list rows, icon tiles |
| `rounded-2xl` | 16px | **Default card radius.** Food cards, stat cards, panels |
| `rounded-3xl` | 24px | Page-level shells, modals, bottom sheets, hero panels |
| `rounded-full` | — | Avatars, status chips, category chips, icon buttons, quantity steppers |

**Mapping from existing arbitrary values:**

`[16px] [18px] → rounded-xl` · `[22px] [24px] → rounded-2xl` · `[28px] [30px] [32px] [34px] [35px] [36px] → rounded-3xl`

Rules:

- Nested radius: inner = outer − padding. A `rounded-3xl` (24px) panel with `p-4` (16px) holds `rounded-lg` (8px) children. Never nest equal radii.
- A full-bleed image at the top of a card inherits the card's radius via `overflow-hidden` on the card — do not re-round the `<img>`.
- Pills (`rounded-full`) are for things that are *selected* or *counted*: chips, badges, steppers, avatars. Primary form actions are `rounded-xl`, not pills.

---

## 6. Shadows

### 6.1 Tokens

Neutral slate-tinted, never black, never colored.

```js
// tailwind.config.js — theme.extend.boxShadow
boxShadow: {
  xs:  '0 1px 2px 0 rgba(15, 23, 42, 0.04)',
  sm:  '0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04)',
  md:  '0 4px 12px -2px rgba(15, 23, 42, 0.08)',
  lg:  '0 8px 24px -4px rgba(15, 23, 42, 0.10)',
  xl:  '0 24px 48px -12px rgba(15, 23, 42, 0.18)',
  bar: '0 -4px 16px -4px rgba(15, 23, 42, 0.08)',
}
```

### 6.2 Elevation map

| Layer | Shadow | Border |
| --- | --- | --- |
| Flat card at rest | `shadow-xs` | `border border-slate-200` |
| Interactive card at rest | `shadow-sm` | `border border-slate-200` |
| Interactive card hover | `shadow-md` | `border-slate-300` |
| Dropdown / popover / tooltip | `shadow-lg` | `border border-slate-200` |
| Modal / dialog | `shadow-xl` | none |
| Sticky bottom bar / bottom nav | `shadow-bar` | `border-t border-slate-200` |
| Sticky top header | `shadow-sm` on scroll only | `border-b border-slate-200` |

### 6.3 Prohibited

- **Colored glows.** `shadow-blue-500/30`, `/25`, `/40` are removed from every button, chip and sidebar item. Elevation is a light model, not a brand expression.
- `shadow-2xl` on anything that isn't a modal.
- Shadow *and* a strong border on the same element beyond the table above — pick one to carry the edge.
- Arbitrary `shadow-[…]` values.

Every surface must have a defined edge: a hairline border, a shadow, or background contrast against the canvas. A white card on a white background with neither is a bug.

---

## 7. Buttons

### 7.1 Variants

| Variant | Resting | Hover | Active | Use |
| --- | --- | --- | --- | --- |
| **Primary** | `bg-primary-strong text-white` | `bg-[#1D4ED8]` | `bg-primary-press` | One per view. Place order, Sign in, Save |
| **Secondary** | `bg-white text-slate-700 border border-slate-200` | `bg-slate-50 border-slate-300` | `bg-slate-100` | Cancel, Back, filters |
| **Soft** | `bg-primary-soft text-primary-strong` | `bg-blue-100` | `bg-blue-200` | Repeat order, secondary in-card actions |
| **Ghost** | `text-slate-600` | `bg-slate-100 text-slate-900` | `bg-slate-200` | Icon buttons, toolbars, table row actions |
| **Destructive** | `bg-rose-600 text-white` | `bg-rose-700` | `bg-rose-800` | Delete, Cancel order, Logout confirm |
| **Destructive ghost** | `text-rose-600` | `bg-rose-50` | `bg-rose-100` | Remove item, sidebar logout |

Gradient-filled buttons are removed. Every current `bg-gradient-to-r from-blue-600 to-cyan-500` button becomes **Primary**.

### 7.2 Sizes

| Size | Height | Padding | Text | Radius | Use |
| --- | --- | --- | --- | --- | --- |
| `sm` | `h-9` | `px-3` | `text-sm font-medium` | `rounded-lg` | Table rows, filter bars, dense admin |
| `md` (default) | `h-11` | `px-4` | `text-sm font-semibold` | `rounded-xl` | Everywhere |
| `lg` | `h-12` | `px-6` | `text-base font-semibold` | `rounded-xl` | Primary page action, checkout, auth submit |
| `icon` | `h-10 w-10` | — | — | `rounded-full` | Icon-only |
| `pill` | `h-9` / `h-10` | `px-4` | `text-sm font-semibold` | `rounded-full` | Menu "Add", category chips |

Minimum tap target on touch is **44×44px**. `h-9` buttons are desktop/admin only; on mobile use `h-11` or wrap a smaller visual in a 44px hit area.

### 7.3 States

```
base:     inline-flex items-center justify-center gap-2 font-semibold
          transition-colors duration-150 select-none
focus:    focus-visible:outline-none focus-visible:ring-2
          focus-visible:ring-primary focus-visible:ring-offset-2
active:   active:scale-[0.98]        /* the only scale transform allowed */
disabled: disabled:opacity-50 disabled:pointer-events-none
loading:  aria-busy + <Loader2 className="size-4 animate-spin" />, label stays,
          width must not change
```

- **Focus is mandatory.** Zero files currently use `focus-visible`. Any interactive element that sets `outline-none` without a `focus-visible:ring` is a defect.
- `hover:scale-105` on buttons is removed — hover changes color, press changes scale.
- Loading buttons keep their label and set `disabled`; never swap the label for a bare spinner (the width jump moves the whole layout).

### 7.4 Icons in buttons

`size-4` (16px) for `sm`/`md`, `size-5` (20px) for `lg`. Always `aria-hidden="true"`. Icon-only buttons require `aria-label`.

---

## 8. Forms and inputs

### 8.1 Anatomy

Label above, input, then helper **or** error (never both). Error replaces helper in place — no layout shift.

```jsx
<div className="space-y-1.5">
  <label htmlFor="email" className="block text-sm font-medium text-slate-700">
    Email address
  </label>

  <div className="relative">
    <Mail
      aria-hidden="true"
      className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-slate-400"
    />
    <input
      id="email"
      type="email"
      autoComplete="email"
      aria-invalid={!!error || undefined}
      aria-describedby={error ? "email-error" : undefined}
      className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4
                 text-sm text-slate-900 placeholder:text-slate-400 transition-colors
                 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20
                 disabled:bg-slate-50 disabled:text-slate-400
                 aria-[invalid=true]:border-rose-400
                 aria-[invalid=true]:focus:border-rose-500
                 aria-[invalid=true]:focus:ring-rose-200"
    />
  </div>

  <FieldError id="email-error" message={error} />
</div>
```

### 8.2 Specification

| Property | Value |
| --- | --- |
| Height | `h-11` mobile, `h-11 sm:h-12` for auth/primary forms; `h-9` admin dense |
| Radius | `rounded-xl` (`rounded-lg` in dense admin tables) |
| Border | `border-slate-200` → focus `border-primary` |
| Focus ring | `ring-2 ring-primary/20` (a 4px ring is too heavy at `h-11`) |
| Text | `text-base sm:text-sm` on mobile-entered forms so iOS does not zoom on focus |
| Placeholder | `placeholder:text-slate-400` — a hint, never a substitute for a label |
| Icon inset | `left-3.5`, `size-[18px]`, `text-slate-400`, `pointer-events-none` |
| Trailing action | `right-3.5`, `h-11 w-11` hit area, `text-slate-400 hover:text-slate-600` |
| Disabled | `bg-slate-50 text-slate-400 cursor-not-allowed` |
| Read-only | `bg-slate-50 border-slate-200 text-slate-700` |

### 8.3 Validation

The pattern already established in `pages/Login.jsx` + `components/auth/FieldError.jsx` is the standard — keep it and extend it:

- `noValidate` on the form; validate on **submit**, then re-validate that field on change.
- Never validate on first blur of an untouched field.
- `FieldError` renders `role="alert"`, an `AlertCircle` icon and `text-[13px] text-rose-600`, wired via `aria-describedby`. Errors are never signalled by border color alone.
- Form-level errors (e.g. "Invalid email or password.") render above the submit button in a `rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700` block with `role="alert"`.
- Field-level errors use inline `FieldError`. **Toasts are not a validation mechanism** — they are for asynchronous results only.

### 8.4 Other controls

- **Checkbox / radio:** 20×20, `rounded` / `rounded-full`, `border-slate-300`; checked `bg-primary-strong border-primary-strong`; `focus-visible:ring-2 ring-primary ring-offset-2`. Label clickable via `htmlFor`.
- **Select:** same box as input, `ChevronDown` at `right-3.5`. Prefer shadcn `Select` once adopted (§20).
- **Choice card** (payment method, filters): full-width button, `rounded-xl border p-4`; selected = `border-primary bg-primary-soft` **plus** an explicit radio dot. Selection must not be conveyed by tint alone.
- **Search:** `h-11 rounded-xl` with a leading `Search` icon and a trailing clear (`X`) button once non-empty. Debounce 300ms via `useDebouncedValue`.
- **Textarea:** `rounded-xl min-h-[96px] p-3 resize-y`.
- **Quantity stepper:** see §11.3.

### 8.5 Autofill and mobile keyboards

Always set `autoComplete` (`email`, `current-password`, `new-password`, `one-time-code`, `tel`) and `inputMode` (`numeric` for OTP/amounts). OTP inputs use `inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*"`.

---

## 9. Cards

### 9.1 Base recipe

```
bg-white border border-slate-200 rounded-2xl p-4 sm:p-5
```

Interactive cards add:

```
shadow-sm transition-[box-shadow,border-color,transform] duration-200
hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5
focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
```

Hover lift is **2px maximum** (`-translate-y-0.5`) and applies only to cards that navigate somewhere. `hover:scale-[1.02]` on cards is removed — scaling a card resamples its text.

The `.glass-card` utility in `index.css` is deprecated: it is not glass (no backdrop blur) and its name misleads. Replace usages with the recipe above, then delete it.

### 9.2 Structure

| Part | Spec |
| --- | --- |
| Media | Top, full-bleed, `aspect-[4/3]` (grid) or `size-24` (row). Card carries `overflow-hidden`. |
| Header | `H3` title + optional status/category chip on one row, `gap-2`, title `truncate` |
| Body | `text-sm text-slate-500 line-clamp-2` |
| Meta | `text-xs text-slate-500`, icon + label pairs |
| Footer | `mt-auto pt-4 flex items-center justify-between` — value left, action right |

Cards in a grid must be equal height: the grid item is `flex flex-col` and the footer uses `mt-auto`.

### 9.3 Variants

- **Content card** — default recipe.
- **Stat card** — `p-4 sm:p-6`; label `text-xs sm:text-sm text-slate-500`; value `text-2xl sm:text-3xl font-bold tabular-nums`; icon in a `size-10 rounded-xl bg-primary-soft` tile. Icon tints use a `-50` fill / `-600` icon pair, never `opacity-50` on an oversized icon.
- **List row card** — `rounded-xl p-3 sm:p-4`, horizontal, `gap-3`. Orders lists, notifications.
- **Panel** — page-level container: `rounded-3xl bg-white p-5 sm:p-6 lg:p-8 shadow-sm`.
- **Inset row** — inside a card: `rounded-lg bg-slate-50 p-3`, no border.

### 9.4 Whole-card interaction

If the entire card is clickable, the card is a `<button>` or wraps a single `<Link>` covering the title (with an inset `::after` overlay), so the accessible name is the title. Never attach `onClick` to a bare `<div>` — the admin dashboard's recent-order rows currently do this and are unreachable by keyboard.

---

## 10. Navigation

### 10.1 Structure by surface

| Viewport | Student | Admin |
| --- | --- | --- |
| < 1024px | Top header (logo, search, notifications, cart) + fixed bottom tab bar | Top header (wordmark + avatar) + fixed bottom tab bar |
| ≥ 1024px | Left sidebar 220px, sticky, + content header | Left sidebar 220px, sticky, + top bar `h-20` |

### 10.2 Sidebar

- `w-[220px]`, `bg-white`, `border-r border-slate-200`, sticky, `hidden lg:flex`.
- Item: `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors`.
- Inactive: `text-slate-600 hover:bg-slate-50 hover:text-slate-900`.
- **Active: `bg-primary-soft text-primary-strong font-semibold` with a 3px `bg-primary` left indicator** — replacing the blue→cyan gradient pill and its glow. The active row is where a filled gradient is most tempting and least necessary.
- Item spacing `space-y-1` (current `space-y-3` + `py-5` makes a six-item menu taller than a short laptop viewport).
- Icons `size-5`, `aria-hidden`. Active item carries `aria-current="page"`.
- Bottom area: logout (destructive ghost) and a `text-xs text-slate-500` copyright. Promotional cards in the sidebar are discouraged; if one exists it is `bg-slate-50 rounded-2xl` with no gradient.

### 10.3 Bottom tab bar (mobile)

- `fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 shadow-bar`, plus `pb-[env(safe-area-inset-bottom)]`.
- 4–5 items max. Each: icon `size-5` over `text-[11px] font-medium`, minimum `h-14 min-w-[64px]`.
- Active `text-primary-strong`, inactive `text-slate-500`. Active also sets `aria-current="page"` and uses a heavier/filled icon where lucide offers one — color alone is not enough.
- Badge (cart / notifications): `absolute -top-1 -right-2 min-w-[18px] h-[18px] rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white tabular-nums`, capped at `99+`, with `aria-label="3 unread notifications"`.
- Route matching must handle nested paths (`/orders/42` keeps Orders active) — exact `===` comparison is a bug.

### 10.4 Headers

- Student header: sticky, `h-14 sm:h-16`, `bg-white/95 backdrop-blur border-b border-slate-200`. Gains `shadow-sm` only after scroll.
- Admin top bar: `h-20 bg-white border-b border-slate-200 px-6 lg:px-8`; page title `text-xl font-bold` left, account menu right.
- The header title must match the route. One `<h1>` per page.

### 10.5 Back navigation

Detail pages (Track Order, Order Success, Personal Information) show a back affordance on mobile: ghost icon button with `ArrowLeft`, `aria-label="Go back"`, top-left of the content area.

---

## 11. Menus and food items

The product's most-used screen. Optimize for scan speed.

### 11.1 Category chips

- Horizontal scroller: `flex gap-2 overflow-x-auto scroll-smooth snap-x snap-mandatory`, chips `snap-start`.
- Chip: `h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors`.
- Inactive: `bg-white border border-slate-200 text-slate-700 hover:border-slate-300`.
- Active: `bg-primary-strong text-white border-transparent` — flat, no gradient, no glow.
- Implement as a **radio group**: `role="tablist"` / `role="tab"` with `aria-selected`, or real radio inputs. Arrow keys move between chips.
- Desktop scroll arrows are optional decoration: `aria-hidden`, never the only way to reach a category, hidden when the list doesn't overflow.
- Do not hide scrollbars globally to achieve this (§21.6) — scope `.hide-scrollbar` to this component.

### 11.2 Food card

Two layouts, one data contract.

**Mobile / tablet (< lg): horizontal row**
`flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4`

- Thumbnail `size-24 sm:size-28 rounded-xl object-cover shrink-0`
- Right column: name (`text-base font-semibold line-clamp-1`) + category chip; description `text-xs text-slate-500 line-clamp-2`; then price + action on one row.

**Desktop (≥ lg): vertical grid card**
`rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col`

- Media `aspect-[4/3] object-cover`, `group-hover:scale-105 duration-300`
- Content `p-4 lg:p-5 flex flex-col flex-1`, footer `mt-auto pt-4`.

Maintaining two markup trees for one card (as `FoodCard.jsx` does) is permitted **only here**, because the layouts differ structurally rather than dimensionally. Everywhere else, use responsive utilities. When you do fork markup, extract the shared leaves — price, favourite button, stepper, availability badge — into local components so they cannot drift.

**Required elements, in priority order:** image → name → price → availability → add action → category → description → favourite.

- Image fallback: on `onError` and on missing `image_url`, render the logo `object-contain p-4 bg-slate-50`. `alt` is always the item name.
- Category chip: `bg-slate-100 text-slate-600` by default. Only diet-relevant categories get color (`veg` → emerald, `spicy` → rose). The current implementation colors every category green, which makes the signal meaningless.
- Unavailable: `grayscale opacity-60` image, `bg-rose-600 text-white` "Out of stock" badge top-left, action disabled with `aria-disabled` and an accessible reason.
- Favourite: `size-9 rounded-full bg-white/90 shadow-sm` top-right, `Heart` `size-[18px]`, filled rose when active, `aria-pressed`, `aria-label="Add <item> to favourites"`. Optimistic toggle with rollback on failure.

### 11.3 Add button and quantity stepper

The add control swaps in place to a stepper once quantity > 0. The swap must not change the control's width — reserve it (`min-w-[104px]`) so the row doesn't jump.

```
Add (idle):  h-9 sm:h-10 rounded-full px-4 bg-primary-strong text-white
             text-sm font-semibold hover:bg-[#1D4ED8] active:scale-[0.98]

Stepper:     h-9 sm:h-10 rounded-full bg-primary-strong text-white
             [−] size-9 · count w-8 text-center text-sm font-semibold tabular-nums · [+] size-9
```

- `primary-strong`, not `primary` — see §2.3. No `shadow-blue-500/30`.
- Each stepper button needs `aria-label` ("Decrease quantity" / "Increase quantity"); the count needs `aria-live="polite"`.
- Decrementing from 1 returns to the Add state; never leave a `0` stepper.
- The per-item maximum (currently 10) disables `+` and shows a one-line reason, not a toast on every press.

### 11.4 Grid

```
grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2 lg:gap-6 xl:grid-cols-3 2xl:grid-cols-4
```

One column on phones (the row layout is dense enough), then the grid card from `lg` up.

### 11.5 Search and filters

- Search sits above the category strip, debounced 300ms, with a visible result count (`24 items`).
- An empty result is an empty state (§16), not a blank grid.
- Filters never silently reset when a socket pushes a menu update — reconcile and keep the user's selection.

---

## 12. Cart and checkout

Checkout is where trust is won or lost. It gets the most conservative styling in the product.

### 12.1 Layout

- **Mobile:** single-column list + **sticky bottom summary bar**: `fixed inset-x-0 bottom-0 bg-white border-t border-slate-200 shadow-bar p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]`, showing the total (left, `text-lg font-bold tabular-nums`) and the primary action (right, `lg` button). Page pads `pb-28`.
- **Desktop (≥ lg):** `grid lg:grid-cols-[1fr_380px] gap-6`; the summary is `sticky top-6`.

### 12.2 Cart line item

`rounded-2xl border border-slate-200 bg-white p-4`, `flex gap-4`:

- Thumbnail `size-20 sm:size-24 rounded-xl object-cover`
- Name `text-base font-semibold`, variant `text-sm text-slate-500`
- Unit price right-aligned `text-base font-semibold tabular-nums`; line total `font-bold text-slate-900`
- Footer row: bordered stepper (`rounded-xl border border-slate-200`, `size-10` buttons) left; remove button (destructive ghost, `size-10 rounded-xl`, `aria-label="Remove <item>"`) right.

Removing an item shows an **undo** affordance in the toast for 5 seconds rather than a confirmation dialog.

### 12.3 Order summary

- Panel: `rounded-2xl border border-slate-200 bg-white p-5 sm:p-6`.
- Line rows: `flex justify-between text-sm`; label `text-slate-500`, value `font-medium tabular-nums`.
- Show every line that exists — subtotal, packaging, taxes, discount (in `text-emerald-600` with a `−` prefix). Never hide a charge and surprise the user at the total.
- Divider `border-t border-slate-200 my-5`.
- Total row: label `text-sm text-slate-500`; amount `text-2xl font-bold text-primary-strong tabular-nums`.
- A recalculation animates only the number's opacity, never a layout shift.

### 12.4 Payment method

Choice cards (§8.4): `w-full rounded-xl border p-4 flex items-center justify-between gap-4`.

- Selected: `border-primary bg-primary-soft` + a filled radio dot.
- Icon in a `size-10 rounded-xl bg-slate-100` tile — the icon does **not** change color to signal selection.
- Implement as a real radio group (`role="radiogroup"`, arrow-key navigable).

### 12.5 Place order

- Primary `lg` button, full width; the label states the outcome: `Place cash order` or `Pay ₹220`.
- **Single-flight guarantee:** disabled + `aria-busy` from the moment it is pressed until the gateway returns or fails. Never allow a second Razorpay order.
- While the gateway sheet is open the page shows a non-dismissible `FullScreenLoader`; it must not close on a backdrop click.
- Failure returns the user to checkout with the cart intact and an inline `role="alert"` block — never only a toast, which may be missed after the redirect.

### 12.6 Order success

Confirmation shows, in order: token number (the largest element on the page, `text-4xl font-bold tabular-nums`), status, pickup location, items, amount paid, then two actions — **Track order** (primary) and **Download receipt** (secondary). One celebratory emoji is permitted here.

---

## 13. Order tracking and status

### 13.1 Status chip

One component, everywhere (student list, track page, admin queue, history):

```jsx
<span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1
                 text-xs font-semibold ring-1 ring-inset <tone-classes>">
  <Icon className="size-3.5" aria-hidden="true" />
  {getOrderStatusLabel(status)}
</span>
```

- Tone classes come from `statusStyles.js` (§2.5); the label from `utils/orderStatusLabel.js`.
- Students see `pending` and `accepted` as the same "Order Placed" stage. Admins see the real internal status. Never leak the internal name into student UI.

### 13.2 Timeline

Four student-visible steps: **Order Placed → Preparing → Ready for Pickup → Completed**.

- **Mobile: vertical.** Step row = `flex gap-3`; a 2px connector (`bg-slate-200`, completed `bg-primary`) runs behind a `size-9 rounded-full` node.
- **Desktop: horizontal**, same node/connector tokens.
- Node states: completed = `bg-primary text-white` with `Check`; current = `bg-white border-2 border-primary text-primary` plus one soft pulse ring (the only pulse in the product); upcoming = `bg-slate-100 text-slate-400`.
- Each step shows a timestamp `text-xs text-slate-500` once reached.
- The timeline is an `<ol>`. The current step is `aria-current="step"`. The container is `aria-live="polite"` so socket-driven changes are announced.

### 13.3 Terminal and exception states

- **Cancelled / rejected:** the timeline is replaced (not merely greyed) by a rose alert panel with the reason, plus refund information if applicable. Never show a hopeful progress bar on a dead order.
- **Refunded:** sky-toned panel stating amount and expected timeline.
- **Ready for pickup:** the highest-emphasis state in the app — emerald panel, large token number, counter location. This is the screen a student holds up at the counter, so the token must be readable at arm's length (`text-4xl`).

### 13.4 Live updates

- Socket updates patch state in place; never remount the page or reset scroll.
- Each status change announces via `aria-live="polite"` and may trigger one toast. Do not toast on every socket frame.
- On reconnect, refetch (the existing `useResyncOnReconnect` pattern) and reconcile — missed events are never replayed.
- If the socket has been disconnected > 10s, show a `text-xs text-slate-500` "Reconnecting…" indicator in the header rather than a blocking overlay.

---

## 14. Admin dashboard

### 14.1 Shell

```
min-h-screen bg-surface-canvas p-0 lg:p-5
  └ rounded-none lg:rounded-3xl bg-white shadow-sm overflow-hidden flex
      ├ Sidebar (hidden lg:flex, w-[220px])
      └ flex-1 min-w-0
          ├ Topbar (h-20)
          ├ main px-4 sm:px-6 lg:px-8 py-5 lg:py-8 pb-24 lg:pb-8
          └ AdminMobileBottomNav (lg:hidden)
```

The canvas is a flat `#F8FAFC`. The current `shadow-[0_15px_40px_rgba(0,0,0,0.08)]` on the shell becomes `shadow-sm` — a page-level container should not float.

### 14.2 Page template

Every admin page: `<h1>` title, optional one-line description `text-sm text-slate-500`, a right-aligned action cluster, then content. Filter/search toolbars sit in a `rounded-xl border border-slate-200 bg-white p-3` strip directly under the header and stay sticky on long lists.

### 14.3 KPI row

```
grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-6
```

Stat card (§9.3): label, value, and an optional delta chip (`text-xs font-semibold` + `ArrowUp`/`ArrowDown`, emerald/rose). A delta must always state its comparison period ("vs. yesterday") — a bare percentage is not information.

### 14.4 Live order queue

- The operational heart of the product. Density over decoration.
- Mobile: list-row cards. Desktop: a real table (§15).
- Status transition buttons are `sm` sized and grouped; the *next* action is Primary, the rest Secondary. Destructive actions (reject / refund) are separated and confirmed.
- New orders arriving over the socket insert with a 200ms fade — never a slide that moves rows the admin is about to click.
- Polling or refresh must not clear filters, selection or scroll position.
- Confirmations name the order in the heading ("Reject Token 042?"), never a generic "Are you sure?".

### 14.5 Admin on mobile

Canteen staff do use phones. Every admin page must be operable at 375px: the queue, status transitions and search are required. Bulk actions and analytics drilldowns may be desktop-only — provided the page says so rather than rendering broken.

---

## 15. Tables and analytics

### 15.1 When to use a table

| Viewport | Pattern |
| --- | --- |
| < lg | **List-row cards.** Never a horizontally scrolling table on a phone. |
| ≥ lg | **Semantic `<table>`** |

The codebase currently has no `<table>` element at all — desktop admin lists are card stacks, which wastes horizontal space and prevents column scanning. New desktop admin lists use real tables.

### 15.2 Table specification

```
wrapper: rounded-2xl border border-slate-200 bg-white overflow-hidden
table:   w-full text-sm
thead:   bg-slate-50 border-b border-slate-200 sticky top-0 z-10
th:      px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500
td:      px-4 py-3 text-slate-700 border-b border-slate-100 last:border-0
row:     hover:bg-slate-50 transition-colors
```

- Use `<caption className="sr-only">`, `<th scope="col">`, and `<th scope="row">` for the identifying cell (the token).
- Numeric columns: `text-right tabular-nums`. Currency is always right-aligned.
- Sortable headers are `<button>`s inside `<th>` with `aria-sort` and a `ChevronsUpDown` / `ChevronUp` / `ChevronDown` indicator.
- Row actions live in a trailing right-aligned column, revealed on `hover` / `focus-within` but **always present in the DOM and reachable by keyboard**.
- No zebra striping — hairlines suffice, and striping fights the status chips.
- Sticky header on scroll; sticky first column only when there are more than six columns.
- Pagination below the table: `flex items-center justify-between`, range text `text-sm text-slate-500` ("Showing 1–20 of 143"), `sm` ghost prev/next.

### 15.3 Charts (recharts)

- **Series colors, in order:** `#2563EB` → `#0EA5E9` → `#8B5CF6` → `#F59E0B` → `#10B981`. Maximum five series; beyond that, aggregate into "Other".
- The revenue / primary series is always `#2563EB`.
- Grid: `stroke="#F1F5F9"`, horizontal lines only, no vertical grid.
- Axes: `stroke="#CBD5E1"`; tick text `fill="#64748B"` at 12px, `tabular-nums`. Y-axis currency uses compact notation (`₹1.2k`).
- Area fills: a single flat color at `fillOpacity={0.08}`. A vertical gradient to transparent is acceptable **only** for a single-series area chart; never for multi-series or bars.
- Tooltip: reuse the `TooltipCard` in `components/admin/RevenueTrendChart.jsx` — `rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-lg text-xs`. That component is the reference implementation; extract it to a shared module rather than re-implementing per chart.
- Chart height: `h-56 sm:h-72 lg:h-80` inside `<ResponsiveContainer width="100%">`.
- Tick density follows the viewport (the existing `useMediaQuery` approach is correct).
- **Every chart requires a text alternative:** a visually-hidden summary or an adjacent data table. A canvas alone is not accessible.
- No 3D, no donut with more than five slices, no dual Y-axes unless the units genuinely differ and both are labelled.

### 15.4 Export

Export actions (`Download`, PDF receipts via `jspdf`) are Secondary buttons, show a loading state, and confirm completion with a toast naming the file.

---

## 16. Empty, loading and error states

### 16.1 Empty states

Four parts, always: icon, one-line headline, one-line explanation, one action.

```jsx
<div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center sm:py-16">
  <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary-soft">
    <ShoppingCart className="size-7 text-primary-strong" aria-hidden="true" />
  </div>
  <h2 className="mt-6 text-lg font-semibold text-slate-900">Your cart is empty</h2>
  <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
    Add something from the menu and it'll show up here.
  </p>
  <Button className="mt-6" onClick={…}>Browse menu</Button>
</div>
```

Distinguish the three kinds and write different copy for each:

- **First use** — "You haven't ordered yet." → action: browse menu.
- **Filtered to nothing** — "No items match 'paneer'." → action: clear filters (never "browse menu").
- **Genuinely empty data** — "No orders today." → no action, or refresh.

Icon circle `size-16`, headline `text-lg` — an empty state is an aside, not a hero. The current `text-3xl` empty-state headlines are oversized.

### 16.2 Loading

**Skeletons, not spinners, for content with a known shape.** A skeleton mirrors the real layout's dimensions so nothing shifts on arrival.

```
skeleton: animate-pulse rounded-lg bg-slate-100   /* bg-slate-200 for larger blocks */
```

| Situation | Pattern |
| --- | --- |
| Menu grid, order list, notifications | Skeleton matching the real card, 6–8 placeholders |
| Stat row | `h-28 rounded-2xl` blocks matching the grid |
| Chart | `h-64 rounded-2xl` block |
| Button action | In-button `Loader2` spinner, label retained |
| Route chunk | Existing `FullScreenLoader` / `BrandLoader` |
| Background refresh of visible data | `opacity-60 pointer-events-none transition-opacity` on the region — never a skeleton swap |
| Inline pagination | Ghost "Loading…" row at list end |

- The branded loader appears **only on first app entry** (the existing `utils/appEntry.js` rule). Route changes and refetches get the quiet variant.
- Never show a skeleton for less than ~200ms — delay its appearance to avoid a flash.
- Loading regions set `aria-busy="true"`.

### 16.3 Errors

| Scope | Pattern |
| --- | --- |
| Field | Inline `FieldError` (§8.3) |
| Form | `role="alert"` rose block above the submit |
| Section / failed fetch | Inline card: `AlertTriangle`, "Couldn't load your orders.", **Try again** Secondary button |
| Page / route chunk | `ChunkErrorBoundary` — offer reload |
| Transient async result | Toast |
| Destructive confirmation | Dialog |

Error copy states what failed and what to do next. Never surface raw backend text or status codes to students. Never blame the user. Auth failures use one fixed message (`Invalid email or password.`) regardless of cause — this is deliberate; do not "improve" it into something more specific.

### 16.4 Toasts

- One system only. `react-hot-toast` today; `sonner` after the shadcn migration. `sweetalert2` is removed.
- Position: `top-center` on mobile (thumb-safe, above the fold), `bottom-right` on desktop.
- Duration 4s (success) / 6s (error). Errors must be dismissible.
- Maximum three stacked; deduplicate by key so socket bursts don't flood the screen.
- Toasts report the **result of an action the user just took**. Not validation, not page-load errors, not status already visible on screen.

### 16.5 Offline

If `navigator.onLine` is false, show a persistent `bg-slate-900 text-white text-xs` bar above the bottom nav: "You're offline. Orders will not update." Restore silently on reconnect.

---

## 17. Responsive breakpoints

### 17.1 Breakpoints

Tailwind defaults. No custom breakpoints.

| Token | Min width | Target | Layout |
| --- | --- | --- | --- |
| (base) | 320px | Small phones | Single column, bottom nav, stacked forms |
| `sm` | 640px | Large phones / small tablets | Larger type and padding, 2-col stat grids |
| `md` | 768px | Tablets portrait | 2-col content grids |
| `lg` | 1024px | **The layout switch.** Laptops | Sidebar appears, bottom nav disappears, tables replace card lists |
| `xl` | 1280px | Desktop | 3-col menu grid, wider analytics |
| `2xl` | 1536px | Large desktop | 4-col menu grid; container caps at `max-w-7xl` |

`lg` is the single structural breakpoint. Everything below it is the "mobile shell"; everything at or above is the "desktop shell". Do not introduce a second structural switch.

### 17.2 Rules

- **375px is the design target**; 320px must not break. Test both.
- Mobile-first: unprefixed = smallest. `max-*` variants are a last resort.
- Never render both a mobile and a desktop copy of the same content unless the structure genuinely differs (§11.2). Duplicated trees double maintenance and expose content twice to screen readers — if you must fork, hide the inactive branch with `hidden` / `lg:hidden` (which removes it from the a11y tree), never `opacity-0`.
- No horizontal page scroll at any width. Long tokens, emails and item names get `truncate` or `break-words`.
- Touch targets ≥ 44px below `lg`.
- Respect safe areas: `env(safe-area-inset-bottom)` on fixed bottom elements.
- Images declare `width`/`height` or an `aspect-[…]` box to prevent layout shift.

---

## 18. Accessibility

Target: **WCAG 2.1 AA**.

### 18.1 Non-negotiables

1. **Visible focus everywhere.** `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`. Currently **zero** files use `focus-visible` while 12 use `outline-none` — that combination is the highest-priority accessibility defect in the codebase.
2. **Semantic elements.** `<button>` for actions, `<a>`/`<Link>` for navigation, `<ul>/<li>` for lists, `<table>` for tabular data, one `<h1>` per page with no skipped heading levels. Clickable `<div>`s are defects.
3. **Contrast.** Body text ≥ 4.5:1; large text and UI boundaries ≥ 3:1. See §2.3 and §2.4. `slate-400` is not a text color.
4. **Labels.** Every input has a `<label htmlFor>`. Every icon-only button has `aria-label`. Every image has `alt` (decorative → `alt=""`). Every icon inside a labelled control is `aria-hidden="true"`.
5. **Color is never the sole signal.** Status chips carry icons and text; errors carry an icon and message; the active tab carries `aria-current`.

### 18.2 Keyboard

- Logical tab order following visual order.
- A skip link to `#main` as the first focusable element.
- Modals: focus moves in on open, is trapped, and returns to the trigger on close; `Esc` closes; content behind is inert, with `role="dialog" aria-modal="true" aria-labelledby`.
- Dropdowns / menus: arrow keys navigate, `Esc` closes, `Enter`/`Space` selects.
- Category chips and payment choices: arrow-key navigable groups with roving tabindex.
- No keyboard trap anywhere, including the Razorpay overlay and the datepicker.

### 18.3 Screen readers

- Live regions: order status (`aria-live="polite"`), cart count, toast container, form errors (`role="alert"`).
- Loading regions `aria-busy="true"`; loading text announced, not just shown.
- Counts and badges have text equivalents: `aria-label="Cart, 3 items"`.
- Charts require a text alternative (§15.3).
- `sr-only` for visually hidden but announced text: table captions, "current step", context for repeated "View" links.

### 18.4 Motion and zoom

- Honour `prefers-reduced-motion` (§19.4).
- Content must reflow and stay usable at 200% browser zoom and at 320px width.
- No auto-playing animation longer than 5 seconds and no infinite motion other than a single loading spinner or the one "ready" pulse.

### 18.5 Checklist before merging UI

- [ ] Every interactive element reachable and visibly focused by keyboard
- [ ] No `outline-none` without a `focus-visible` replacement
- [ ] Contrast checked for new color pairs
- [ ] Icon-only controls have `aria-label`
- [ ] Images have `alt`
- [ ] Works at 320px and at 200% zoom
- [ ] Works with reduced motion enabled
- [ ] No content duplicated across mobile and desktop trees without `hidden`

---

## 19. Animation and motion

Motion exists to explain a change of state. If it doesn't tell the user what happened or where something came from, remove it.

### 19.1 Tokens

| Token | Duration | Easing | Use |
| --- | --- | --- | --- |
| `instant` | 100ms | `ease-out` | Press feedback |
| `fast` | 150ms | `ease-out` | Hover, color, focus ring |
| `base` | 200ms | `ease-out` | Fade, expand, list item enter |
| `slow` | 300ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Modal, sheet, page transition |
| `spring` | — | `{ type:'spring', stiffness:400, damping:30 }` | Cart badge, stepper count only |

Entering uses `ease-out`; exiting uses `ease-in` at 150ms — exits should always be faster than entrances.

### 19.2 Approved patterns

| Pattern | Spec |
| --- | --- |
| Page / route enter | `opacity 0→1`, `y 8→0`, 200ms |
| Modal | backdrop `opacity 0→1` 200ms; panel `opacity 0→1, scale 0.96→1` 200ms |
| Bottom sheet | `y 100%→0`, 300ms `slow` easing |
| List stagger | 30ms delay, **first 5 items only**, then no delay |
| Toast | slide 16px + fade, 200ms |
| Accordion / expand | height + fade, 200ms |
| Status step advance | node `scale 0.8→1` + check fade, 200ms, once |
| Cart badge | `spring` scale pop on count change |
| Skeleton | `animate-pulse` |
| Card hover | `translate-y -2px` + shadow, 200ms, CSS only |

### 19.3 Prohibited

- Animated background gradients (`animate-gradient` in `index.css` — remove).
- `hover:scale-105` / `hover:scale-[1.02]` on cards, buttons or sidebar items.
- `animate-bounce`, `animate-ping` — one exception: the single "live" / "ready" indicator dot.
- Staggering more than five items, or any stagger totalling over 500ms.
- Motion on data that updates over a socket at high frequency (the admin queue) — it turns a work surface into a slot machine.
- Parallax, scroll-jacking, entrance animations that replay on every re-render.
- Framer Motion where a Tailwind `transition-*` would do. Reach for `motion` only when you need orchestration, exit animations (`AnimatePresence`), layout animation, or gestures.

### 19.4 Reduced motion

Currently **1 of 30** files using Framer Motion checks `useReducedMotion`. Every animated component must.

Use a shared helper so the check can't be forgotten:

```jsx
// src/hooks/useMotionPreset.js
import { useReducedMotion } from "framer-motion";

export const useMotionPreset = () => {
  const reduce = useReducedMotion();

  return {
    fadeUp: reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.15 } }
      : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.2 } },
    stagger: (i) => ({ transition: { delay: reduce ? 0 : Math.min(i, 4) * 0.03 } }),
    reduce,
  };
};
```

Plus a global CSS backstop in `index.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Reduced motion means *reduced*, not removed: keep opacity fades so state changes stay perceivable, drop movement and scale.

---

## 20. shadcn/ui usage

### 20.1 Current state

shadcn/ui is **not installed** in `frontend/`. There is a `shadcn` CLI devDependency at the repository root and no `components.json`. Every primitive today is hand-rolled, which is why buttons, inputs, modals and chips have drifted.

### 20.2 Initialisation

Run inside `frontend/`:

```bash
npx shadcn@latest init
```

Answer with:

| Prompt | Value |
| --- | --- |
| Style | `new-york` |
| Base color | `slate` |
| CSS variables | `yes` |
| Tailwind config | `tailwind.config.js` |
| Global CSS | `src/index.css` |
| Components alias | `@/components` |
| Utils alias | `@/lib/utils` |
| RSC | `no` |
| TypeScript | **`no`** — this project is JSX |

This adds `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate` and the relevant `@radix-ui/*` packages, and requires a `@` path alias in `vite.config.js` and `jsconfig.json`.

### 20.3 Token bridge

shadcn writes its own `--background` / `--primary` variables in HSL. Map them to this design system rather than maintaining two palettes — edit the generated `:root` block to:

```css
:root {
  --background:         210 40% 98%;   /* #F8FAFC */
  --foreground:         222 47% 11%;   /* #0F172A */
  --card:               0 0% 100%;
  --card-foreground:    222 47% 11%;
  --primary:            221 83% 53%;   /* #2563EB — see §2.3 */
  --primary-foreground: 0 0% 100%;
  --secondary:          210 40% 96%;   /* #F1F5F9 */
  --muted:              210 40% 96%;
  --muted-foreground:   215 16% 47%;   /* #64748B */
  --border:             214 32% 91%;   /* #E2E8F0 */
  --input:              214 32% 91%;
  --ring:               217 91% 60%;   /* #3B82F6 — focus ring uses brand blue */
  --destructive:        0 72% 51%;     /* #DC2626 */
  --radius: 0.75rem;                   /* 12px → rounded-xl default */
}
```

Dark-mode variables are not defined. This is a light-theme product.

### 20.4 Adoption order

Replace bespoke primitives incrementally, highest leverage first. Do not rewrite the app in one pass.

| Wave | Components | Replaces |
| --- | --- | --- |
| 1 | `button`, `input`, `label`, `badge`, `skeleton`, `separator` | Ad-hoc button/input classes, `.badge`, `.skeleton` |
| 2 | `dialog`, `alert-dialog`, `sheet`, `sonner` | `LogoutModal`, `ConfirmOrderModal`, `ClearNotificationsModal`, **`sweetalert2`**, `react-hot-toast` |
| 3 | `dropdown-menu`, `select`, `tabs`, `tooltip`, `popover` | Custom dropdowns, `OrderFilters`, account menu |
| 4 | `table`, `pagination`, `scroll-area`, `command` | Admin lists (§15), admin search |

`sweetalert2` and `react-hot-toast` both disappear after wave 2 — two dialog systems and two notification systems in one app is the largest single source of visual inconsistency here.

### 20.5 Rules

- **Own the code.** shadcn components are vendored into `src/components/ui/`. Edit them to match this document (radius, focus ring, height) rather than wrapping them in override classes at every call site.
- **Extend variants in the component, not at the call site.** Add `soft` and `pill` to `buttonVariants` (§7) instead of passing `className="rounded-full bg-blue-50 …"` in forty places.
- **`cn()` for every conditional class.** Never build class strings with template literals and ternaries — the current multi-line template strings are unreadable and emit duplicate conflicting utilities that `tailwind-merge` would resolve.
- Use `asChild` to compose with react-router's `Link` rather than nesting a `<Link>` inside a `<button>`.
- Keep Radix's built-in accessibility. Do not strip `aria-*` props or swap a Radix trigger for a raw `div`.
- Domain components (`FoodCard`, `StatusChip`, `OrderRow`, `QuantityStepper`) live in `src/components/`, compose `ui/` primitives, and are the only place domain styling is decided.
- Don't install a shadcn component you use once — inline it. Don't hand-roll one you'd use three times — install it.

---

## 21. General frontend implementation rules

### 21.1 File and component structure

```
src/
  components/
    ui/            # shadcn primitives — generic, no domain knowledge
    admin/         # admin-only composites
    cart/ dashboard/ orders/ profile/ notifications/ auth/
    <Shared>.jsx   # cross-surface domain components (FoodCard, StatusChip)
  pages/           # route components — composition and data only
  hooks/  context/  services/  utils/  socket/
```

- One component per file, default export, `PascalCase.jsx`.
- Pages fetch and compose; they don't define reusable visual primitives.
- If the same markup appears three times, extract it. `STATUS_STYLES`, the quantity stepper, the stat card and the skeleton row are all currently duplicated.

### 21.2 Styling

- Tailwind utilities in JSX. No CSS modules, no styled-components, no inline `style` except for genuinely dynamic values (a computed progress width).
- **No vertically-exploded class lists.** Several files currently place one utility per line across 40+ lines. Write classes on one line, or group them with `cn()`:

```jsx
className={cn(
  "flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4",
  "transition-shadow duration-200 hover:shadow-md",
  isActive && "border-primary bg-primary-soft",
  disabled && "pointer-events-none opacity-50",
)}
```

- Class order: layout → box → spacing → typography → color → border → effects → transition → state variants.
- `@layer components` in `index.css` is reserved for genuine cross-cutting primitives. Do not grow it; the goal is to shrink it to zero as shadcn takes over. `.glass-card`, `.btn-primary`, `.btn-secondary`, `.input-premium`, `.gradient-text`, `.card-hover` and `.status-*` are all deprecated.
- No arbitrary values for anything covered by a token (§4, §5, §6).

### 21.3 State, data and realtime

- Server state through the existing `services/` API modules — never `axios` directly in a component.
- Use `useDebouncedValue`, `useLatestRequest` and `useSingleFlightRefetch` for search, racing requests and socket-triggered refetches. These already exist; don't reinvent them.
- Socket handlers patch state; they never remount a tree, reset scroll or clear user input and filters.
- Optimistic updates (favourites, cart) must roll back visibly on failure.
- Money is computed on the server. The client formats; it never calculates a total it then sends.

### 21.4 Performance

- Route-level code splitting via `lazy()` — already in place. Keep `recharts`, `jspdf`, `react-datepicker` and `sweetalert2` out of the student bundle.
- `memo` list items (`FoodCard` is the model). Keys are stable IDs, never array indices.
- Images: `loading="lazy"`, explicit dimensions or an `aspect-[…]` box, `decoding="async"`.
- Consider list virtualisation above ~200 rows in the admin queue.
- Avoid layout thrash: animate `transform` and `opacity`, never `width` / `height` / `top`.

### 21.5 Copy and formatting

- Sentence case for all UI text, including buttons and table headers. Not Title Case, not ALL CAPS — except the `uppercase tracking-wide` micro-label on `<th>` and eyebrows.
- Currency via `utils/formatPrice`; dates via `date-fns` with an explicit IST timezone; status labels via `utils/orderStatusLabel`. Never format these inline.
- Buttons are verbs: "Place order", "Track order", "Download receipt". Never "OK", "Submit", "Click here".

### 21.6 Known global CSS defects to fix

These live in `frontend/src/index.css` and violate the system:

1. **Scrollbars are hidden globally** (`::-webkit-scrollbar { display: none }` and `* { scrollbar-width: none }` at the end of the file). This removes a standard affordance app-wide to solve one horizontal category strip. Delete the global rules; keep `.hide-scrollbar` and apply it only to the category scroller.
2. **Conflicting scrollbar rules** — the file styles a blue gradient scrollbar thumb near the top and then hides all scrollbars at the bottom. Remove the gradient thumb.
3. **`body` uses a three-stop background gradient.** Replace with flat `bg-surface-canvas` (`#F8FAFC`).
4. **`font-[Inter]` arbitrary value on `body`.** Use `font-sans` with the configured family.
5. **`.glass-card` is not glass** and is used as the generic card. Deprecate per §9.1.
6. **`animate-gradient` keyframes** — remove (§19.3).
7. **`.hide-scrollbar` is declared three times.** Keep one.

### 21.7 Definition of done for any UI change

- [ ] Uses tokens only — no arbitrary radius, shadow, color or spacing
- [ ] Works at 320 / 375 / 768 / 1024 / 1440px
- [ ] Keyboard-operable with a visible focus ring
- [ ] Has loading, empty and error states
- [ ] Contrast verified for new color pairs
- [ ] Reduced motion honoured
- [ ] No new `sweetalert2`, no second toast system, no new icon library
- [ ] No duplicated markup that a responsive utility could express
- [ ] Repeated markup extracted into a component

---

## 22. Migration from the current codebase

Ordered by impact-to-effort. Each step is independently shippable.

| # | Change | Why |
| --- | --- | --- |
| 1 | Add `focus-visible:ring-2 ring-primary ring-offset-2` to every interactive element; remove bare `outline-none` | AA blocker — 0 files currently use `focus-visible` |
| 2 | Add the global `prefers-reduced-motion` backstop + `useMotionPreset`; adopt across the 30 Framer Motion files | AA blocker — 1 of 30 files checks it |
| 3 | Delete the global scrollbar-hiding rules in `index.css`; scope `.hide-scrollbar` | Removes a standard affordance app-wide |
| 4 | Swap `bg-primary` → `bg-primary-strong` (`#2563EB`) on every filled control with text < 18px | Contrast 3.68:1 → 5.17:1 |
| 5 | Replace `text-gray-400` / `text-slate-400` used as live text with `text-slate-500` | 2.5:1 fails AA |
| 6 | Extract `src/utils/statusStyles.js`; delete `.status-*` from `index.css` and `STATUS_STYLES` from `AdminOrders.jsx` | Two drifted sources of truth |
| 7 | Remove blue→cyan / blue→indigo gradients from buttons, chips and sidebar active states | Generic look; flattens to brand |
| 8 | Remove `shadow-blue-500/*` glows; adopt the neutral shadow scale | Elevation consistency |
| 9 | Collapse 15 radii to the five-token scale using the §5 mapping | Visual consistency |
| 10 | Flatten the `body` gradient to `#F8FAFC`; drop Poppins from the font stack | Poppins is declared but never loaded |
| 11 | Standardise `gray-*` → `slate-*` throughout | Two neutral ramps produce mismatched hairlines |
| 12 | `shadcn init` + wave 1 (`button`, `input`, `label`, `badge`, `skeleton`) | Stops further primitive drift |
| 13 | Wave 2: dialogs + `sonner`; **delete `sweetalert2`** | Two dialog systems, two toast systems |
| 14 | Convert clickable `<div>`s (admin recent orders, cards) to `<button>` / `<Link>` | Keyboard reachability |
| 15 | Introduce real `<table>` for desktop admin lists | No `<table>` exists today |
| 16 | Reduce sidebar item padding `py-5 space-y-3` → `py-3 space-y-1` | Six items overflow short laptop viewports |
| 17 | Collapse multi-line class strings to `cn()` calls as files are touched | Readability; prevents conflicting utilities |

Do **not** attempt 1–17 as one commit. Steps 1–5 are accessibility fixes and should land first, together.

---

## Appendix A — Quick reference

```
Canvas            bg-[#F8FAFC]
Surface           bg-white border border-slate-200
Card              bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm
Panel             bg-white rounded-3xl p-5 sm:p-6 lg:p-8 shadow-sm
Primary button    h-11 rounded-xl px-4 bg-[#2563EB] text-white text-sm font-semibold
Secondary button  h-11 rounded-xl px-4 bg-white border border-slate-200 text-slate-700
Input             h-11 rounded-xl border border-slate-200 px-4 text-sm
Focus             focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2
Chip              rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset
Heading           text-xl sm:text-2xl font-bold tracking-tight text-slate-900
Body              text-sm sm:text-base text-slate-700
Muted             text-sm text-slate-500
Price             text-lg font-bold text-slate-900 tabular-nums
Page gutter       px-4 sm:px-6 lg:px-8
Grid gap          gap-3 sm:gap-4 lg:gap-6
Transition        transition-colors duration-150  /  duration-200 for enter
```

## Appendix B — Do / Don't

| Don't | Do |
| --- | --- |
| `bg-gradient-to-r from-blue-600 to-cyan-500` | `bg-[#2563EB]` |
| `shadow-blue-500/30` | `shadow-sm` / `shadow-md` |
| `rounded-[28px]` | `rounded-3xl` |
| `text-gray-400` for a timestamp | `text-slate-500` |
| `hover:scale-105` on a card | `hover:-translate-y-0.5 hover:shadow-md` |
| `outline-none` alone | `focus-visible:ring-2 ring-primary ring-offset-2` |
| `<div onClick>` | `<button>` / `<Link>` |
| `Swal.fire(…)` | shadcn `AlertDialog` |
| A toast for a validation error | Inline `FieldError` |
| A spinner for a known-shape list | A matching skeleton |
| Two markup trees for one responsive card | Responsive utilities (exception: §11.2) |
| 40 lines of one-utility-per-line classes | One line, or `cn()` with grouped strings |
