// Pure calculator engine. Standard mode evaluates left-to-right (like Windows 7's
// Standard view); Scientific mode honours operator precedence and parentheses.

export const initialCalc = (sci = false) => ({
  sci,
  entry: '0',
  fresh: true, // next digit replaces the entry
  values: [],
  ops: [],
  expr: '',
  memory: 0,
  hasMemory: false,
  last: null, // { op, operand } for repeated '='
  error: null,
  justOp: false,
  angle: 'deg',
  inv: false,
  parenDepth: 0,
});

const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, mod: 2, '^': 3, yroot: 3 };

export function format(n) {
  if (!isFinite(n)) return 'Overflow';
  if (Object.is(n, -0)) n = 0;
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e16 || abs < 1e-15)) {
    const [m, e] = n.toExponential(15).split('e');
    return `${String(parseFloat(m))}e${e.startsWith('-') ? e : '+' + e.replace('+', '')}`;
  }
  const s = String(parseFloat(n.toPrecision(16)));
  if (s.includes('e')) return format(parseFloat(s));
  return s;
}

function apply(op, a, b) {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      if (b === 0) throw new Error(a === 0 ? 'Result is undefined' : 'Cannot divide by zero');
      return a / b;
    case 'mod':
      if (b === 0) throw new Error('Result is undefined');
      return a % b;
    case '^':
      return Math.pow(a, b);
    case 'yroot':
      if (b === 0) throw new Error('Invalid input');
      return a < 0 && Math.round(b) % 2 === 1 ? -Math.pow(-a, 1 / b) : Math.pow(a, 1 / b);
    default:
      return b;
  }
}

const opLabel = (op) => ({ '+': '+', '-': '-', '*': '*', '/': '/', mod: 'Mod', '^': '^', yroot: 'yroot' })[op] || op;

function reduceTop(values, ops) {
  const op = ops.pop();
  const b = values.pop();
  const a = values.pop();
  values.push(apply(op, a, b));
}

