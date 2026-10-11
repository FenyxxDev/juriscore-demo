import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Info,
  Loader2,
  Search,
  X,
} from 'lucide-react';

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

/* ---------------------------------------------------------------- Button */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type ButtonSize = 'sm' | 'md';

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';
  const sizes: Record<ButtonSize, string> = {
    sm: 'h-8 px-3 text-[13px]',
    md: 'h-9.5 px-4 text-sm',
  };
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-[var(--color-teal)] text-white hover:bg-[var(--color-teal-hover)]',
    secondary: 'bg-white text-ink border border-line-strong hover:bg-subtle hover:border-[var(--color-faint)]',
    subtle: 'bg-slate-100 text-ink hover:bg-slate-200/70',
    ghost: 'bg-transparent text-muted hover:bg-slate-100 hover:text-ink',
    danger: 'bg-[var(--color-danger)] text-white hover:bg-[#832f2d]',
  };
  return (
    <button
      className={cx(base, sizes[size], variants[variant], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 size={15} className="animate-[juris-spin_0.7s_linear_infinite]" />
      ) : (
        icon
      )}
      {loading ? 'Processando…' : children}
    </button>
  );
}

/* ----------------------------------------------------------------- Input */

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
        {label}
        {required && <span className="ml-0.5 text-[var(--color-danger)]">*</span>}
      </label>
      {children}
      {error ? (
        <p className="flex items-center gap-1.5 text-[12.5px] text-[var(--color-danger)]">
          <CircleAlert size={13} /> {error}
        </p>
      ) : hint ? (
        <p className="text-[12.5px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const fieldBase =
  'w-full rounded-md border bg-white text-sm text-ink placeholder:text-[var(--color-faint)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-teal)]/25 focus:border-[var(--color-teal)]';

export function Input({
  invalid,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid}
      className={cx(
        fieldBase,
        'h-9.5 px-3',
        invalid ? 'border-[var(--color-danger)] ring-2 ring-[var(--color-danger)]/15' : 'border-line-strong',
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  invalid,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      aria-invalid={invalid}
      className={cx(
        fieldBase,
        'min-h-[84px] resize-y px-3 py-2.5 leading-relaxed',
        invalid ? 'border-[var(--color-danger)]' : 'border-line-strong',
        className,
      )}
      {...props}
    />
  );
}

export function SearchInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cx('relative', className)}>
      <Search
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-faint)]"
      />
      <input type="search" className={cx(fieldBase, 'h-9.5 border-line-strong pl-9 pr-3')} {...props} />
    </div>
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        'h-9 rounded-md border border-line-strong bg-white pl-3 pr-8 text-[13px] font-medium text-ink transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-[var(--color-teal)]/25 focus:border-[var(--color-teal)]',
        'bg-[url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 fill=%27none%27 stroke=%27%238794a1%27 stroke-width=%271.6%27><path d=%27M2 4l4 4 4-4%27/></svg>")] bg-[length:11px] bg-[right_0.65rem_center] bg-no-repeat appearance-none',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2 text-[13px] text-muted">
      <input
        type="checkbox"
        className="h-4 w-4 rounded-[3px] border-line-strong text-[var(--color-teal)] accent-[var(--color-teal)] focus:ring-2 focus:ring-[var(--color-teal)]/30"
        {...props}
      />
      {label}
    </label>
  );
}

