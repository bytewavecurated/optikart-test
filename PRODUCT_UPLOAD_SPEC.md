# Product upload specification and acceptance criteria

The columns, values and rules a bulk product file has to satisfy. Everything here
is taken from the code that enforces it — `server/routes/manufacturer.js`
(`POST /api/manufacturer/products/bulk-upload`) and the category validator in
`server/models/Product.js` — not from an intention document. Where the two
disagree, the code is the truth and this file is the bug.

There are two layers of criteria and both reject rows. The spreadsheet parser
checks columns and shapes; the model validates the resulting product as a final
gate, because the same rules must hold for a product created one at a time in the
dashboard. A row can therefore pass the sheet and still be refused by the model,
and the error text names the field either way.

----------------------------------------------------------------------
## 1. File format
----------------------------------------------------------------------

| Item | Requirement |
| --- | --- |
| Extensions | `.xlsx`, `.xls`, `.csv` |
| Sheet | the **first** sheet is read; later sheets are ignored |
| Header row | row 1 becomes column names (Excel export is fine) |
| Data | starts at row 2, and the reported row numbers are spreadsheet rows, so an error saying "Row 7" points at row 7 |
| Column matching | case- and spacing-insensitive: `Model Number`, `modelnumber`, `model_number` all resolve to `modelNumber`. Alternative names per column are listed below |
| Empty rows | skipped silently (every cell blank) |
| All-or-nothing | if **any** row fails the checks, nothing is imported. The response lists up to 50 problems. Half a catalogue is worse than none, because the sheet then gets re-uploaded and the brand ends up with duplicates of the rows that did land |

```
curl -X POST http://localhost:3000/api/manufacturer/products/bulk-upload \
  -H "Authorization: Bearer <manufacturer token>" \
  -F "file=@products.csv"
```

Accepted response: `{ "success": true, "message": "23 products uploaded successfully.", "count": 23 }`
Rejected response: `{ "success": false, "message": "4 row(s) need attention before the file can be imported.", "errors": ["Row 7 (Aviator Classic): missing required frameShape, dimensions ...", ...] }`

----------------------------------------------------------------------
## 2. Columns every row needs
----------------------------------------------------------------------

| Column | Also accepted as | Rule |
| --- | --- | --- |
| `title` | `name`, `product name` | non-empty |
| `price` | `selling price` | number > 0. This is the MRP the shopper sees struck through |
| `discounted price` | — | optional; when present it is the actual selling price and must be ≤ `price` |
| `category` | — | one of the eight values in §3 |
| `brand` | `brand name` | non-empty. Must match a brand the account can list; the upload is filed under this brand |
| `product code` | `product id`, `sku` | non-empty, and unique inside a brand — `brand + productCode` is how a product is found again, so a repeated code updates or collides with the earlier row |
| `model number` | `model no`, `model` | non-empty |
| `description` | — | non-empty |
| `images` | `image`, `image links`, `image urls` | **at least one**, `|`-separated URLs. Images are fetched and stored on upload; a dead link fails the row, because a live product with no picture is the commonest support ticket |
| `stock` | — | integer, default 0 (a product with 0 stock is listed but unbuyable) |
| `warranty`, `tags` | tags `|`-separated | optional |
| `return window days` | — | optional integer; unset falls back to the platform's 7 days |
| `original price` | — | optional; the crossed-out figure if it differs from `price` |

----------------------------------------------------------------------
## 3. Categories and their extra requirements
----------------------------------------------------------------------

`category` is lower-cased and stripped of spaces/underscores/dashes, so
`Contact Lenses`, `contact-lenses` and `contactlenses` are the same value.

`eyeglasses`, `sunglasses`, `reading glasses`, `sports eyewear`, `kids` — eyewear.
`contact lenses`, `solution`, `accessories` — the rest.
Anything else is refused with the valid list quoted back.

**One file, one category.** Sunglasses and eyeglasses especially must not be
mixed: a sheet where the category column is inconsistent has historically mapped
hundreds of rows to the wrong type.

### 3.1 Eyewear (all five categories)

| Column | Also accepted as | Rule |
| --- | --- | --- |
| `gender` | — | `men`, `women`, `unisex`, `kids`. Required |
| `frame shape` | `face shape` | required — this is what the face-shape browse lists from |
| `frame type` | — | required: full rim, half rim, rimless |
| `frame material` | `material` | required |
| `frame colour` | `color`, `colours` | required |
| `frame size` | `size` | required; bucketed to small/medium/large/extra-large from the lens width |
| `frame width` | — | required, numeric (mm) |
| `frame weight` | — | required, numeric (g) |
| `frame dimensions` | `dimensions`, or `dim width`/`dim height`/`dim bridge`/`dim temple` separately | required in one of those forms. Either one string of four numbers (`54 x 52 x 16 x 145`) or the four columns |
| `colours` / `sizes` | — | optional, `|`-separated; multiple colour names should come with matching colours per row so the shopper picks a real one |
| `materials` | — | optional list |

