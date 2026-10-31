# Kakeibo (家計簿) — Personal Finance Tracker

Kakeibo is a React-based personal finance tracker for recording income and expenses, organising transactions by category, and reviewing spending activity through a simple dashboard and searchable transaction list.



## Problem Statement

Keeping track of day-to-day spending can become difficult when transactions are scattered across different places. Kakeibo provides a simple interface for users to:

- record income and expenses;
- organise transactions using custom categories;
- review monthly financial activity;
- search, filter and sort transaction history; and
- maintain category information used by transactions.

The target user is someone who wants a lightweight personal budgeting and expense-tracking tool without the complexity of a full accounting application.

## Main Features

- Dashboard summary of income, expenses, balance and recent transactions
- Monthly trend showing spending by category in a pie chart
- Transaction list with category, type, amount and date
- Add new transactions using a controlled form
- Edit existing transactions
- Delete transactions
- Search transactions by description
- Filter by transaction type, category and month
- Sort transactions by date or amount
- Category management
- Custom category emoji/icon selection
- Prevent deletion of categories that are already assigned to transactions
- Responsive layouts for selected views; full mobile-width support remains to be verified
- Loading and error handling for API operations
- Configurable API data source using local JSON Server or a hosted MockAPI endpoint

### Bonus Challenges: Easy & Medium

#### Easy

- [x] Search or sort on a list view
- [x] Spinner while async data loads
- [x] Responsive down to mobile screen widths

#### Medium

- [x] Edit an existing transaction
- [x] Mock authentication flow
- [x] Automated tests with React Testing Library
- [x] Optimistic UI updates for create, update and delete, including success, rollback and delete-order tests

### Demo Login Credentials

Authentication is mocked in the frontend for this school project; it is not production authentication.

| Email | Password |
|---|---|
| `victor@team3.io` | `password123` |
| `alex@team3.io` | `password123` |

## Technology Stack

| Technology | Purpose |
|---|---|
| React | Component-based user interface |
| Vite | Development and production build tooling |
| JavaScript | Application logic |
| React Router | Client-side routing and navigation |
| React Context API | Shared application state |
| `useReducer` | Transaction state management |
| `useState` / `useEffect` / `useMemo` | Local state, data fetching and derived state |
| Yup | Form validation |
| JSON Server | Local mock REST API backed by `data/db.json` |
| MockAPI | Optional hosted mock backend when configured with its API base URL |
| CSS Modules | Component/page styling |
| Lucide React | UI icons |
| Git / GitHub | Source control and team collaboration |
| Netlify | Public deployment — `https://aie1f-team-3-kakeibo.netlify.app` |

## Data Model

Kakeibo keeps categories separate from transactions. The transaction references a category using `categoryId`; the transaction type (`income` or `expense`) is defined by the category.

### Category

```json
{
  "id": "food",
  "name": "Food",
  "type": "expense",
  "icon": "🍴"
}
```

### Transaction

```json
{
  "id": "18",
  "date": "2026-09-19",
  "description": "Movie Ticket",
  "categoryId": "entertainment",
  "amount": 16.95
}
```

This avoids duplicating the transaction type in both the category and transaction records.

### Receipt Purchases

Veryfi receipt scanning now returns line items as well as the merchant, date and
total. On New Transaction, each purchase can be reviewed, corrected, added or
removed and assigned an expense category before saving. If no items are returned,
the existing total-only form remains available. Jev can now suggest categories;
the user reviews or corrects them before saving.

Each imported purchase is one transaction. Purchases share a `receiptId` and have
individual `receiptLineId` values. The receipt total is metadata, not an additional
transaction, so dashboard expenses are not double-counted. Original/reviewed line
amounts, allocated adjustments, quantity, unit price, merchant, receipt currency,
subtotal, tax and discount are retained as metadata. Receipt metadata is preserved
when a purchase is edited, but editing or deleting purchases later does not
automatically rebalance the other purchases from that receipt.

#### Tax and Discount Policy

The default is a personal-budgeting, gross-cost policy:

- Use the printed line total, not quantity multiplied by unit price. The printed
  total can already include a line discount or tax.
- Compare the reviewed item totals with the receipt's final total. Their difference
  is the net adjustment, which may include taxes, discounts, tips, fees or rounding.
- After explicit user approval, distribute that net adjustment proportionally to
  reviewed line totals. Largest-remainder rounding assigns leftover cents
  deterministically so all saved purchases sum exactly to the receipt total.
- Printed tax and discount fields are reference metadata; they are not added or
  deducted again. Tax-inclusive prices therefore do not receive tax twice.
