import { useState, useMemo } from "react";

// Generate locale-aware weekday names
const getWeekdays = () => {
  const baseDate = new Date(2023, 0, 1); // A known Sunday
  const formatter = new Intl.DateTimeFormat(navigator.language || 'en', { weekday: 'narrow' });
  return Array.from({ length: 7 }).map((_, i) => {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + i);
    return formatter.format(date);
  });
};

export function DatePicker({ value, onChange }: { value: string | null | undefined, onChange: (date: string | null) => void }) {
  const [open, setOpen] = useState(false);
  
  // We keep 'month' as a local Date representing the displayed month/year (ignoring its day)
  const [month, setMonth] = useState(() => {
    if (value) {
      // Parse as UTC to avoid timezone shift, then use those UTC parts to create a local Date for calendar rendering
      const d = new Date(value);
      return new Date(d.getUTCFullYear(), d.getUTCMonth(), 1);
    }
    return new Date();
  });

  const weekdays = useMemo(getWeekdays, []);

  const handleDateSelect = (d: number) => {
    // Generate UTC ISO string from the calendar's currently viewed year/month and the selected day
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2,'0')}T00:00:00Z`;
    onChange(key);
    setOpen(false);
  };

  const handleToday = () => {
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2,'0')}T00:00:00Z`;
    onChange(key);
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setOpen(false);
  };

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((first.getDay() + days) / 7) * 7 }, (_, i) => i - first.getDay() + 1);

  // Format the currently selected value for the button
  const displayValue = value ? new Intl.DateTimeFormat(navigator.language || 'en').format(
    new Date(new Date(value).getUTCFullYear(), new Date(value).getUTCMonth(), new Date(value).getUTCDate())
  ) : 'Select date...';

  // Format the month header
  const monthLabel = new Intl.DateTimeFormat(navigator.language || 'en', { month: "short", year: "numeric" }).format(month);

  // Helper to check if a rendered day matches the selected UTC value
  const isSelected = (day: number) => {
    if (!value) return false;
    const d = new Date(value);
    return d.getUTCDate() === day && d.getUTCMonth() === month.getMonth() && d.getUTCFullYear() === month.getFullYear();
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        className="bl-input"
        aria-label={value ? `Change date, currently ${displayValue}` : 'Select date'}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{ textAlign: 'left', minHeight: '38px', backgroundColor: '#fff', cursor: 'pointer' }}
        onClick={() => setOpen(!open)}
      >
        {displayValue}
      </button>
      {open && (
        <div
          className="bl-popover"
          role="dialog"
          aria-label="Date picker"
          style={{ position: 'absolute', zIndex: 10, top: '100%', left: 0, marginTop: '4px', background: 'white', border: '1px solid #ccc', borderRadius: '4px', padding: '1rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
        >
          <div className="bl-toolbar" style={{ marginBottom: '8px' }}>
            <button type="button" aria-label="Previous month" className="bl-quiet" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>←</button>
            <strong aria-live="polite" style={{ margin: '0 8px' }}>{monthLabel}</strong>
            <button type="button" aria-label="Next month" className="bl-quiet" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>→</button>
          </div>
          <div className="bl-calendar" role="grid" aria-label="Calendar grid" style={{ minHeight: 'auto', gap: '4px', marginBottom: '8px' }}>
            <div role="row">
              {weekdays.map((d, i) => <strong key={i} role="columnheader" aria-label={d} style={{ width: '28px', textAlign: 'center', display: 'inline-block' }}>{d}</strong>)}
            </div>
            {Array.from({ length: cells.length / 7 }).map((_, weekIndex) => (
              <div key={weekIndex} role="row">
                {cells.slice(weekIndex * 7, (weekIndex + 1) * 7).map((day, i) => {
                  const valid = day >= 1 && day <= days;
                  const selected = valid && isSelected(day);
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={!valid}
                      aria-label={valid ? `${monthLabel.split(' ')[0]} ${day}, ${month.getFullYear()}` : undefined}
                      aria-selected={selected}
                      onClick={() => valid && handleDateSelect(day)}
                      style={{
                        width: '28px', height: '28px', border: 'none', background: selected ? '#000' : 'transparent', color: selected ? '#fff' : valid ? '#000' : '#ccc', borderRadius: '4px', cursor: valid ? 'pointer' : 'default'
                      }}
                      role="gridcell"
                    >
                      {valid ? day : ''}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="bl-form-actions" style={{ marginTop: '8px', borderTop: '1px solid #eee', paddingTop: '8px' }}>
            <button type="button" className="bl-quiet" onClick={handleClear}>Clear</button>
            <button type="button" className="bl-button" onClick={handleToday}>Today</button>
          </div>
        </div>
      )}
      {open && <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setOpen(false)} />}
    </div>
  );
}
