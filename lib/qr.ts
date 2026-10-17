import { QrBundleSelection, QrCartItem, QrOrderPayload, QrYakitoriSkewerSelection } from "@/types";

const PAYLOAD_PREFIX = "V2";
const ORDER_MARKER = "O";
const UUID_HEX_LENGTH = 32;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// M<menuCode>Q<qty>[Y<flavorId>-<typeId>...][X<optionCode>...][B<slotId>:<menuCode>[:<optionCode>...],...]
const ITEM_PATTERN = /M(\d+)Q(\d+)(?:Y((?:\d+-\d+)(?:\.\d+-\d+)*))?(?:X((?:\d+)(?:\.\d+)*))?(?:B((?:\d+:\d+(?::\d+(?:\.\d+)*)?)(?:,\d+:\d+(?::\d+(?:\.\d+)*)?)*))?/g;

function serializeSelections(selections: QrYakitoriSkewerSelection[]): string {
  return `Y${selections.map((selection) => `${selection.flavorId}-${selection.typeId}`).join(".")}`;
}

function parseSelections(raw: string): QrYakitoriSkewerSelection[] {
  return raw.split(".").map((pair) => {
    const [flavorId, typeId] = pair.split("-").map((value) => Number.parseInt(value, 10));
    return { flavorId, typeId };
  });
}

function serializeCodes(codes: number[] | undefined): string {
  return codes && codes.length > 0 ? `X${codes.join(".")}` : "";
}

function parseCodes(raw: string | undefined): number[] | undefined {
  return raw ? raw.split(".").map((value) => Number.parseInt(value, 10)) : undefined;
}

function serializeBundles(selections: QrBundleSelection[] | undefined): string {
  if (!selections || selections.length === 0) return "";
  return `B${selections.map((selection) => [
    selection.slotId,
    selection.menuCode,
    selection.optionCodes && selection.optionCodes.length > 0 ? selection.optionCodes.join(".") : "",
  ].filter((value) => value !== "").join(":")).join(",")}`;
}

function parseBundles(raw: string | undefined): QrBundleSelection[] | undefined {
  if (!raw) return undefined;
  return raw.split(",").map((value) => {
    const [slotId, menuCode, optionCodes] = value.split(":");
    return {
      slotId: Number.parseInt(slotId, 10),
      menuCode: Number.parseInt(menuCode, 10),
      ...(optionCodes ? { optionCodes: parseCodes(optionCodes) } : {}),
    };
  });
}

function stripHyphens(uuid: string): string {
  return uuid.replace(/-/g, "");
}

function toCanonicalUuid(hex32: string): string {
  return [hex32.slice(0, 8), hex32.slice(8, 12), hex32.slice(12, 16), hex32.slice(16, 20), hex32.slice(20, 32)].join("-").toLowerCase();
}

function validPositiveCodes(codes: unknown): codes is number[] {
  return Array.isArray(codes) && codes.length > 0 && codes.every((code) => Number.isInteger(code) && code > 0);
}

function validBundleSelections(selections: unknown): selections is QrBundleSelection[] {
  return Array.isArray(selections) && selections.length > 0 && selections.every((selection) => {
    if (!selection || typeof selection !== "object") return false;
    const candidate = selection as Partial<QrBundleSelection>;
    return typeof candidate.slotId === "number" && Number.isInteger(candidate.slotId) && candidate.slotId > 0
      && typeof candidate.menuCode === "number" && Number.isInteger(candidate.menuCode) && candidate.menuCode > 0
      && (candidate.optionCodes === undefined || validPositiveCodes(candidate.optionCodes));
  });
}

export function isQrPayload(value: unknown): value is QrOrderPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { version?: unknown; orderId?: unknown; items?: unknown };
  return candidate.version === 2
    && typeof candidate.orderId === "string"
    && UUID_PATTERN.test(candidate.orderId)
    && Array.isArray(candidate.items)
    && candidate.items.every((item) => {
      if (!item || typeof item !== "object") return false;
      const entry = item as Partial<QrCartItem>;
      if (typeof entry.menuCode !== "number" || !Number.isInteger(entry.menuCode) || entry.menuCode <= 0 || typeof entry.qty !== "number" || !Number.isInteger(entry.qty) || entry.qty <= 0) return false;
      if (entry.yakitoriSelections !== undefined && (!Array.isArray(entry.yakitoriSelections) || entry.yakitoriSelections.length === 0 || entry.yakitoriSelections.some((selection) => !selection || selection.flavorId <= 0 || selection.typeId <= 0))) return false;
      if (entry.optionCodes !== undefined && !validPositiveCodes(entry.optionCodes)) return false;
      return entry.bundleSelections === undefined || validBundleSelections(entry.bundleSelections);
    });
}

function serializeItem(item: QrCartItem): string {
  const base = `M${item.menuCode}Q${item.qty}`;
  const yakitori = item.yakitoriSelections ? serializeSelections(item.yakitoriSelections) : "";
  return base + yakitori + serializeCodes(item.optionCodes) + serializeBundles(item.bundleSelections);
}

export function serializeQrPayload(payload: QrOrderPayload): string {
  return `${PAYLOAD_PREFIX}${ORDER_MARKER}${stripHyphens(payload.orderId).toUpperCase()}${payload.items.map(serializeItem).join("")}`;
}

export function parseQrPayload(rawValue: string): QrOrderPayload {
  const normalized = rawValue.trim().toUpperCase();
  if (!normalized.startsWith(`${PAYLOAD_PREFIX}${ORDER_MARKER}`)) throw new Error("QRコードのバージョンまたは形式が不正です");

  const headerLength = PAYLOAD_PREFIX.length + ORDER_MARKER.length;
  const hex32 = normalized.slice(headerLength, headerLength + UUID_HEX_LENGTH);
  const itemsPart = normalized.slice(headerLength + UUID_HEX_LENGTH);
  if (hex32.length !== UUID_HEX_LENGTH || !/^[0-9A-F]{32}$/.test(hex32)) throw new Error("QRコードの形式が不正です");

  const items = Array.from(itemsPart.matchAll(ITEM_PATTERN)).map((match): QrCartItem => ({
    menuCode: Number.parseInt(match[1], 10),
    qty: Number.parseInt(match[2], 10),
    ...(match[3] ? { yakitoriSelections: parseSelections(match[3]) } : {}),
    ...(match[4] ? { optionCodes: parseCodes(match[4]) } : {}),
    ...(match[5] ? { bundleSelections: parseBundles(match[5]) } : {}),
  }));

  if (items.length === 0 || items.map(serializeItem).join("") !== itemsPart) throw new Error("QRコードの形式が不正です");
  const payload: QrOrderPayload = { version: 2, orderId: toCanonicalUuid(hex32), items };
  if (!isQrPayload(payload)) throw new Error("QRコードの内容が不正です");
  return payload;
}

export function createOrderId(): string {
  return crypto.randomUUID();
}
