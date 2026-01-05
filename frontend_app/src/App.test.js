import { fireEvent, render, screen } from "@testing-library/react";
import App from "./App";

beforeEach(() => {
  window.localStorage.clear();
});

test("renders menu heading", () => {
  render(<App />);
  expect(screen.getByText(/browse the menu/i)).toBeInTheDocument();
});

test("applies promo code and restores it from localStorage on reload", () => {
  const { unmount } = render(<App />);

  // Add an item so totals are visible in the cart drawer.
  fireEvent.click(screen.getAllByRole("button", { name: /add to cart/i })[0]);

  // Apply promo code
  fireEvent.change(screen.getByLabelText(/promo code/i), { target: { value: "OCEAN10" } });
  fireEvent.click(screen.getByRole("button", { name: /apply promo code/i }));

  expect(screen.getByText(/applied:/i)).toBeInTheDocument();
  expect(screen.getByText(/OCEAN10/i)).toBeInTheDocument();

  // Unmount/remount to simulate reload and ensure promo rehydrates.
  unmount();
  render(<App />);

  // Open cart again
  fireEvent.click(screen.getByRole("button", { name: /^cart$/i }));
  expect(screen.getByText(/applied:/i)).toBeInTheDocument();
  expect(screen.getByText(/OCEAN10/i)).toBeInTheDocument();
});
