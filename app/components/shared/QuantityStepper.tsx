"use client";

interface Props {
  quantity: number;
  onChange: (delta: number) => void;
  disabled?: boolean;
  density?: "compact" | "standard";
}

export default function QuantityStepper({
  quantity,
  onChange,
  disabled = false,
  density = "compact",
}: Props) {
  if (quantity === 0) {
    return (
      <button
        type="button"
        onClick={() => onChange(1)}
        disabled={disabled}
        aria-label="商品を1個追加"
        className="quantity-add-button"
        data-density={density}
      >
        ＋ <span>追加</span>
      </button>
    );
  }

  return (
    <div className="quantity-stepper" data-density={density} aria-label={`数量 ${quantity}個`}>
      <button
        type="button"
        onClick={() => onChange(-1)}
        disabled={disabled}
        aria-label="商品を1個減らす"
        className="quantity-stepper__button quantity-stepper__button--decrease"
      >
        −
      </button>
      <span className="quantity-stepper__value" aria-live="polite">
        {quantity}
      </span>
      <button
        type="button"
        onClick={() => onChange(1)}
        disabled={disabled}
        aria-label="商品を1個増やす"
        className="quantity-stepper__button quantity-stepper__button--increase"
      >
        ＋
      </button>
    </div>
  );
}
