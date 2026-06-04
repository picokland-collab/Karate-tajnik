'use client';
import { useState, useEffect } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { hr } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('hr', hr);

/** ISO "YYYY-MM-DD" → Date (timezone-safe, no UTC shift) */
function isoToDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Date → ISO "YYYY-MM-DD" */
function dateToIso(d: Date): string {
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

interface Props {
  value: string;                   // ISO "YYYY-MM-DD" or ""
  onChange: (iso: string) => void; // always emits ISO "YYYY-MM-DD" or ""
  className?: string;
  required?: boolean;
}

export default function DateInput({ value, onChange, className, required }: Props) {
  const [selected, setSelected] = useState<Date | null>(() => isoToDate(value));

  useEffect(() => {
    setSelected(isoToDate(value));
  }, [value]);

  return (
    <DatePicker
      locale="hr"
      selected={selected}
      onChange={(date: Date | null) => {
        setSelected(date);
        onChange(date ? dateToIso(date) : '');
      }}
      dateFormat="dd.MM.yyyy."
      placeholderText="dd.mm.gggg."
      required={required}
      showMonthDropdown
      showYearDropdown
      dropdownMode="select"
      yearDropdownItemNumber={80}
      scrollableYearDropdown
      popperPlacement="bottom-start"
      popperProps={{ strategy: 'fixed' }}
      className={className}
    />
  );
}
