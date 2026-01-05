import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { CartProvider, useCart } from "./CartContext";

const OCEAN_THEME = {
  primary: "#2563EB",
  secondary: "#F59E0B",
  background: "#f9fafb",
  surface: "#ffffff",
  text: "#111827",
};

// A small, pleasant set of sample foods to keep the app functional without a backend.
const SAMPLE_MENU = [
  {
    id: "classic-burger",
    name: "Classic Burger",
    description: "Beef patty, cheddar, lettuce, tomato, house sauce.",
    price: 11.99,
    tags: ["Burgers"],
    prepMins: 18,
  },
  {
    id: "crispy-chicken-sandwich",
    name: "Crispy Chicken Sandwich",
    description: "Crispy chicken, slaw, pickles, spicy mayo.",
    price: 12.49,
    tags: ["Sandwiches", "Spicy"],
    prepMins: 16,
  },
  {
    id: "margherita-pizza",
    name: "Margherita Pizza",
    description: "San Marzano tomato, mozzarella, basil, olive oil.",
    price: 14.5,
    tags: ["Pizza", "Vegetarian"],
    prepMins: 22,
  },
  {
    id: "bbq-chicken-pizza",
    name: "BBQ Chicken Pizza",
    description: "Smoky BBQ sauce, chicken, red onion, cilantro.",
    price: 15.75,
    tags: ["Pizza"],
    prepMins: 24,
  },
  {
    id: "salmon-bowl",
    name: "Salmon Power Bowl",
    description: "Seared salmon, quinoa, avocado, greens, citrus vinaigrette.",
    price: 13.95,
    tags: ["Bowls", "Gluten-Free"],
    prepMins: 15,
  },
  {
    id: "veggie-bowl",
    name: "Rainbow Veggie Bowl",
    description: "Roasted veg, chickpeas, brown rice, tahini drizzle.",
    price: 12.25,
    tags: ["Bowls", "Vegan"],
    prepMins: 14,
  },
  {
    id: "caesar-salad",
    name: "Caesar Salad",
    description: "Romaine, parmesan, croutons, classic Caesar dressing.",
    price: 9.5,
    tags: ["Salads"],
    prepMins: 10,
  },
  {
    id: "fries",
    name: "Sea-Salt Fries",
    description: "Crispy fries with sea salt. Add aioli on checkout.",
    price: 4.25,
    tags: ["Sides"],
    prepMins: 8,
  },
  {
    id: "cold-brew",
    name: "Cold Brew",
    description: "Smooth, bold cold brew with optional oat milk.",
    price: 4.95,
    tags: ["Drinks"],
    prepMins: 3,
  },
];

