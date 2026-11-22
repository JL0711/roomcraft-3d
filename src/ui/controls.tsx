import { useEffect, useState, type ReactNode } from 'react';
import { useStore } from '../store';

/** Slider plus a millimetre input. Records one undo step per gesture. */
export function SizeField(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  scale?: number;
  onChange: (v: number) => void;
}) {
  const { label, value, min, max, step = 0.01, unit = 'mm', scale = 1000, onChange } = props;
  const checkpoint = useStore((s) => s.checkpoint);
  const [text, setText] = useState(String(Math.round(value * scale)));
  useEffect(() => setText(String(Math.round(value * scale))), [value, scale]);
  const commit = () => {
    const n = Number(text);
    if (!Number.isFinite(n)) return setText(String(Math.round(value * scale)));
    const v = Math.min(max, Math.max(min, n / scale));
    checkpoint();
    onChange(v);
    setText(String(Math.round(v * scale)));
  };
  return (
    <label className="field size-field">
      <span className="field-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={() => checkpoint()}
        onKeyDown={() => checkpoint()}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="num">
        <input
          type="text"
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
        <em>{unit}</em>
      </span>
    </label>
  );
}

export function Segmented<T extends string | number>(props: { value: T | undefined; options: { v: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="radiogroup">
      {props.options.map((o) => (
        <button key={String(o.v)} type="button" role="radio" aria-checked={props.value === o.v} className={props.value === o.v ? 'on' : ''} onClick={() => props.onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Swatches(props: {
  value: string | undefined;
  options: { id: string; label: string; color?: string; image?: string }[];
  onChange: (id: string) => void;
}) {
  return (
    <div className="swatches">
      {props.options.map((o) => (
        <button
          key={o.id}
          type="button"
          title={o.label}
          aria-label={o.label}
          aria-pressed={props.value === o.id}
          className={`swatch${props.value === o.id ? ' on' : ''}`}
          style={{ background: o.image ? `center / cover url(${o.image})` : o.color }}
          onClick={() => props.onChange(o.id)}
        />
      ))}
    </div>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="field-body">{children}</div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" aria-hidden />
      <span>{label}</span>
    </label>
  );
}
