type OrderProduct = {
  id?: string | number;
  name?: string;
  sku?: string;
  pivot?: {
    variation?: any;
    sku?: string;
    product_sku?: string;
    product_name?: string;
    [key: string]: any;
  };
  [key: string]: any;
};

type OrderLike = {
  id: string | number;
  products?: OrderProduct[];
  [key: string]: any;
};

const BURGER_KEYWORDS = ["3600", "5V00L"];

const toLowerString = (value: unknown): string => {
  if (value === undefined || value === null) return "";
  return String(value).toLowerCase();
};

const includesKeyword = (value: unknown, keywords: string[]): boolean => {
  if (!value) return false;
  const lowered = toLowerString(value);
  return lowered.length > 0 && keywords.some((keyword) => lowered.includes(keyword.toLowerCase()));
};

const collectCandidateStrings = (product: OrderProduct): string[] => {
  const candidates: string[] = [];

  const pushIfString = (entry: unknown) => {
    if (typeof entry === "string" || typeof entry === "number") {
      candidates.push(String(entry));
    }
  };

  pushIfString(product?.id);
  pushIfString(product?.name);
  pushIfString(product?.sku);
  pushIfString(product?.pivot?.sku);
  pushIfString(product?.pivot?.product_sku);
  pushIfString(product?.pivot?.product_name);

  const variation = (() => {
    const value = product?.pivot?.variation;
    if (!value) return null;
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch (_error) {
        return null;
      }
    }
    if (typeof value === "object") {
      return value;
    }
    return null;
  })();

  if (variation && typeof variation === "object") {
    pushIfString((variation as any)?.name);
    pushIfString((variation as any)?.sku);
    pushIfString((variation as any)?.product_id);
    pushIfString((variation as any)?.variant_id);
  }

  const addImgUrlCandidates = (value: unknown) => {
    if (typeof value !== "string") return;
    const url = value;
    candidates.push(url);

    const sanitized = url.split("?")[0];
    sanitized
      .split("/")
      .filter(Boolean)
      .forEach((segment) => candidates.push(segment));

    const mediaMatch = sanitized.match(/\/media\/([^/]+)/i);
    if (mediaMatch?.[1]) {
      candidates.push(mediaMatch[1]);
    }
  };

  addImgUrlCandidates(product?.pivot?.img_url);
  addImgUrlCandidates((variation as any)?.img_url);

  return candidates;
};

const hasBurgerKeyword = (product: OrderProduct): boolean => {
  const candidates = collectCandidateStrings(product);
  return candidates.some((entry) => includesKeyword(entry, BURGER_KEYWORDS));
};

export const determineAutoFulfillSelections = <TOrder extends OrderLike>(
  orders: TOrder[],
  options?: { burgerStatusId?: number; mangoStatusId?: number }
): Record<string | number, number> => {
  const burgerStatus = options?.burgerStatusId ?? 9;
  const mangoStatus = options?.mangoStatusId ?? 69;

  const selections: Record<string | number, number> = {};

  orders.forEach((order) => {
    const hasBurgerProduct = (order?.products ?? []).some(hasBurgerKeyword);
    selections[order.id] = hasBurgerProduct ? burgerStatus : mangoStatus;
  });

  return selections;
};