Kids (`category = kids`) additionally require **`sub gender`** (`boys`/`girls`) and
**`age group`** — a parent filtering by age cannot help an unset value.

Sunglasses and eyeglasses with **`powered options available`** truthy — `true`,
`yes`, `y`, `1` — must also give **`prescription lens types`** (`lens types`
accepted), `|`-separated and non-empty: the lab cannot cut a lens the listing never
offered.

### 3.2 Contact lenses

| Column | Rule |
| --- | --- |
| `power type` | `distance`, `toric`, `multifocal`, `none` |
| `replacement period` | daily / fortnightly / monthly / quarterly / half-yearly / yearly |
| `lenses per box` | integer ≥ 1 (defaults to 6 if blank at parse time; the model requires ≥ 1) |
| `diameter` | numeric, mm |
| `base curve` | numeric, mm |
| `is cosmetic` + `allows zero power` | a coloured lens must state explicitly whether a zero-power option exists — a cosmetic lens bought as "no prescription" needs that answer, a clear corrective one does not |
| `cylinder min`, `cylinder max` | **when `power type = toric`**; max must be negative |
| `axis min`, `axis max` | **when `power type = toric`** |
| `addition min`, `addition max` | **when `power type = multifocal`**, and max > min |
| `step` | optional power increment (default 0.25) |

Columns left blank are stored as absent, not as the text `undefined` — which used
to happen, and turned a missing optional value into an invalid one (see §7).

### 3.3 Solution

| Column | Rule |
| --- | --- |
| `volume ml` | required, numeric — the bottle size every price is quoted against |
| `pack pricing` | required, at least one pack price so multi-buy can be priced (e.g. `2:1499|3:2099`) |

### 3.4 Accessories

| Column | Rule |
| --- | --- |
| `accessory type` | required: case, chain, cleaning kit, spray, etc. |

----------------------------------------------------------------------
## 4. Categories that previously could not be uploaded in bulk

Worth recording because it shapes how the sheets were written: until now the
parser never read **`volume ml`/`pack pricing`** (solution), **`accessory type`**
(accessories), or the toric/multifocal ranges, and it also sent `gender` and the
frame columns as empty strings for rows that had no business carrying them. The
model rejected every one of those rows — so **no solution or accessory product
could be imported in bulk at all**, and a toric lens sheet failed with a complaint
about a column no template mentioned.

All of them are read now. `pack pricing` is written `2:1499|3:2099`
(multipack size : price), because the multi-buy saving is the whole content of the
field and one figure per row cannot hold it.

Images: at least one URL per row, and the URL must **return** an image — checked
on the response's content type, with the filename extension taken from it when the
path has none. An extension-only check used to reject valid CDN links
(`…/seed/x/800/800`, `…?format=jpg`) and the message blamed the link. A local
`/uploads/...` path is accepted as-is, which is how the test suite feeds the
endpoint without depending on the internet.

---

## 5. What happens to an uploaded product
----------------------------------------------------------------------

1. Created with `manufacturer` = the uploading brand, `isManufacturerProduct` = true
   and `verificationStatus` = **`pending`**.
2. It is **not** on the storefront at that point. Staff and admin verification
   (`GET /api/products?verificationStatus=pending`) moves it to `verified`, which is
   what `GET /api/products` and the browse pages filter on.
3. Retailers of that brand can then stock it (manufacturer-seller console). A
   retailer listing a brand product is a supply claim and goes through brand
   approval plus platform verification — see "Brand supply claims" in
   `OPERATIONS.md`.
4. Discount fields (`isUnderSaleEvent`, coupon stacking) are not settable by upload;
   they belong to sale-event administration.

----------------------------------------------------------------------
## 6. Checklist before sending a file
----------------------------------------------------------------------

- [ ] one category per sheet
- [ ] headers in row 1; no title rows or blank rows above the header
- [ ] `title`, `price`, `category`, `brand`, `product code`, `model number`, `description`, `images` filled on every row
- [ ] at least one working image URL per row
- [ ] no duplicate `product code` within the brand
- [ ] eyewear rows carry frame shape/type/material/colour/size/width/weight and dimensions
- [ ] kids rows carry sub gender and age group
- [ ] powered rows carry prescription lens types
- [ ] colour lenses state whether zero power is offered
- [ ] prices: `discounted price` ≤ `price`

----------------------------------------------------------------------
## 7. Errors you will see, and what they mean
----------------------------------------------------------------------

| Message | Meaning |
| --- | --- |
| `Row N (Title): missing required a, b, c` | parser-level §2/§3 columns absent |
| `Row N: unknown category "x"` | value outside §3 |
| `Row N: images are required …` | image column empty or unparseable |
| `Title: <validation message>` | the product was assembled but the model refused it — §3 rules, reported per field |
| <code>\`\` is not a valid enum value for path \`gender\`</code> | seen before the blank-value fix: an empty cell arrived as `""` (or the literal `"undefined"`) and was validated as a value. Blank optional cells are stored as absent now |
| `No file uploaded` | the multipart field must be named `file` |
| `No rows could be imported…` | nothing survived; `errors[]` says why |
