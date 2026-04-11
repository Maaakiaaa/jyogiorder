import { QrOrderPayload } from "@/types";

const PAYLOAD_PREFIX = "V1";
const TOKEN_PREFIX = "T";
const TOKEN_LENGTH = 12;
const ITEM_PATTERN = /M(\d+)Q(\d+)/g;

export function isQrPayload(value: unknown): value is QrOrderPayload {
  if (!value || typeof value !== "object") return false;

  const candidate = value as {
    version?: unknown;
    checkoutToken?: unknown;
    items?: unknown;
  };

  return (
    candidate.version === 1 &&
    typeof candidate.checkoutToken === "string" &&
    /^[A-Z0-9]{12}$/.test(candidate.checkoutToken) &&
    Array.isArray(candidate.items) &&
    candidate.items.every((item) => {
      if (!item || typeof item !== "object") return false;
      const entry = item as { menuId?: unknown; qty?: unknown };
      return Number.isInteger(entry.menuId) && Number.isInteger(entry.qty) && Number(entry.qty) > 0;
    })
  );
}

export function serializeQrPayload(payload: QrOrderPayload): string {
  const items = payload.items.map((item) => `M${item.menuId}Q${item.qty}`).join("");
  return `${PAYLOAD_PREFIX}${TOKEN_PREFIX}${payload.checkoutToken}${items}`;
}

export function parseQrPayload(rawValue: string): QrOrderPayload {
  const normalized = rawValue.trim().toUpperCase();

  if (!normalized.startsWith(`${PAYLOAD_PREFIX}${TOKEN_PREFIX}`)) {
    throw new Error("QRコードの形式が不正です");
  }

  const checkoutToken = normalized.slice(PAYLOAD_PREFIX.length + TOKEN_PREFIX.length, PAYLOAD_PREFIX.length + TOKEN_PREFIX.length + TOKEN_LENGTH);
  const itemsPart = normalized.slice(PAYLOAD_PREFIX.length + TOKEN_PREFIX.length + TOKEN_LENGTH);
  const items = Array.from(itemsPart.matchAll(ITEM_PATTERN)).map((match) => ({
    menuId: Number.parseInt(match[1], 10),
    qty: Number.parseInt(match[2], 10),
  }));

  const reconstructed = items.map((item) => `M${item.menuId}Q${item.qty}`).join("");

  if (items.length === 0 || reconstructed !== itemsPart) {
    throw new Error("QRコードの形式が不正です");
  }

  const payload: QrOrderPayload = {
    version: 1,
    checkoutToken,
    items,
  };

  if (!isQrPayload(payload)) {
    throw new Error("QRコードの形式が不正です");
  }

  return payload;
}

export function createCheckoutToken(): string {
  return crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, TOKEN_LENGTH);
}
