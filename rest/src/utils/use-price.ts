import { useMemo } from "react";
import { siteSettings } from "@settings/site.settings";
import { useSettings } from "@contexts/settings.context";
export function formatPrice({
  amount,
  currencyCode,
  locale,
}: {
  amount: number;
  currencyCode: string;
  locale: string;
}) {
  const formatCurrency = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
  });

  return formatCurrency.format(amount);
}

export function formatVariantPrice({
  amount,
  baseAmount,
  currencyCode,
  locale,
}: {
  baseAmount: number;
  amount: number;
  currencyCode: string;
  locale: string;
}) {
  const hasDiscount = baseAmount < amount;
  const formatDiscount = new Intl.NumberFormat(locale, { style: "percent" });
  const discount = hasDiscount
    ? formatDiscount.format((amount - baseAmount) / amount)
    : null;

  const price = formatPrice({ amount, currencyCode, locale });
  const basePrice = hasDiscount
    ? formatPrice({ amount: baseAmount, currencyCode, locale })
    : null;

  return { price, basePrice, discount };
}
type PriceProps = {
  amount: number;
  baseAmount?: number;
  currencyCode?: string;
};

export default function usePrice(data?: PriceProps | null) {
  const { currency } = useSettings();
  const { amount = 0, baseAmount = 0, currencyCode = currency } = data ?? {};
  const locale = 'en';

  console.log("Debug: amount", amount);
  console.log("Debug: baseAmount", baseAmount);
  console.log("Debug: currencyCode", currencyCode);

  const value = useMemo(() => {
    if (typeof amount !== "number" || !currencyCode) {
      console.error("Invalid amount or currencyCode:", amount, currencyCode);
      return "";
    }

    return baseAmount
      ? formatVariantPrice({ amount, baseAmount, currencyCode, locale })
      : formatPrice({ amount, currencyCode, locale });
  }, [amount, baseAmount, currencyCode, locale]);

  console.log("Debug: value", value);

  return typeof value === "string"
    ? { price: value, basePrice: null, discount: null }
    : value;
}