- An unexplained difference may indicate missing or misread purchases. Correct the
  rows before approving allocation. A negative coupon/discount-only row must be
  removed and accounted for in the net adjustment, or folded into the applicable
  purchase total. Zero-cost purchases are supported; negative purchase/refund
  transactions are not supported by this import workflow.
- Money uses two-decimal minor units. There is no currency conversion or
  multi-currency dashboard; use receipts in the budgeting currency. Other currency
  precision rules are not supported yet.

Common alternatives are item-specific allocation (for restricted coupons or
different tax rates), separate fee/tax transactions, and net-cost accounting with
recoverable GST/VAT recorded separately. Those require an explicit policy and
additional accounting fields; proportional allocation is not a tax-return or
recoverable-tax calculation.

#### Saving and Recovery

The configured JSON Server/MockAPI endpoint must persist and return receipt
metadata, including `receiptId` and `receiptLineId`. For MockAPI, add these and the
other receipt metadata fields to the transactions resource schema if needed.

Purchases are saved sequentially, not atomically. A failed receipt import keeps
confirmed purchases and allows retrying only the remaining rows, with receipt
editing locked. After a failed POST, the app queries transactions to detect a
purchase that was committed despite a lost response. If verification also fails,
retry is blocked and the user must check Transactions before importing again.
This assumes read-after-write consistency from the demo backend. A production
backend should provide transactional batch saves and server-side idempotency.
Uploading the same receipt as a new import is not deduplicated across sessions.

#### Jev Category Suggestions

After scanning a receipt, select **Suggest Categories** to classify the reviewed
purchases using TypeSafe AI's Jev Choice API. One request contains one question per
purchase and the existing expense categories, plus an Unclassified option.
Income categories are never proposed. Up to 100 purchases and 254 expense
categories are supported per request.

Only the merchant text, purchase descriptions and category names/definitions are
sent to TypeSafe. Images, dates, purchase amounts and authentication information
are not included in the classification state. Calling this action sends receipt
text to an external provider and may incur API charges. Review TypeSafe's privacy
and retention terms before using personal receipts. There is no automatic API
call after upload and no automatic saving.

The initial policy prefills empty category fields when Jev confidence is at least
0.8 and the chosen option probability is at least 0.8. These are distinct metrics:
confidence measures separation from an even distribution; it is not a percentage
accuracy guarantee. Calibrate thresholds against labeled receipts before relying
on automatic prefilling. All purchases still require the final review checkbox.
Lower-confidence suggestions remain visible with **Needs review** and can be
explicitly accepted. Unclassified results leave the category blank.

Manual selections and explicitly accepted suggestions are never overwritten by a
new suggestion request. Refreshing suggestions replaces or clears previous
automatic prefills. Changing a purchase description or merchant invalidates its
AI suggestions and related AI-selected category, while keeping manual choices.
Unavailable credentials, provider errors and invalid responses leave manual
category selection available. Categories may optionally include a `description`
field in the backing API to distinguish overlapping category names; the current
category editor does not edit these definitions.

Saved purchases include `receiptCategorySource` (`manual`, `jev`, or
`jev-reviewed`) and `receiptCategorySuggestion` with model, proposed category,
confidence and chosen-option probability. Configure these metadata fields in
MockAPI as needed. They capture import-time provenance; subsequent manual edits
do not rewrite the original suggestion.

Configure the following **server-only** variables in `.env` for the local
`npm run receipt-api` command, or in the Netlify Functions environment:

```env
TYPESAFE_API_KEY=YOUR_KEY
TYPESAFE_MODEL=jev-latest
TYPESAFE_MIN_CONFIDENCE=0.8
```

Obtain an API key from https://console.typesafe.ai/keys and enter it locally; do
not commit it or give it a `VITE_` prefix. Restart the receipt API after setting
the variables. The current script loads `.env`, not `.env.local`. The default
model alias can be replaced with a supported pinned version for reproducibility.

The local and deployed clients both call `POST /api/receipt/categorize`; the
local route is handled by the existing receipt API on port 3002, and Netlify uses
the `receipt-categorize` function. Specific API redirects must precede the SPA
fallback in both deployment redirect configurations. The API key never enters
the frontend bundle. Provider contract and UI tests use mocked responses; live
Jev accuracy, credentials and deployment are not verified by those tests.
The demo endpoint has no production authentication or billing rate limits; add
both before exposing a paid provider key to public traffic.

## Application Structure

The application is organised into pages, reusable components, context and reducer logic.

