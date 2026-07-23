import { QrOrderPayload } from "@/types";

const PAYLOAD_PREFIX = "V1";
const ORDER_MARKER = "O";
const UUID_HEX_LENGTH = 32;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ITEM_PATTERN = /M(\d+)Q(\d+)/g;

function stripHyphens(uuid: string): string {
  return uuid.replace(/-/g, "");
}

function toCanonicalUuid(hex32: string): string {
  return [
    hex32.slice(0, 8),
    hex32.slice(8, 12),
    hex32.slice(12, 16),
    hex32.slice(16, 20),
    hex32.slice(20, 32),
  ].join("-").toLowerCase();
}

export function isQrPayload(value: unknown): value is QrOrderPayload {
  if (!value || typeof value !== "object") return false;

  const candidate = value as {
    version?: unknown;
    orderId?: unknown;
    items?: unknown;
  };

  return (
    candidate.version === 1 &&
    typeof candidate.orderId === "string" &&
    UUID_PATTERN.test(candidate.orderId) &&
    Array.isArray(candidate.items) &&
    candidate.items.every((item) => {
      if (!item || typeof item !== "object") return false;
      const entry = item as { menuId?: unknown; qty?: unknown };
      return Number.isInteger(entry.menuId) && Number.isInteger(entry.qty) && Number(entry.qty) > 0;
    })
  );
}

export function serializeQrPayload(payload: QrOrderPayload): string {
  const hex32 = stripHyphens(payload.orderId).toUpperCase();
  const items = payload.items.map((item) => `M${item.menuId}Q${item.qty}`).join("");
  return `${PAYLOAD_PREFIX}${ORDER_MARKER}${hex32}${items}`;
}

export function parseQrPayload(rawValue: string): QrOrderPayload {
  const normalized = rawValue.trim().toUpperCase();

  if (!normalized.startsWith(`${PAYLOAD_PREFIX}${ORDER_MARKER}`)) {
    throw new Error("QRコードの形式が不正です");
  }

  const headerLength = PAYLOAD_PREFIX.length + ORDER_MARKER.length;
  const hex32 = normalized.slice(headerLength, headerLength + UUID_HEX_LENGTH);
  const itemsPart = normalized.slice(headerLength + UUID_HEX_LENGTH);

  if (hex32.length !== UUID_HEX_LENGTH || !/^[0-9A-F]{32}$/.test(hex32)) {
    throw new Error("QRコードの形式が不正です");
  }

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
    orderId: toCanonicalUuid(hex32),
    items,
  };

  if (!isQrPayload(payload)) {
    throw new Error("QRコードの形式が不正です");
  }

  return payload;
}

// 固有ID = 冪等キー。カート組み立て時にクライアントで生成し、そのまま orders.id にする。
export function createOrderId(): string {
  return crypto.randomUUID();
}