/* ------------------------------------------------------------ Segmented */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={cx('inline-flex items-center rounded-md border border-line-strong bg-white p-0.5', size === 'md' ? 'h-9' : 'h-8')}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            className={cx(
              'rounded-[4px] font-medium transition-colors',
              size === 'sm' ? 'h-full px-2.5 text-[12.5px]' : 'h-full px-3 text-[13px]',
              on ? 'bg-[var(--color-brand-dark)] text-white' : 'text-muted hover:text-ink',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- Badge */

export type StatusTone =
  | 'em-andamento'
  | 'atrasado'
  | 'pendente'
  | 'concluido'
  | 'encerrado'
  | 'arquivado'
  | 'aguardando'
  | 'confirmada'
  | 'realizada'
  | 'cancelada'
  | 'ativo'
  | 'inativo';

const badgeStyles: Record<StatusTone, { dot: string; text: string; label: string }> = {
  'em-andamento': { dot: 'bg-[var(--color-teal)]', text: 'text-ink', label: 'Em andamento' },
  aguardando: { dot: 'bg-[var(--color-info)]', text: 'text-ink', label: 'Aguardando ação' },
  atrasado: { dot: 'bg-[var(--color-danger)]', text: 'text-[var(--color-danger)]', label: 'Atrasado' },
  pendente: { dot: 'bg-[var(--color-warning)]', text: 'text-ink', label: 'Pendente' },
  concluido: { dot: 'bg-[var(--color-success)]', text: 'text-muted', label: 'Concluído' },
  confirmada: { dot: 'bg-[var(--color-teal)]', text: 'text-ink', label: 'Confirmada' },
  realizada: { dot: 'bg-[var(--color-success)]', text: 'text-muted', label: 'Realizada' },
  cancelada: { dot: 'bg-[var(--color-faint)]', text: 'text-muted', label: 'Cancelada' },
  encerrado: { dot: 'bg-[var(--color-faint)]', text: 'text-muted', label: 'Encerrado' },
  arquivado: { dot: 'bg-[var(--color-faint)]', text: 'text-muted', label: 'Arquivado' },
  ativo: { dot: 'bg-[var(--color-success)]', text: 'text-ink', label: 'Ativo' },
  inativo: { dot: 'bg-[var(--color-faint)]', text: 'text-muted', label: 'Inativo' },
};

export function StatusBadge({ tone, label }: { tone: StatusTone; label?: string }) {
  const s = badgeStyles[tone];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-medium">
      <span className={cx('h-1.5 w-1.5 rounded-full', s.dot)} aria-hidden />
      <span className={s.text}>{label ?? s.label}</span>
    </span>
  );
}

/* --------------------------------------------------------- Priority pill */

export function PriorityPill({ level }: { level: 'alta' | 'média' | 'baixa' }) {
  const map = {
    alta: { bar: 'bg-[var(--color-danger)]', text: 'text-[var(--color-danger)]' },
    média: { bar: 'bg-[var(--color-warning)]', text: 'text-muted' },
    baixa: { bar: 'bg-[var(--color-faint)]', text: 'text-muted' },
  } as const;
  const s = map[level];
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-[12.5px] font-medium capitalize', s.text)}>
      <span className={cx('h-3 w-0.5 rounded-full', s.bar)} aria-hidden />
      {level}
    </span>
  );
}

/* ------------------------------------------------------------------ Card */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-md border border-line bg-panel', className)}>{children}</div>;
}

