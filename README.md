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
- PostgreSQL-backed transaction and category API with a one-time JSON Server data importer
- CSV export for the currently filtered transaction list

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
| PostgreSQL | Persistent storage for categories, transactions and receipt metadata |
| `pg` | Node.js PostgreSQL connection pool and parameterized queries |
| JSON Server | Optional legacy demo API used only for importing or comparing local data |
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

## PostgreSQL API

The app's `/transactions` and `/categories` REST routes are served by
`server/api.js` and stored in PostgreSQL. Transaction receipt attributes are
retained in a JSONB metadata column; the API returns those metadata properties at
the top level to preserve the existing web and Expo client contract. Amounts are
stored as `numeric(12, 2)` and category foreign keys prevent deleting a category
that is still assigned to a transaction.

The repository does not provision or host PostgreSQL. Create a database locally
or with a managed provider first. Before importing, back up any database that
already contains data. Keep the connection string in the ignored root `.env`
file; never commit it or put it in a `VITE_` or `EXPO_PUBLIC_` variable.

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
API_HOST=127.0.0.1
API_PORT=3000
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

#### Initial Setup And Demo Data Import

Run these commands from the repository root:

1. Copy `.env.example` to `.env` if you have not already, then replace the
  `DATABASE_URL` placeholder with the connection string for the database you
  just created. Keep `VITE_API_BASE_URL=http://localhost:3000` for local use.
2. Apply the initial schema. This creates the `categories` and `transactions`
  tables and their constraints and indexes:

  ```powershell
  npm.cmd run db:migrate
  ```

3. Optionally import the committed demo seed from `data/db.json`:

  ```powershell
  npm.cmd run db:import-json
  ```

  This is an upsert by record ID: matching category and transaction IDs are
  overwritten with the values from `data/db.json`, while other database rows
  are left in place. Prefer a new, empty database for the demo import. If the
  target already has real data, back it up and inspect ID collisions first.
4. Verify the tables and counts using your PostgreSQL client:

  ```sql
  SELECT count(*) FROM categories;
  SELECT count(*) FROM transactions;
  ```

5. Start the API and app using the local setup instructions below.

`db:import-json` reads only the checked-in `data/db.json`; it does not fetch or
import data from a hosted MockAPI account. If MockAPI currently contains the
latest transactions, export and back them up separately before switching. The
importer is intended for a one-time demo-data seed, not as a general migration
tool for arbitrary API data.

After schema setup, start the PostgreSQL API:

```powershell
npm.cmd run server
```

The default API URL remains `http://localhost:3000`, matching
`VITE_API_BASE_URL`. `npm run server:demo` retains the old JSON Server for
comparison or recovery, but new app data is written to PostgreSQL by `npm run
server`.

For Expo Go on a physical phone, set `API_HOST=0.0.0.0`, allow port 3000 through
Windows Firewall only on a trusted private network, and configure
`EXPO_PUBLIC_TRANSACTION_API_URL` in `mobile/.env.local` with the computer's LAN
IP. Native mobile requests do not use browser CORS; web origins must be listed in
`CORS_ORIGINS`. Never expose this unauthenticated development API to the public
internet. A deployed app needs the Node API hosted somewhere reachable, a
persistent PostgreSQL provider, production authentication, HTTPS, and narrowly
configured CORS origins. Netlify hosts the frontend and receipt functions here;
the PostgreSQL API is a separate Node service.

### CSV Export

Select **Export CSV** on the Transactions page to download the rows currently
shown after search, filter and sort. The file includes date, description,
category, type, amount, currency and merchant. Receipt-total metadata is not
exported as an additional transaction. Fields are quoted and escaped, and
spreadsheet formula prefixes are neutralized. An empty result set disables the
export button.

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

The PostgreSQL API persists and returns receipt metadata, including `receiptId`
and `receiptLineId`, in the transaction's JSONB metadata. The JSON seed importer
also preserves those fields when present in imported transaction records.

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
confidence and chosen-option probability. PostgreSQL stores these fields in
transaction JSONB metadata. They capture import-time provenance; subsequent
manual edits do not rewrite the original suggestion.

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

The app uses a configurable REST API base URL. The PostgreSQL API implements
`/categories` and `/transactions`; see [PostgreSQL API](#postgresql-api) for
database setup and the one-time importer for `data/db.json`.

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

### 3. Configure local environment variables

Copy the committed example to the ignored root `.env` file and set
`DATABASE_URL` to your PostgreSQL database:

```powershell
Copy-Item .env.example .env
```

The template's `VITE_API_BASE_URL` points to `http://localhost:3000`.

### 4. Prepare PostgreSQL and import demo data

Run these once for a fresh database, from the repository root:

```bash
npm run db:migrate
npm run db:import-json
```

### 5. Start the local APIs

In separate terminals, start PostgreSQL-backed transaction storage and the
receipt API:

```bash
npm run server
npm run receipt-api
```

### 6. Start the frontend

In a new terminal, run:

```bash
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

### 7. Run tests and checks

```bash
npm test
npm run lint
npm run build
```

### 8. Preview the production build locally

```bash
npm run build
npm run preview
```

Vite prints the local preview URL in the terminal.

## Deployment

**Live application:** https://aie1f-team-3-kakeibo.netlify.app

Deployment platform: Netlify

Set `VITE_API_BASE_URL` to the URL of your deployed PostgreSQL API before
building. Configure the API's `DATABASE_URL` and allowed `CORS_ORIGINS` on its
hosting platform. The Netlify frontend does not host `server/api.js`.

```env
VITE_API_BASE_URL=https://YOUR-POSTGRES-API.example.com
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

### PostgreSQL persistence and JSON import

The PostgreSQL API keeps transaction routes stable while moving persistence out
of the browser and JSON Server. The JSON seed importer preserves demo IDs and
receipt metadata; it can be rerun to upsert the same seed data. `VITE_API_BASE_URL`
continues to select the API host.

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
- Migrating seeded data from JSON Server into PostgreSQL while preserving IDs
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
