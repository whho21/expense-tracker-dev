import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { TransactionContext } from "../contexts/TransactionContext";
import TransactionsPage from "../pages/TransactionsPage";

function renderTransactionsPage(valueOverrides = {}) {
  const value = {
    displayedTransactions: [
      {
        id: 1,
        date: "2026-09-14",
        description: "Salary",
        category: "Salary",
        type: "income",
        amount: 2500,
      },
    ],
    loading: false,
    error: null,
    deleteTransaction: vi.fn(),
    searchTerm: "",
    setSearchTerm: vi.fn(),
    typeFilter: "all",
    setTypeFilter: vi.fn(),
    categoryFilter: "all",
    setCategoryFilter: vi.fn(),
    monthFilter: "all",
    setMonthFilter: vi.fn(),
    sortBy: "date-desc",
    setSortBy: vi.fn(),
    categories: [],
    transactions: [],
    ...valueOverrides,
  };

  return render(
    <MemoryRouter>
      <TransactionContext.Provider value={value}>
        <TransactionsPage />
      </TransactionContext.Provider>
    </MemoryRouter>,
  );
}

describe("TransactionsPage", () => {
  it("renders the result count", () => {
    renderTransactionsPage();

    expect(screen.getByText("1 transaction found")).toBeInTheDocument();
  });

  it("offers CSV export for matching transactions and disables it for an empty result", () => {
    renderTransactionsPage();
    expect(screen.getByRole("button", { name: "Export transactions to CSV" })).toBeEnabled();
  });

  it("disables CSV export when there are no matching transactions", () => {
    renderTransactionsPage({ displayedTransactions: [] });
    expect(screen.getByRole("button", { name: "Export transactions to CSV" })).toBeDisabled();
  });

  it("shows the loading spinner while loading", () => {
    renderTransactionsPage({ loading: true, displayedTransactions: [] });

    expect(screen.getByTestId("spinner")).toBeInTheDocument();
  });

  it("shows an error message when loading fails", () => {
    renderTransactionsPage({
      error: "Network error",
      displayedTransactions: [],
      loading: false,
    });

    expect(
      screen.getByText(/Failed to load transactions: Network error/i),
    ).toBeInTheDocument();
  });
});