export function PanelHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[12.5px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ----------------------------------------------------------------- Alert */

const alertStyles = {
  success: { cls: 'border-[var(--color-success)]/30 bg-[var(--color-success)]/6 text-[var(--color-success)]', Icon: Check },
  warning: { cls: 'border-[var(--color-warning)]/30 bg-[var(--color-warning)]/6 text-[var(--color-warning)]', Icon: AlertTriangle },
  error: { cls: 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/6 text-[var(--color-danger)]', Icon: CircleAlert },
  info: { cls: 'border-[var(--color-info)]/30 bg-[var(--color-info)]/6 text-[var(--color-info)]', Icon: Info },
} as const;

export function Alert({
  tone,
  title,
  children,
}: {
  tone: keyof typeof alertStyles;
  title: string;
  children?: ReactNode;
}) {
  const { cls, Icon } = alertStyles[tone];
  return (
    <div className={cx('flex gap-2.5 rounded-md border px-3.5 py-3 text-sm', cls)} role="status">
      <Icon size={17} className="mt-0.5 shrink-0" />
      <div>
        <p className="font-medium">{title}</p>
        {children && <div className="mt-0.5 text-[13px] opacity-90">{children}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Tabs */

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[] | string[];
  active: string;
  onChange: (t: string) => void;
}) {
  const items = tabs.map((t) => (typeof t === 'string' ? { id: t, label: t } : t));
  return (
    <div role="tablist" className="flex gap-6 border-b border-line">
      {items.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={cx(
              '-mb-px flex items-center gap-2 border-b-2 pb-2.5 pt-1 text-sm font-medium transition-colors',
              on ? 'border-[var(--color-teal)] text-ink' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={cx(
                  'tnum rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
                  on ? 'bg-[var(--color-teal)]/12 text-[var(--color-teal)]' : 'bg-slate-100 text-muted',
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ Breadcrumb */

export function Breadcrumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12.5px] text-muted">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-line-strong">/</span>}
          <span className={cx(i === items.length - 1 && 'font-medium text-ink')}>{it.label}</span>
        </span>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------ Pagination */

export function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (p: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        aria-label="Página anterior"
        className="flex h-8 w-8 items-center justify-center rounded-md border border-line-strong text-muted hover:bg-subtle disabled:opacity-40"
      >
        <ChevronLeft size={15} />
      </button>
      {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          aria-current={p === page ? 'page' : undefined}
          className={cx(
            'tnum h-8 min-w-8 rounded-md px-2 text-[13px] font-medium',
            p === page ? 'bg-[var(--color-brand-dark)] text-white' : 'border border-line-strong text-muted hover:bg-subtle',
          )}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onChange(Math.min(pages, page + 1))}
        disabled={page === pages}
        aria-label="Próxima página"
        className="flex h-8 w-8 items-center justify-center rounded-md border border-line-strong text-muted hover:bg-subtle disabled:opacity-40"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- Avatar */

const avatarTones = ['bg-[#16455a]', 'bg-[#3d6b52]', 'bg-[#8a5a1c]', 'bg-[#35566e]', 'bg-[#6b4a6b]'];

export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
  const tone = avatarTones[name.charCodeAt(0) % avatarTones.length];
  return (
    <span
      aria-hidden
      className={cx('flex shrink-0 items-center justify-center rounded-full font-semibold text-white', tone)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}

/* ----------------------------------------------------------------- Modal */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const max = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg';
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[var(--color-navy)]/45 p-4 py-[6vh] backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={cx('w-full rounded-lg border border-line bg-white shadow-xl animate-[juris-fade-in_0.16s_ease-out]', max)}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="-mr-1 rounded-md p-1.5 text-muted hover:bg-slate-100"
          >
            <X size={17} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Toast */

type Toast = { id: number; tone: keyof typeof alertStyles; message: string };
const ToastCtx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

const toastIcon = { success: Check, warning: AlertTriangle, error: CircleAlert, info: Info } as const;
const toastDot = {
  success: 'text-[var(--color-success)]',
  warning: 'text-[var(--color-warning)]',
  error: 'text-[var(--color-danger)]',
  info: 'text-[var(--color-info)]',
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((cur) => [...cur, { ...t, id }]);
    setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== id)), 3500);
  };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col gap-2">
        {toasts.map((t) => {
          const Icon = toastIcon[t.tone];
          return (
            <div
              key={t.id}
              className="flex items-center gap-2.5 rounded-md border border-white/10 bg-[var(--color-brand-dark)] px-4 py-2.5 text-sm text-white shadow-lg animate-[juris-toast-in_0.2s_ease-out]"
            >
              <Icon size={15} className={toastDot[t.tone]} />
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

/* -------------------------------------------------- Empty / Loading / State */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-[var(--color-faint)]">
        {icon}
      </div>
      <div>
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function LoadingRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-t border-line">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3.5">
              <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/* ------------------------------------------------------------- Metric */

export function Metric({
  label,
  value,
  hint,
  hintTone = 'muted',
  emphasis,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  hintTone?: 'muted' | 'danger' | 'warning' | 'success';
  emphasis?: boolean;
}) {
  const toneCls = {
    muted: 'text-muted',
    danger: 'text-[var(--color-danger)]',
    warning: 'text-[var(--color-warning)]',
    success: 'text-[var(--color-success)]',
  }[hintTone];
  return (
    <div className="flex flex-col gap-1 px-5 py-4">
      <span className="eyebrow">{label}</span>
      <span className={cx('tnum text-[26px] font-semibold leading-none', emphasis ? 'text-[var(--color-teal)]' : 'text-ink')}>
        {value}
      </span>
      {hint && <span className={cx('text-[12.5px]', toneCls)}>{hint}</span>}
    </div>
  );
}
