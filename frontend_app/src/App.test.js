import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders menu heading", () => {
  render(<App />);
  expect(screen.getByText(/browse the menu/i)).toBeInTheDocument();
});
