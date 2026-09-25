import NumberFlow from '@number-flow/react';
import { useT } from '../../i18n';
import { LOCALE } from '../../i18n/format';

/**
 * A number whose digits roll to the new value (`@number-flow/react`), in the
 * app's locale (`LOCALE`, the one `fmt` uses), so separators and the decimal
 * comma match the static numbers around it.
 */
export function RollingNumber({ value, decimals = 0, className }: {
  value: number;
  /** Maximum fraction digits; trailing zeros are dropped, as `fmt.upTo` does. */
  decimals?: number;
  className?: string;
}) {
  const { lang } = useT();
  return (
    <NumberFlow
      value={value}
      locales={LOCALE[lang]}
      format={{ maximumFractionDigits: decimals }}
      className={className}
    />
  );
}