```text
src/
├── components/
├── contexts/
├── pages/
├── reducers/
├── App.jsx
└── main.jsx
```

Important application areas include:

- **Dashboard** — financial summary and recent activity
- **Transactions** — list, search, filter, sort, create, edit and delete
- **Categories** — list, search, create and guarded delete
- **TransactionContext** — shared transaction/category state and API operations
- **transactionReducer** — reducer actions for transaction state changes

## Backend / API

The app uses a configurable REST API base URL. For local development, use the included **JSON Server** and `data/db.json`. A hosted **MockAPI** endpoint can be used for a public demo by setting the same environment variable to that endpoint.

Resources:

```text
/categories
/transactions
```

The local API base URL is configured using a Vite environment variable:

```env
VITE_API_BASE_URL=http://localhost:3000
```

The application reads it with:

```js
export const API_BASE = import.meta.env.VITE_API_BASE_URL;
```

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/magcal90/aie1f-frontend-development-project.git
cd aie1f-frontend-development-project
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure the local API environment variable

Copy the committed example file to `.env.local`:

```powershell
Copy-Item .env.example .env.local
```

The example config points to the local JSON Server at `http://localhost:3000`.

### 4. Start the local API

In one terminal, start JSON Server:

```bash
npm run server
```
This serves the `/categories` and `/transactions` resources from `data/db.json`.


In a separate terminal, start Veryfi Server
```bash
npm run receipt-api
```
This activates the receipt scanning service on local server.


### 5. Start the frontend

In a new terminal, run:

```bash
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

### 6. Run tests and checks

```bash
npm test
npm run lint
npm run build
```

### 7. Preview the production build locally

```bash
npm run build
npm run preview
```

Vite prints the local preview URL in the terminal.

## Mobile Receipt Test

The Expo app in `mobile/` is a receipt-scanning companion. Test camera capture on
a physical iOS or Android device with Expo Go; a web export only tests the web
fallback and does not verify native camera permissions.

### Configure the APIs

Install the mobile dependencies from the repository root:

```powershell
npm.cmd --prefix mobile install
```

Copy the mobile URL template to a local, ignored environment file:

```powershell
Copy-Item mobile/.env.example mobile/.env.local
```

Find the computer's active Wi-Fi IPv4 address with `ipconfig`. Replace
`YOUR_COMPUTER_LAN_IP` in `mobile/.env.local` with that address, for example:

```env
EXPO_PUBLIC_RECEIPT_API_URL=http://192.168.0.18:3002
EXPO_PUBLIC_TRANSACTION_API_URL=http://192.168.0.18:3000
```

The phone and computer must be on the same trusted Wi-Fi network. These are
addresses, not secrets. Never put Veryfi or TypeSafe API keys in an
`EXPO_PUBLIC_` variable; keep provider credentials in the root `.env` used by
the receipt server.

**Local-network limitation:** `server/receipt-api.js` currently binds to
`127.0.0.1`, which accepts connections only from the computer itself. A physical
phone cannot reach that address or the current local receipt API. Before using
these local URLs on a phone, make the receipt API listen on the computer's LAN
interface, or point `EXPO_PUBLIC_RECEIPT_API_URL` at a deployed, reachable
receipt API. Keep the local API limited to a trusted network: it has no
authentication and can use paid provider credentials. Stop it after testing.

The transaction API at port 3000 must also be reachable from the phone. If the
phone cannot load `http://YOUR_COMPUTER_LAN_IP:3000/categories`, check its bind
address and Windows Firewall's Private network rules. Do not expose either
development API to a public network.

### Start And Test

Start the transaction API and receipt API in separate terminals from the
repository root:

```powershell
npm.cmd run server
npm.cmd run receipt-api
```

The receipt server reads Veryfi and Jev credentials from the root `.env` file.
Only configure them if testing live provider calls; parser and category-suggestion
responses can otherwise be tested with mocked services. Never commit `.env`.

In another terminal, start Expo from the repository root:

```powershell
npm.cmd --prefix mobile start -- --lan
```

Open the project in Expo Go by scanning the QR code. Allow camera access, take a
receipt photo, and check the following:

- The captured image previews correctly and can be scanned.
- All purchases, quantities and line totals are editable; adding and removing
  purchases works.
- Categories load from the transaction API and can be selected manually.
- Jev suggestions prefill only confident results; uncertain or unclassified
  items remain reviewable. The final review is required before saving.
- Saved purchase amounts sum to the receipt total, with no extra transaction for
  the receipt total. Confirm each purchase appears in transaction history.
