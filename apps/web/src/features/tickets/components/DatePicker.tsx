import { useState } from "react";

export function DatePicker({ value, onChange }: { value: string | null | undefined, onChange: (date: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => value ? new Date(value) : new Date());

  const handleDateSelect = (d: number) => {
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

  const first = new Date(month.getFullYear(), month.getMonth(), 1), days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((first.getDay() + days) / 7) * 7 }, (_, i) => i - first.getDay() + 1);

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        className="bl-input"
        style={{ textAlign: 'left', minHeight: '38px', backgroundColor: '#fff', cursor: 'pointer' }}
        onClick={() => setOpen(!open)}
      >
        {value ? new Date(value).toLocaleDateString() : 'Select date...'}
      </button>
      {open && (
        <div
          className="bl-popover"
          style={{ position: 'absolute', zIndex: 10, top: '100%', left: 0, marginTop: '4px', background: 'white', border: '1px solid #ccc', borderRadius: '4px', padding: '1rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
        >
          <div className="bl-toolbar" style={{ marginBottom: '8px' }}>
            <button type="button" className="bl-quiet" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>←</button>
            <strong style={{ margin: '0 8px' }}>{month.toLocaleDateString(undefined, { month: "short", year: "numeric" })}</strong>
            <button type="button" className="bl-quiet" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>→</button>
          </div>
          <div className="bl-calendar" role="grid" style={{ minHeight: 'auto', gap: '4px', marginBottom: '8px' }}>
            <div role="row">
              {['S','M','T','W','T','F','S'].map((d, i) => <strong key={i} role="columnheader" style={{ width: '28px', textAlign: 'center', display: 'inline-block' }}>{d}</strong>)}
            </div>
            {Array.from({ length: cells.length / 7 }).map((_, weekIndex) => (
              <div key={weekIndex} role="row">
                {cells.slice(weekIndex * 7, (weekIndex + 1) * 7).map((day, i) => {
                  const valid = day >= 1 && day <= days;
                  const isSelected = value && new Date(value).getDate() === day && new Date(value).getMonth() === month.getMonth() && new Date(value).getFullYear() === month.getFullYear();
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={!valid}
                      onClick={() => valid && handleDateSelect(day)}
                      style={{
                        width: '28px', height: '28px', border: 'none', background: isSelected ? '#000' : 'transparent', color: isSelected ? '#fff' : valid ? '#000' : '#ccc', borderRadius: '4px', cursor: valid ? 'pointer' : 'default'
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
