import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

/**
 * Cart storage versioning:
 * - v1 previously stored only an array of cart items.
 * - v2 stores an object { version, items, promo }.
 */
const CART_STORAGE_KEY_V1 = "food_order_cart_v1";
const CART_STORAGE_KEY_V2 = "food_order_cart_v2";
const CART_STORAGE_VERSION = 2;

const PROMO_STORAGE_KEY_V1 = "food_order_promo_v1";

const CartContext = createContext(null);

function safeParseJson(maybeJson, fallback) {
  try {
    const parsed = JSON.parse(maybeJson);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((it) => isPlainObject(it) && typeof it.itemId === "string")
    .map((it) => ({
      itemId: it.itemId,
      name: typeof it.name === "string" ? it.name : "",
      unitPrice: typeof it.unitPrice === "number" ? it.unitPrice : 0,
      quantity: typeof it.quantity === "number" ? it.quantity : 1,
      notes: typeof it.notes === "string" ? it.notes : "",
    }));
}

function sanitizePromo(promo) {
  if (!isPlainObject(promo)) return { code: "", discountRate: 0 };
  const code = typeof promo.code === "string" ? promo.code : "";
  const discountRate = typeof promo.discountRate === "number" ? promo.discountRate : 0;
  return {
    code,
    discountRate: Math.max(0, Math.min(0.5, discountRate)), // safety clamp
  };
}

function safeStorageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function loadCartState() {
  // Prefer v2 payload, fallback to v1 items-only, then promo-only.
  const savedV2 = safeStorageGet(CART_STORAGE_KEY_V2);
  if (savedV2) {
    const parsed = safeParseJson(savedV2, null);
    if (isPlainObject(parsed) && parsed.version === CART_STORAGE_VERSION) {
      return {
        items: sanitizeItems(parsed.items),
        promo: sanitizePromo(parsed.promo),
      };
    }
  }

  const savedItemsV1 = safeStorageGet(CART_STORAGE_KEY_V1);
  const items = savedItemsV1 ? sanitizeItems(safeParseJson(savedItemsV1, [])) : [];

  const savedPromoV1 = safeStorageGet(PROMO_STORAGE_KEY_V1);
  const promo = savedPromoV1
    ? sanitizePromo(safeParseJson(savedPromoV1, { code: "", discountRate: 0 }))
    : { code: "", discountRate: 0 };

  return { items, promo };
}

// PUBLIC_INTERFACE
export function CartProvider({ children }) {
  /** Provides cart + pricing state/actions across the app with localStorage persistence. */
  const initial = useMemo(() => loadCartState(), []);
  const [items, setItems] = useState(() => initial.items);
  const [promo, setPromo] = useState(() => initial.promo);

  const lastPersistedRef = useRef("");

  // Persist unified v2 state on any change.
  useEffect(() => {
    const payload = {
      version: CART_STORAGE_VERSION,
      items,
      promo,
      savedAt: Date.now(),
    };

    // Avoid tight loops or quota churn if persistence is failing.
    const serialized = JSON.stringify(payload);
    if (serialized === lastPersistedRef.current) return;

    const okV2 = safeStorageSet(CART_STORAGE_KEY_V2, serialized);

    // Backward-compat storage keys (keep them updated so older code/tests/tools don't break).
    // Only attempt if v2 succeeded; if storage is unavailable this prevents repeated exceptions.
    if (okV2) {
      safeStorageSet(CART_STORAGE_KEY_V1, JSON.stringify(items));
      safeStorageSet(PROMO_STORAGE_KEY_V1, JSON.stringify(promo));
      lastPersistedRef.current = serialized;
    }
  }, [items, promo]);

  const itemsCount = useMemo(() => items.reduce((sum, it) => sum + it.quantity, 0), [items]);

  // PUBLIC_INTERFACE
  function addItem(menuItem) {
    /** Adds a menu item to cart (or increments existing). */
    if (!menuItem || typeof menuItem.id !== "string") return;

    setItems((prev) => {
      const existing = prev.find((p) => p.itemId === menuItem.id);
      if (existing) {
        return prev.map((p) => (p.itemId === menuItem.id ? { ...p, quantity: p.quantity + 1 } : p));
      }
      return [
        ...prev,
        {
          itemId: menuItem.id,
          name: menuItem.name,
          unitPrice: menuItem.price,
          quantity: 1,
          notes: "",
        },
      ];
    });
  }

  // PUBLIC_INTERFACE
  function incrementItem(itemId) {
    /** Increments quantity for a cart line. */
    setItems((prev) => prev.map((p) => (p.itemId === itemId ? { ...p, quantity: p.quantity + 1 } : p)));
  }

  // PUBLIC_INTERFACE
  function decrementItem(itemId) {
    /** Decrements quantity (removes line if quantity hits 0). */
    setItems((prev) => {
      const existing = prev.find((p) => p.itemId === itemId);
      if (!existing) return prev;
      if (existing.quantity <= 1) return prev.filter((p) => p.itemId !== itemId);
      return prev.map((p) => (p.itemId === itemId ? { ...p, quantity: p.quantity - 1 } : p));
    });
  }

  // PUBLIC_INTERFACE
  function removeItem(itemId) {
    /** Removes a line from cart. */
    setItems((prev) => prev.filter((p) => p.itemId !== itemId));
  }

  // PUBLIC_INTERFACE
  function clearCart() {
    /** Clears cart items (promo is kept). */
    setItems([]);
  }

  function computePromoFromCode(codeRaw) {
    const code = (codeRaw || "").trim().toUpperCase();
    // Lightweight promo catalog for demo verification.
    if (code === "OCEAN10") return { code, discountRate: 0.1 };
    if (code === "SHIPFREE") return { code, discountRate: 0.06 }; // small discount to simulate fee relief
    return { code, discountRate: 0 };
  }

  // PUBLIC_INTERFACE
  function applyPromo(codeRaw) {
    /** Applies a promo code to the cart (persisted). Unknown codes set discount to 0 but keep code. */
    setPromo(computePromoFromCode(codeRaw));
  }

  // PUBLIC_INTERFACE
  function clearPromo() {
    /** Clears the promo code. */
    setPromo({ code: "", discountRate: 0 });
  }

  const subtotal = useMemo(() => items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0), [items]);

  const promoDiscount = useMemo(() => subtotal * promo.discountRate, [subtotal, promo.discountRate]);

  const fees = useMemo(() => {
    // Keep same base fee model as before for UI realism.
    const serviceFee = subtotal > 0 ? Math.min(3.5, Math.max(1.25, subtotal * 0.08)) : 0;
    const deliveryFee = subtotal > 0 ? 2.99 : 0;
    // Tax should apply after discount to be more realistic.
    const taxable = Math.max(0, subtotal - promoDiscount);
    const tax = taxable > 0 ? taxable * 0.0825 : 0;
    return { serviceFee, deliveryFee, tax };
  }, [subtotal, promoDiscount]);

  const total = useMemo(
    () => subtotal - promoDiscount + fees.serviceFee + fees.deliveryFee + fees.tax,
    [subtotal, promoDiscount, fees]
  );

  const value = useMemo(
    () => ({
      items,
      promo,
      itemsCount,
      subtotal,
      promoDiscount,
      fees,
      total,
      addItem,
      incrementItem,
      decrementItem,
      removeItem,
      clearCart,
      applyPromo,
      clearPromo,
    }),
    [items, promo, itemsCount, subtotal, promoDiscount, fees, total]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// PUBLIC_INTERFACE
export function useCart() {
  /** Hook to access CartContext. */
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}

// PUBLIC_INTERFACE
export function __testOnly__loadCartState() {
  /** Test helper to validate hydration logic in isolation. */
  return loadCartState();
}