- If testing live providers, verify provider errors leave manual category entry
  available and never save without review.

Stop Expo and both local APIs after testing. The mobile app stores only API
addresses in `mobile/.env.local`; keep paid provider keys on the receipt server.

## Deployment

**Live application:** https://aie1f-team-3-kakeibo.netlify.app

Deployment platform: Netlify

Configure the following environment variable on the deployment platform before building:

```text
VITE_API_BASE_URL=https://YOUR-PROJECT.mockapi.io/api/v1
```

To run the VeryFi Receipt Scanner API - Create an account at https://www.veryfi.com and fill up these variables

```text
VERYFI_URL=https://api.veryfi.com/api/v8/partner/documents
VERYFI_CLIENT_ID=
VERYFI_USERNAME=
VERYFI_API_KEY=
```

## Screenshots
1. Login page   
![Login](docs/images/login.png) 

2. Dashboard
![Dashboard](docs/images/dashboard.png)
![Dashboard](docs/images/recenttransactions.png)
3. Transaction list with search/filter controls
![Transactions](docs/images/transactions.png)
4. Add/Edit Transaction form
![New Transactions](docs/images/newtransaction.png)
5. Edit Transaction form
![Edit Transaction](docs/images/edittransaction.png)
6. Category List
![Category List](docs/images/categories.png)
7. Responsive layouts down to mobile widths​
![Responsive Layouts](docs/images/responsive.png)
8. Testing
![Testing](docs/images/testing.png)

## Team

- Ho Wai Hong
- Choo Yeow Hwee
- Prancia Toh Wai Yee

### Work Division

The following GitHub-handle ownership reflects the project workflow discussed during development. **Before submission, map each handle to the correct full name.**

| Member | GitHub handle | Main areas of contribution |
|---|---|---|
| Prancia Toh Wai Yee | `prantwy` | Dashboard, summary/derived state, recent transaction presentation, Responsive down to mobile screen widths |
| Choo Yeow Hwee | `magcal90` | Vite/app scaffold, routing/integration, transaction list, search/filter/sort, category management, API/environment integration, Optimistic UI updates for create/update/delete |
| Ho Wai Hong | `whho21` | Add Transaction controlled form, validation and create/POST flow |


## Git Workflow

The team used a shared GitHub repository with an integration workflow:

```text
main
  ↑
develop
  ↑
feature/*
```

Day-to-day work was done on feature branches and integrated through `develop` before moving stable work to `main`.

## Key Technical Decisions

### Shared state with Context + reducer

Transaction and category data are shared by multiple routes, so the application uses Context for access and a reducer for transaction state changes.

### Derived transaction type

A transaction stores only `categoryId`. The category defines whether the transaction is income or expense. This keeps one source of truth for transaction type.

### Local JSON Server and hosted API

Local development uses JSON Server with `data/db.json` so CRUD operations work without an external account. A hosted MockAPI endpoint can be configured for a public demo using `VITE_API_BASE_URL`.

### Environment-based API configuration

`VITE_API_BASE_URL` keeps the API location out of component code and allows the same source code to be used in local development and deployment.

### Optimistic UI

For create, update and delete, the UI changes immediately while the request runs. Successful requests confirm the server response; failed requests restore the prior state. Tests cover delayed success, rejected requests and delete rollback ordering. Temporary UI metadata such as `pending` stays in React state and is not sent to the API.

## Challenges and Learnings

### Challenges

- Integrating work from multiple feature branches
- Keeping shared transaction and category state consistent across routes
- Normalising category data so transaction type is derived from the category
- Preventing deletion of categories already used by transactions
- Coordinating API data returned by MockAPI with frontend state
- Designing rollback behaviour for optimistic create/update/delete operations
- Maintaining responsive and consistent styling across multiple pages

### Learnings

- Breaking a React application into smaller components and pages
- Using controlled forms and Yup validation
- Managing shared state with Context and `useReducer`
- Using `useEffect` for API data fetching
- Computing derived state for filtering, sorting and financial summaries
- Implementing client-side routing with React Router
- Using feature branches, rebasing and pull requests in a team workflow

## AI and Tools Disclosure

- **GitHub Copilot** — code completion, implementation suggestions and debugging support, explanation of React concepts, code review, data-model refinement
- **ChatGPT** Git workflow guidance, README/presentation drafting.


### External References / Adapted Material

- NTU PACE React lesson materials
- https://react.dev/reference/react
- https://lucide.dev/icons/

## Repository

https://github.com/magcal90/aie1f-frontend-development-project