function factorial(n) {
  if (n < 0 || n > 170) throw new Error('Invalid input');
  if (!Number.isInteger(n)) {
    // Gamma via Lanczos for non-integers.
    const g = 7;
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    const x = n;
    let a = c[0];
    const t = x + g + 0.5;
    for (let i = 1; i < 9; i++) a += c[i] / (x + i);
    return Math.sqrt(2 * Math.PI) * Math.pow(t, x + 0.5) * Math.exp(-t) * a;
  }
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

const toRad = (x, angle) => (angle === 'deg' ? (x * Math.PI) / 180 : angle === 'grad' ? (x * Math.PI) / 200 : x);
const fromRad = (x, angle) => (angle === 'deg' ? (x * 180) / Math.PI : angle === 'grad' ? (x * 200) / Math.PI : x);
// Trig results carry binary noise (sin 30° = 0.49999999999999994); trim to 15 significant digits.
const clean = (x) => (Math.abs(x) < 1e-15 ? 0 : parseFloat(x.toPrecision(15)));

export const UNARY = {
  sqrt: { label: 'sqrt', f: (x) => {
    if (x < 0) throw new Error('Invalid input');
    return Math.sqrt(x);
  } },
  recip: { label: 'reciproc', f: (x) => {
    if (x === 0) throw new Error('Cannot divide by zero');
    return 1 / x;
  } },
  sqr: { label: 'sqr', f: (x) => x * x },
  cube: { label: 'cube', f: (x) => x * x * x },
  cuberoot: { label: 'cuberoot', f: (x) => Math.cbrt(x) },
  fact: { label: 'fact', f: factorial },
  ln: { label: 'ln', f: (x) => {
    if (x <= 0) throw new Error('Invalid input');
    return Math.log(x);
  } },
  log: { label: 'log', f: (x) => {
    if (x <= 0) throw new Error('Invalid input');
    return Math.log10(x);
  } },
  exp10: { label: 'powten', f: (x) => Math.pow(10, x) },
  expe: { label: 'powe', f: (x) => Math.exp(x) },
  sin: { label: 'sin', trig: true, f: (x, a) => clean(Math.sin(toRad(x, a))) },
  cos: { label: 'cos', trig: true, f: (x, a) => clean(Math.cos(toRad(x, a))) },
  tan: { label: 'tan', trig: true, f: (x, a) => {
    if (a === 'deg' && Math.abs(x % 180) === 90) throw new Error('Invalid input');
    return clean(Math.tan(toRad(x, a)));
  } },
  asin: { label: 'asin', f: (x, a) => {
    if (Math.abs(x) > 1) throw new Error('Invalid input');
    return clean(fromRad(Math.asin(x), a));
  } },
  acos: { label: 'acos', f: (x, a) => {
    if (Math.abs(x) > 1) throw new Error('Invalid input');
    return clean(fromRad(Math.acos(x), a));
  } },
  atan: { label: 'atan', f: (x, a) => clean(fromRad(Math.atan(x), a)) },
  sinh: { label: 'sinh', f: Math.sinh },
  cosh: { label: 'cosh', f: Math.cosh },
  tanh: { label: 'tanh', f: Math.tanh },
  int: { label: 'Int', f: (x) => Math.trunc(x) },
  frac: { label: 'Frac', f: (x) => x - Math.trunc(x) },
};

const num = (s) => parseFloat(s.entry);

function fail(s, msg) {
  return { ...s, error: msg, entry: msg, fresh: true, values: [], ops: [], expr: '', parenDepth: 0 };
}

export function calcReduce(s, a) {
  if (s.error && !['c', 'ce', 'mode', 'angle', 'inv'].includes(a.type)) {
    s = { ...initialCalc(s.sci), memory: s.memory, hasMemory: s.hasMemory, angle: s.angle };
    if (a.type !== 'digit' && a.type !== 'dot') return s;
  }
  try {
    switch (a.type) {
      case 'digit': {
        if (s.fresh) return { ...s, entry: a.value, fresh: false, justOp: false, exprEntry: undefined };
        const digits = s.entry.replace(/[-.]/g, '');
        if (digits.length >= 16) return s;
        return { ...s, entry: s.entry === '0' ? a.value : s.entry === '-0' ? '-' + a.value : s.entry + a.value };
      }
      case 'dot': {
        if (s.fresh) return { ...s, entry: '0.', fresh: false, justOp: false, exprEntry: undefined };
        if (s.entry.includes('.')) return s;
        return { ...s, entry: s.entry + '.' };
      }
      case 'back': {
        if (s.fresh) return s;
        const e = s.entry.length > 1 && !(s.entry.length === 2 && s.entry.startsWith('-')) ? s.entry.slice(0, -1) : '0';
        return { ...s, entry: e };
      }
      case 'ce':
        return { ...s, entry: '0', fresh: true, error: null };
      case 'c':
        return { ...initialCalc(s.sci), memory: s.memory, hasMemory: s.hasMemory, angle: s.angle };
      case 'neg': {
        if (s.entry === '0') return s;
        const e = s.entry.startsWith('-') ? s.entry.slice(1) : '-' + s.entry;
        return { ...s, entry: e };
      }
      case 'op': {
        const op = a.value;
        if (s.justOp && s.ops.length && s.ops[s.ops.length - 1] !== '(') {
          const ops = [...s.ops.slice(0, -1), op];
          return { ...s, ops, expr: s.expr.replace(/\S+ $/, `${opLabel(op)} `) };
        }
        const values = [...s.values, num(s)];
        const ops = [...s.ops];
        const prec = s.sci ? PREC[op] : 1;
        while (ops.length && ops[ops.length - 1] !== '(') {
          const top = ops[ops.length - 1];
          const tp = s.sci ? PREC[top] : 1;
          if (tp > prec || (tp === prec && op !== '^')) reduceTop(values, ops);
          else break;
        }
        ops.push(op);
        const shown = s.exprEntry ?? format(num(s));
        return { ...s, values, ops, entry: format(values[values.length - 1]), fresh: true, justOp: true, expr: `${s.expr}${shown} ${opLabel(op)} `, exprEntry: undefined, last: null };
      }
      case 'paren': {
        if (!s.sci) return s;
        if (a.value === '(') {
          return { ...s, ops: [...s.ops, '('], expr: `${s.expr}( `, parenDepth: s.parenDepth + 1, fresh: true, entry: '0', justOp: false };
        }
        if (!s.parenDepth) return s;
        const values = [...s.values, num(s)];
        const ops = [...s.ops];
        while (ops.length && ops[ops.length - 1] !== '(') reduceTop(values, ops);
        ops.pop();
        const v = values.pop();
        const shown = s.exprEntry ?? format(num(s));
        return { ...s, values, ops, entry: format(v), fresh: true, justOp: false, expr: `${s.expr}${shown} ) `, exprEntry: '', parenDepth: s.parenDepth - 1 };
      }
      case 'eq': {
        if (!s.ops.length && s.last) {
          const r = apply(s.last.op, num(s), s.last.operand);
          return { ...s, entry: format(r), fresh: true, expr: '' };
        }
        if (!s.ops.length) return { ...s, fresh: true, expr: '', exprEntry: undefined };
        const values = [...s.values, num(s)];
        const ops = [...s.ops];
        const lastOp = [...ops].reverse().find((o) => o !== '(');
        const operand = num(s);
        while (ops.length) {
          if (ops[ops.length - 1] === '(') ops.pop();
          else reduceTop(values, ops);
        }
        const r = values[0];
        if (!isFinite(r)) throw new Error('Overflow');
        return { ...s, values: [], ops: [], entry: format(r), fresh: true, justOp: false, expr: '', exprEntry: undefined, last: lastOp ? { op: lastOp, operand } : null, parenDepth: 0 };
      }
      case 'pct': {
        const base = s.values.length ? s.values[s.values.length - 1] : 0;
        const r = (base * num(s)) / 100;
        return { ...s, entry: format(r), fresh: true, justOp: false, exprEntry: format(r) };
      }
      case 'unary': {
        let key = a.value;
        if (s.inv) key = { sin: 'asin', cos: 'acos', tan: 'atan', ln: 'expe', sqr: 'sqrt', cube: 'cuberoot', log: 'exp10' }[key] || key;
        const u = UNARY[key];
        const x = num(s);
        const r = u.f(x, s.angle);
        if (!isFinite(r)) throw new Error('Overflow');
        const inner = s.exprEntry ?? format(x);
        return { ...s, entry: format(r), fresh: true, justOp: false, exprEntry: `${u.label}(${inner})`, inv: false };
      }
      case 'const':
        return { ...s, entry: format(a.value === 'pi' ? Math.PI : Math.E), fresh: true, justOp: false };
      case 'mem': {
        const x = num(s);
        switch (a.value) {
          case 'MC':
            return { ...s, memory: 0, hasMemory: false };
          case 'MR':
            return { ...s, entry: format(s.memory), fresh: true, justOp: false };
          case 'MS':
            return { ...s, memory: x, hasMemory: true, fresh: true };
          case 'M+':
            return { ...s, memory: s.memory + x, hasMemory: true, fresh: true };
          case 'M-':
            return { ...s, memory: s.memory - x, hasMemory: true, fresh: true };
          default:
            return s;
        }
      }
      case 'inv':
        return { ...s, inv: !s.inv };
      case 'angle':
        return { ...s, angle: a.value };
      case 'mode':
        return { ...initialCalc(a.value === 'scientific'), memory: s.memory, hasMemory: s.hasMemory, angle: s.angle };
      case 'paste': {
        const v = parseFloat(String(a.value).replace(/[^0-9.eE+-]/g, ''));
        if (isNaN(v)) return s;
        return { ...s, entry: format(v), fresh: false };
      }
      default:
        return s;
    }
  } catch (err) {
    return fail(s, err.message || 'Invalid input');
  }
}

/** Display line above the main number. */
export function exprLine(s) {
  return (s.expr + (s.exprEntry ?? '')).trim();
}