function formatMoney(amount) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(amount);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function safeParseJson(maybeJson, fallback) {
  try {
    const parsed = JSON.parse(maybeJson);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function findMenuItem(itemId) {
  return SAMPLE_MENU.find((m) => m.id === itemId) || null;
}

function AppContent() {
  const [theme, setTheme] = useState("light");
  const [cartOpen, setCartOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("All");

  const { items: cartItems, itemsCount: cartCount, subtotal: cartSubtotal, promo, promoDiscount, fees: cartFees, total: cartTotal, addItem, incrementItem, decrementItem, removeItem, clearCart, applyPromo, clearPromo } =
    useCart();

  const [order, setOrder] = useState(() => {
    const saved = window.localStorage.getItem("food_order_last_order_v1");
    return saved ? safeParseJson(saved, null) : null;
  });

  // checkout fields
  const [customerName, setCustomerName] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [promoInput, setPromoInput] = useState("");
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const progressTimerRef = useRef(null);

  const apiBase =
    process.env.REACT_APP_API_BASE ||
    process.env.REACT_APP_BACKEND_URL ||
    ""; // future backend integration
  const wsUrl = process.env.REACT_APP_WS_URL || ""; // future real-time tracking

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Persist order
  useEffect(() => {
    window.localStorage.setItem("food_order_last_order_v1", JSON.stringify(order));
  }, [order]);

  // Drive a simple “tracking” simulation on the client (no backend required).
  useEffect(() => {
    if (!order || order.status === "Delivered" || order.status === "Cancelled") {
      if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
      return;
    }

    if (progressTimerRef.current) return;

    progressTimerRef.current = window.setInterval(() => {
      setOrder((prev) => {
        if (!prev) return prev;
        const now = Date.now();
        const elapsed = now - prev.createdAt;

        // 0-30s: Confirmed, 30-75s: Preparing, 75-120s: Out for delivery, then Delivered
        let status = prev.status;
        if (elapsed < 30_000) status = "Confirmed";
        else if (elapsed < 75_000) status = "Preparing";
        else if (elapsed < 120_000) status = "Out for delivery";
        else status = "Delivered";

        const progress = clamp(Math.round((elapsed / 120_000) * 100), 0, 100);

        if (status === prev.status && progress === prev.progress) return prev;
        return { ...prev, status, progress };
      });
    }, 750);

    return () => {
      if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    };
  }, [order]);

  const tags = useMemo(() => {
    const set = new Set();
    SAMPLE_MENU.forEach((i) => i.tags.forEach((t) => set.add(t)));
    return ["All", ...Array.from(set).sort()];
  }, []);

  const filteredMenu = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SAMPLE_MENU.filter((item) => {
      const matchesQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q));
      const matchesTag = activeTag === "All" || item.tags.includes(activeTag);
      return matchesQuery && matchesTag;
    });
  }, [query, activeTag]);

  // PUBLIC_INTERFACE
  function toggleTheme() {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }

  // PUBLIC_INTERFACE
  function addToCart(itemId) {
    const item = findMenuItem(itemId);
    if (!item) return;
    addItem(item);
    setCartOpen(true);
  }

  function canCheckout() {
    return cartItems.length > 0 && customerName.trim().length > 0 && deliveryAddress.trim().length > 5;
  }

  // PUBLIC_INTERFACE
  async function placeOrder() {
    if (!canCheckout() || isPlacingOrder) return;

    setIsPlacingOrder(true);
    try {
      const payload = {
        customerName: customerName.trim(),
        deliveryAddress: deliveryAddress.trim(),
        notes: notes.trim(),
        paymentMethod,
        items: cartItems.map((it) => ({
          itemId: it.itemId,
          name: it.name,
          unitPrice: it.unitPrice,
          quantity: it.quantity,
        })),
        pricing: {
          subtotal: cartSubtotal,
          promoCode: promo.code || null,
          promoDiscount,
          ...cartFees,
          total: cartTotal,
        },
      };

      // Optional future backend: if REACT_APP_API_BASE is set, attempt POST.
      // If it fails or isn't configured, we fall back to a local simulated order.
      let createdOrder = null;
      if (apiBase) {
        try {
          const res = await fetch(`${apiBase.replace(/\/$/, "")}/orders`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (res.ok) createdOrder = await res.json();
        } catch {
          // ignore and fall back
        }
      }

      const orderId =
        (createdOrder && (createdOrder.id || createdOrder.orderId)) ||
        `ORD-${Math.random().toString(36).slice(2, 7).toUpperCase()}-${Date.now().toString().slice(-4)}`;

      setOrder({
        id: orderId,
        createdAt: Date.now(),
        status: "Confirmed",
        progress: 3,
        customerName: payload.customerName,
        deliveryAddress: payload.deliveryAddress,
        notes: payload.notes,
        paymentMethod: payload.paymentMethod,
        items: payload.items,
        pricing: payload.pricing,
        // Surface env vars for debugging/verification without breaking preview.
        meta: { apiBase: apiBase || null, wsUrl: wsUrl || null },
      });

      // Reset cart but keep checkout fields for convenience
      clearCart();
      setCartOpen(false);
    } finally {
      setIsPlacingOrder(false);
    }
  }

  // PUBLIC_INTERFACE
  function startNewOrder() {
    setOrder(null);
  }

  // Accessibility: close cart with Escape
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") setCartOpen(false);
    }
    if (cartOpen) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cartOpen]);

  return (
    <div className="App">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="topbar">
        <div className="topbar__inner">
          <div className="brand">
            <div className="brand__mark" aria-hidden="true">
              O
            </div>
            <div className="brand__text">
              <div className="brand__name">OceanEats</div>
              <div className="brand__tagline">Order fresh, track fast.</div>
            </div>
          </div>

          <nav className="topbar__actions" aria-label="Primary">
            <button
              className="btn btn-ghost"
              onClick={() => {
                const el = document.getElementById("tracking");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              type="button"
            >
              Order status
            </button>

            <button
              className="btn btn-ghost"
              onClick={toggleTheme}
              type="button"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              title="Toggle theme"
            >
              {theme === "light" ? "Dark" : "Light"}
            </button>

            <button
              className="btn btn-primary cart-button"
              onClick={() => setCartOpen(true)}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={cartOpen ? "true" : "false"}
            >
              Cart
              {cartCount > 0 ? <span className="cart-badge">{cartCount}</span> : null}
            </button>
          </nav>
        </div>
      </header>

      <main id="main" className="page">
        <section className="hero">
          <div className="hero__content">
            <h1 className="hero__title">Browse the menu</h1>
            <p className="hero__subtitle">
              A clean, modern ordering flow with cart management and order tracking — styled in Ocean
              Professional.
            </p>

            <div className="searchRow" role="search">
              <label className="sr-only" htmlFor="search">
                Search menu items
              </label>
              <input
                id="search"
                className="input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search burgers, bowls, pizza..."
                type="search"
              />

              <div className="tagPills" aria-label="Filter by category">
                {tags.map((t) => (
                  <button
                    key={t}
                    className={`pill ${t === activeTag ? "pill--active" : ""}`}
                    onClick={() => setActiveTag(t)}
                    type="button"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="hero__hint">
              <span className="hint-dot" aria-hidden="true" />
              Tip: Click “Cart” anytime to checkout. Try promo <code>OCEAN10</code> to verify persistence.
            </div>
          </div>
        </section>

        <section className="layout">
          <section className="menu" aria-label="Menu items">
            <div className="menu__header">
              <h2 className="section-title">Menu</h2>
              <div className="section-meta">
                {filteredMenu.length} item{filteredMenu.length === 1 ? "" : "s"} shown
              </div>
            </div>

            <div className="grid">
              {filteredMenu.map((item) => (
                <article key={item.id} className="card">
                  <div className="card__top">
                    <div className="card__titleRow">
                      <h3 className="card__title">{item.name}</h3>
                      <div className="price">{formatMoney(item.price)}</div>
                    </div>
                    <p className="card__desc">{item.description}</p>
                    <div className="card__chips" aria-label="Item tags">
                      {item.tags.map((t) => (
                        <span key={t} className="chip">
                          {t}
                        </span>
                      ))}
                      <span className="chip chip--muted">{item.prepMins} min</span>
                    </div>
                  </div>

                  <div className="card__actions">
                    <button className="btn btn-primary" onClick={() => addToCart(item.id)} type="button">
                      Add to cart
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => {
                        setActiveTag("All");
                        setQuery(item.name);
                      }}
                      type="button"
                    >
                      Find similar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="tracking" id="tracking" aria-label="Order tracking">
            <div className="tracking__card">
              <div className="tracking__header">
                <h2 className="section-title">Order tracking</h2>
                <div className="section-meta">{order ? `Order #${order.id}` : "No active order"}</div>
              </div>

              {!order ? (
                <div className="empty">
                  <p className="empty__title">Place an order to see live status.</p>
                  <p className="empty__desc">
                    This demo simulates status updates locally. If you later connect a backend, set{" "}
                    <code>REACT_APP_API_BASE</code> to post orders.
                  </p>

                  <div className="envHint">
                    <div className="envHint__row">
                      <span className="envHint__k">API</span>
                      <span className="envHint__v">{apiBase || "Not configured"}</span>
                    </div>
                    <div className="envHint__row">
                      <span className="envHint__k">WS</span>
                      <span className="envHint__v">{wsUrl || "Not configured"}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="order">
                  <div className="order__statusRow">
                    <div className="statusPill">{order.status}</div>
                    <div className="order__eta">{order.status === "Delivered" ? "Enjoy your meal!" : "Updating…"}</div>
                  </div>

                  <div className="progress">
                    <div className="progress__bar" aria-hidden="true">
                      <div className="progress__fill" style={{ width: `${order.progress}%` }} />
                    </div>
                    <div className="progress__meta">
                      <span>Progress</span>
                      <span>{order.progress}%</span>
                    </div>
                  </div>

                  <div className="order__summary">
                    <div className="order__line">
                      <span>Customer</span>
                      <span className="order__value">{order.customerName}</span>
                    </div>
                    <div className="order__line">
                      <span>Address</span>
                      <span className="order__value">{order.deliveryAddress}</span>
                    </div>
                  </div>

                  <div className="order__items" aria-label="Ordered items">
                    {order.items.map((it) => (
                      <div key={it.itemId} className="miniRow">
                        <div className="miniRow__left">
                          <div className="miniRow__name">{it.name}</div>
                          <div className="miniRow__meta">
                            {it.quantity} × {formatMoney(it.unitPrice)}
                          </div>
                        </div>
                        <div className="miniRow__right">{formatMoney(it.quantity * it.unitPrice)}</div>
                      </div>
                    ))}
                  </div>

                  <div className="totals">
                    <div className="totals__row">
                      <span>Subtotal</span>
                      <span>{formatMoney(order.pricing.subtotal)}</span>
                    </div>

                    {order.pricing.promoDiscount ? (
                      <div className="totals__row">
                        <span>
                          Promo {order.pricing.promoCode ? <span style={{ fontWeight: 900 }}>{order.pricing.promoCode}</span> : null}
                        </span>
                        <span>-{formatMoney(order.pricing.promoDiscount)}</span>
                      </div>
                    ) : null}

                    <div className="totals__row">
                      <span>Fees</span>
                      <span>{formatMoney(order.pricing.serviceFee + order.pricing.deliveryFee)}</span>
                    </div>
                    <div className="totals__row">
                      <span>Tax</span>
                      <span>{formatMoney(order.pricing.tax)}</span>
                    </div>
                    <div className="totals__row totals__row--strong">
                      <span>Total</span>
                      <span>{formatMoney(order.pricing.total)}</span>
                    </div>
                  </div>

                  <div className="order__actions">
                    <button className="btn btn-ghost" type="button" onClick={startNewOrder}>
                      Clear
                    </button>
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={() => setCartOpen(true)}
                      disabled={cartItems.length === 0}
                      title={cartItems.length === 0 ? "Cart is empty" : "Open cart"}
                    >
                      Open cart
                    </button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </section>

        <footer className="footer">
          <div className="footer__inner">
            <div className="footer__left">
              <div className="footer__title">OceanEats</div>
              <div className="footer__meta">Modern food ordering UI — React + vanilla CSS.</div>
            </div>
            <div className="footer__right">
              <a className="footer__link" href="https://react.dev" target="_blank" rel="noreferrer">
                React docs
              </a>
            </div>
          </div>
        </footer>
      </main>

      {/* Cart Drawer */}
      <div className={`drawerOverlay ${cartOpen ? "drawerOverlay--open" : ""}`} aria-hidden={!cartOpen}>
        <div
          className={`drawer ${cartOpen ? "drawer--open" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label="Shopping cart"
        >
          <div className="drawer__header">
            <div>
              <div className="drawer__title">Your cart</div>
              <div className="drawer__subtitle">
                {cartItems.length === 0 ? "Empty" : `${cartCount} item${cartCount === 1 ? "" : "s"}`}
              </div>
            </div>

            <button className="iconBtn" onClick={() => setCartOpen(false)} type="button" aria-label="Close cart">
              ×
            </button>
          </div>

          <div className="drawer__content">
            {cartItems.length === 0 ? (
              <div className="empty">
                <p className="empty__title">Your cart is empty.</p>
                <p className="empty__desc">Add a few items from the menu to place an order.</p>
              </div>
            ) : (
              <>
                <div className="cartList" aria-label="Cart items">
                  {cartItems.map((it) => (
                    <div key={it.itemId} className="cartItem">
                      <div className="cartItem__main">
                        <div className="cartItem__name">{it.name}</div>
                        <div className="cartItem__meta">
                          {formatMoney(it.unitPrice)} each • {formatMoney(it.unitPrice * it.quantity)}
                        </div>
                      </div>

                      <div className="cartItem__actions">
                        <button
                          className="qtyBtn"
                          onClick={() => decrementItem(it.itemId)}
                          type="button"
                          aria-label={`Decrease quantity of ${it.name}`}
                        >
                          −
                        </button>
                        <div className="qty" aria-label={`Quantity ${it.quantity}`}>
                          {it.quantity}
                        </div>
                        <button
                          className="qtyBtn"
                          onClick={() => incrementItem(it.itemId)}
                          type="button"
                          aria-label={`Increase quantity of ${it.name}`}
                        >
                          +
                        </button>

                        <button
                          className="linkDanger"
                          onClick={() => removeItem(it.itemId)}
                          type="button"
                          aria-label={`Remove ${it.name} from cart`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="checkout">
                  <h3 className="checkout__title">Checkout</h3>

                  <div className="formGrid">
                    <div className="field">
                      <label className="label" htmlFor="name">
                        Name
                      </label>
                      <input
                        id="name"
                        className="input"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Alex Johnson"
                        autoComplete="name"
                      />
                    </div>

                    <div className="field">
                      <label className="label" htmlFor="address">
                        Delivery address
                      </label>
                      <input
                        id="address"
                        className="input"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="123 Ocean Ave, Suite 4B"
                        autoComplete="street-address"
                      />
                    </div>

                    <div className="field field--full">
                      <label className="label" htmlFor="notes">
                        Notes (optional)
                      </label>
                      <textarea
                        id="notes"
                        className="textarea"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Allergies, instructions, gate code…"
                        rows={3}
                      />
                    </div>

                    <div className="field field--full">
                      <label className="label" htmlFor="promo">
                        Promo code
                      </label>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <input
                          id="promo"
                          className="input"
                          value={promoInput}
                          onChange={(e) => setPromoInput(e.target.value)}
                          placeholder="Try OCEAN10"
                          autoComplete="off"
                          aria-describedby="promoHelp"
                        />
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => applyPromo(promoInput)}
                          aria-label="Apply promo code"
                        >
                          Apply
                        </button>
                      </div>
                      <div id="promoHelp" className="smallNote" style={{ marginTop: 8 }}>
                        {promo.code ? (
                          <span>
                            Applied: <strong>{promo.code}</strong>{" "}
                            {promo.discountRate > 0 ? `(−${Math.round(promo.discountRate * 100)}%)` : "(Not valid)"}
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => {
                                clearPromo();
                                setPromoInput("");
                              }}
                              style={{ marginLeft: 10, padding: "8px 10px" }}
                            >
                              Clear
                            </button>
                          </span>
                        ) : (
                          <span>Promo codes persist on reload. Example: <code>OCEAN10</code></span>
                        )}
                      </div>
                    </div>

                    <div className="field field--full">
                      <label className="label" htmlFor="payment">
                        Payment
                      </label>
                      <div className="segmented" role="radiogroup" aria-label="Payment method">
                        {[
                          { id: "card", label: "Card" },
                          { id: "cash", label: "Cash" },
                        ].map((pm) => (
                          <button
                            key={pm.id}
                            className={`segBtn ${paymentMethod === pm.id ? "segBtn--active" : ""}`}
                            onClick={() => setPaymentMethod(pm.id)}
                            type="button"
                            role="radio"
                            aria-checked={paymentMethod === pm.id ? "true" : "false"}
                          >
                            {pm.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="totals totals--cart">
                    <div className="totals__row">
                      <span>Subtotal</span>
                      <span>{formatMoney(cartSubtotal)}</span>
                    </div>

                    {promoDiscount > 0 ? (
                      <div className="totals__row">
                        <span>Promo {promo.code ? <span style={{ fontWeight: 900 }}>{promo.code}</span> : ""}</span>
                        <span>-{formatMoney(promoDiscount)}</span>
                      </div>
                    ) : null}

                    <div className="totals__row">
                      <span>Service fee</span>
                      <span>{formatMoney(cartFees.serviceFee)}</span>
                    </div>
                    <div className="totals__row">
                      <span>Delivery fee</span>
                      <span>{formatMoney(cartFees.deliveryFee)}</span>
                    </div>
                    <div className="totals__row">
                      <span>Tax</span>
                      <span>{formatMoney(cartFees.tax)}</span>
                    </div>
                    <div className="totals__row totals__row--strong">
                      <span>Total</span>
                      <span>{formatMoney(cartTotal)}</span>
                    </div>
                  </div>

                  <div className="checkout__actions">
                    <button className="btn btn-ghost" type="button" onClick={clearCart}>
                      Clear cart
                    </button>
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={placeOrder}
                      disabled={!canCheckout() || isPlacingOrder}
                      aria-disabled={!canCheckout() || isPlacingOrder ? "true" : "false"}
                      title={
                        canCheckout()
                          ? ""
                          : "Add items, then enter a name and a valid delivery address to place an order."
                      }
                    >
                      {isPlacingOrder ? "Placing…" : "Place order"}
                    </button>
                  </div>

                  <div className="smallNote">
                    {apiBase ? (
                      <span>
                        Backend enabled via <code>REACT_APP_API_BASE</code>. If the POST fails, this demo falls back to a
                        local order.
                      </span>
                    ) : (
                      <span>
                        Demo mode: no backend configured. Set <code>REACT_APP_API_BASE</code> later to connect.
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* overlay click target */}
        <button
          className="drawerOverlay__clickCatcher"
          onClick={() => setCartOpen(false)}
          type="button"
          aria-label="Close cart overlay"
          tabIndex={cartOpen ? 0 : -1}
        />
      </div>

      {/* Inline theme tokens (so the CSS can use the Ocean palette cleanly) */}
      <style>{`
        :root {
          --ocean-primary: ${OCEAN_THEME.primary};
          --ocean-secondary: ${OCEAN_THEME.secondary};
          --ocean-bg: ${OCEAN_THEME.background};
          --ocean-surface: ${OCEAN_THEME.surface};
          --ocean-text: ${OCEAN_THEME.text};
        }
      `}</style>
    </div>
  );
}

// PUBLIC_INTERFACE
function App() {
  /** App entry component that wires providers and renders the ordering experience. */
  return (
    <CartProvider>
      <AppContent />
    </CartProvider>
  );
}

export default App;
