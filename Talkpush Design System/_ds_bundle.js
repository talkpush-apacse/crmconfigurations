/* @ds-bundle: {"format":4,"namespace":"TalkpushDesignSystem_0ed2b8","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"KpiCard","sourcePath":"components/core/KpiCard.jsx"},{"name":"Table","sourcePath":"components/data/Table.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Tooltip.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"AccentSquares","sourcePath":"components/report/AccentSquares.jsx"},{"name":"ChevronFlow","sourcePath":"components/report/ChevronFlow.jsx"},{"name":"InsightNote","sourcePath":"components/report/InsightNote.jsx"},{"name":"TermItem","sourcePath":"components/report/TermItem.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"cf6366e1befa","components/core/Button.jsx":"a869197ec05a","components/core/Card.jsx":"55376bea3b02","components/core/KpiCard.jsx":"24f087893216","components/data/Table.jsx":"c8205438030b","components/feedback/Dialog.jsx":"541e8993b239","components/feedback/Tooltip.jsx":"65af4afd2421","components/forms/Checkbox.jsx":"f77c836866b9","components/forms/Input.jsx":"2f8dbc36e682","components/forms/Select.jsx":"735f2bbcf939","components/forms/Switch.jsx":"ecd5fed25ff9","components/navigation/Tabs.jsx":"825ee5f7928a","components/report/AccentSquares.jsx":"1278e3b5c2c7","components/report/ChevronFlow.jsx":"d0fecb4d1e59","components/report/InsightNote.jsx":"5f7cc85cf630","components/report/TermItem.jsx":"95d166ce7320","ui_kits/executive-report/FunnelPage.jsx":"c2fcb3860632","ui_kits/executive-report/ReportApp.jsx":"8f4c275c8aa7","ui_kits/executive-report/ReportCoverPage.jsx":"8904f9fa8a26","ui_kits/executive-report/StatusPage.jsx":"8076985d1247","ui_kits/pricing-proposal/ModulesPage.jsx":"65885b408ed9","ui_kits/pricing-proposal/PricingPage.jsx":"d9e9b7728844","ui_kits/pricing-proposal/ProposalApp.jsx":"5133341d7653","ui_kits/pricing-proposal/ProposalCoverPage.jsx":"8cc62b644fb3","ui_kits/sign-app/DocumentList.jsx":"6c7f91960de3","ui_kits/sign-app/SidebarNav.jsx":"d810a7059e18","ui_kits/sign-app/SignApp.jsx":"b932f6a1095b"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.TalkpushDesignSystem_0ed2b8 = window.TalkpushDesignSystem_0ed2b8 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
const TONES = {
  success: {
    fg: 'var(--color-green-darker)',
    bg: 'var(--color-green-soft)'
  },
  info: {
    fg: 'var(--color-blue-darker)',
    bg: 'var(--color-blue-soft)'
  },
  highlight: {
    fg: 'var(--color-pink-darker)',
    bg: 'var(--color-pink-soft)'
  },
  attention: {
    fg: 'var(--color-accent-ink)',
    bg: 'var(--color-orange-soft)'
  },
  warning: {
    fg: '#8a5a1c',
    bg: 'color-mix(in srgb, var(--color-alert-amber) 20%, white)'
  },
  danger: {
    fg: '#7a2a22',
    bg: 'color-mix(in srgb, var(--color-alert-red) 18%, white)'
  },
  neutral: {
    fg: 'var(--text-muted)',
    bg: 'var(--color-line)'
  }
};
function Badge({
  tone = 'neutral',
  solid = false,
  children
}) {
  const t = TONES[tone] || TONES.neutral;
  const style = solid ? {
    background: t.fg,
    color: '#fff'
  } : {
    background: t.bg,
    color: t.fg
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      ...style,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontFamily: 'var(--font-body)',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      padding: '4px 10px',
      borderRadius: 'var(--radius-full)',
      lineHeight: 1.4
    }
  }, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
const {
  useState
} = React;
const BASE = {
  fontFamily: 'var(--font-body)',
  fontWeight: 600,
  letterSpacing: '-0.01em',
  border: '1px solid transparent',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  borderRadius: 'var(--sign-radius-control, 4px)',
  transition: 'transform .12s ease, background-color .15s ease, opacity .15s ease'
};
const SIZES = {
  sm: {
    height: 36,
    padding: '0 14px',
    fontSize: 13
  },
  default: {
    height: 48,
    padding: '0 24px',
    fontSize: 15
  },
  lg: {
    height: 56,
    padding: '0 30px',
    fontSize: 16
  }
};
function variantStyle(variant, hover, active) {
  const map = {
    default: {
      background: '#141414',
      color: '#fff'
    },
    cta: {
      background: 'var(--sign-pink, #F1C1F3)',
      color: '#141414'
    },
    accent: {
      background: 'var(--color-orange)',
      color: 'var(--color-ink)'
    },
    sage: {
      background: 'var(--color-green)',
      color: 'var(--color-ink)'
    },
    destructive: {
      background: 'var(--sign-destructive, #D1483D)',
      color: '#fff'
    },
    secondary: {
      background: 'var(--sign-secondary, #F7F6E9)',
      color: 'var(--color-ink)'
    },
    outline: {
      background: 'transparent',
      color: 'var(--color-ink)',
      borderColor: 'var(--color-line)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--color-ink)'
    },
    link: {
      background: 'transparent',
      color: 'var(--color-blue-darker)',
      padding: 0,
      height: 'auto',
      textDecoration: hover ? 'underline' : 'none'
    }
  };
  const s = map[variant] || map.default;
  if (hover) s.opacity = 0.88;
  if (active) return {
    ...s,
    transform: 'scale(0.98)',
    opacity: 1
  };
  return s;
}
function Button({
  variant = 'default',
  size = 'default',
  disabled = false,
  icon = null,
  children,
  onClick,
  type = 'button'
}) {
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);
  const style = {
    ...BASE,
    ...(variant === 'link' ? {} : SIZES[size]),
    ...variantStyle(variant, hover, active),
    opacity: disabled ? 0.45 : variantStyle(variant, hover, active).opacity ?? 1,
    cursor: disabled ? 'not-allowed' : 'pointer'
  };
  return /*#__PURE__*/React.createElement("button", {
    type: type,
    disabled: disabled,
    onClick: onClick,
    style: style,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setActive(false);
    },
    onMouseDown: () => setActive(true),
    onMouseUp: () => setActive(false)
  }, icon, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function Card({
  padding = 24,
  accent = null,
  hover = false,
  children,
  style = {}
}) {
  const [isHover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onMouseEnter: () => hover && setHover(true),
    onMouseLeave: () => hover && setHover(false),
    style: {
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-hairline)',
      padding,
      borderTop: accent ? `4px solid ${accent}` : undefined,
      boxShadow: isHover ? 'var(--shadow-card-hover)' : 'var(--shadow-card)',
      transition: 'box-shadow .15s ease',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/KpiCard.jsx
try { (() => {
function KpiCard({
  label,
  value,
  delta = null,
  tone = 'success'
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-hairline)',
      borderRadius: 'var(--radius-md)',
      padding: '20px 22px',
      boxShadow: 'var(--shadow-card)',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      minWidth: 160
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "num",
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 40,
      fontWeight: 700,
      letterSpacing: '-0.03em',
      color: 'var(--text-primary)'
    }
  }, value), delta && /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: tone
  }, delta)));
}
Object.assign(__ds_scope, { KpiCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/KpiCard.jsx", error: String((e && e.message) || e) }); }

// components/data/Table.jsx
try { (() => {
function Table({
  columns,
  rows,
  variant = 'report'
}) {
  const wrapStyle = variant === 'sign' ? {
    border: '1px solid var(--sign-border, var(--border-hairline))',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden'
  } : {
    border: '1px solid var(--border-hairline)',
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden'
  };
  const headStyle = variant === 'sign' ? {
    background: 'var(--sign-secondary, #F7F6E9)',
    color: 'var(--text-primary)'
  } : {
    background: 'var(--color-ink)',
    color: '#fff'
  };
  return /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontFamily: 'var(--font-body)',
      ...wrapStyle
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, columns.map(c => /*#__PURE__*/React.createElement("th", {
    key: c.key,
    style: {
      ...headStyle,
      textAlign: 'left',
      padding: '10px 14px',
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.06em'
    }
  }, c.label)))), /*#__PURE__*/React.createElement("tbody", null, rows.map((r, i) => /*#__PURE__*/React.createElement("tr", {
    key: i,
    style: {
      background: i % 2 ? 'var(--row-stripe)' : 'transparent'
    }
  }, columns.map(c => /*#__PURE__*/React.createElement("td", {
    key: c.key,
    style: {
      padding: '9px 14px',
      fontSize: 13,
      borderTop: '1px solid var(--border-hairline)',
      color: 'var(--text-primary)'
    }
  }, c.render ? c.render(r[c.key], r) : r[c.key]))))));
}
Object.assign(__ds_scope, { Table });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Table.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
function Dialog({
  open,
  title,
  children,
  onClose,
  footer
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(20,20,20,0.45)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      background: '#fff',
      borderRadius: 'var(--radius-lg)',
      width: 420,
      maxWidth: '90vw',
      boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      padding: 28,
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, title && /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-display)',
      fontSize: 19,
      fontWeight: 700,
      color: 'var(--text-primary)'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--text-primary)',
      lineHeight: 1.5
    }
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 10
    }
  }, footer)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
const {
  useState
} = React;
function Tooltip({
  label,
  children,
  side = 'top'
}) {
  const [show, setShow] = useState(false);
  const pos = {
    top: {
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginBottom: 8
    },
    bottom: {
      top: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginTop: 8
    }
  }[side] || {};
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'inline-flex'
    },
    onMouseEnter: () => setShow(true),
    onMouseLeave: () => setShow(false)
  }, children, show && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      ...pos,
      background: 'var(--color-ink)',
      color: '#fff',
      fontSize: 11,
      fontFamily: 'var(--font-body)',
      padding: '5px 9px',
      borderRadius: 6,
      whiteSpace: 'nowrap',
      boxShadow: 'var(--shadow-card-hover)',
      zIndex: 10
    }
  }, label));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function Checkbox({
  label,
  checked,
  onChange,
  disabled = false
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      fontFamily: 'var(--font-body)',
      fontSize: 14,
      color: 'var(--text-primary)',
      opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 18,
      height: 18,
      borderRadius: 4,
      flex: 'none',
      border: `1.5px solid ${checked ? 'var(--color-green-darker)' : 'var(--border-hairline)'}`,
      background: checked ? 'var(--color-green)' : '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, checked && /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "9",
    viewBox: "0 0 11 9",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M1 4.5L4 7.5L10 1",
    stroke: "var(--color-ink)",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }))), /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: checked,
    onChange: onChange,
    disabled: disabled,
    style: {
      display: 'none'
    }
  }), label);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
const {
  useState
} = React;
function Input({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  error = null,
  disabled = false
}) {
  const [focused, setFocused] = useState(false);
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      fontFamily: 'var(--font-body)',
      width: '100%'
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--text-primary)'
    }
  }, label), /*#__PURE__*/React.createElement("input", {
    type: type,
    placeholder: placeholder,
    value: value,
    onChange: onChange,
    disabled: disabled,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: {
      height: 44,
      borderRadius: 'var(--sign-radius-control, 4px)',
      padding: '0 14px',
      border: `1px solid ${error ? 'var(--color-alert-red)' : focused ? 'var(--color-blue-darker)' : 'var(--border-hairline)'}`,
      outline: focused ? '3px solid var(--color-blue-soft)' : 'none',
      fontSize: 14,
      fontFamily: 'var(--font-body)',
      color: 'var(--text-primary)',
      background: disabled ? 'var(--color-line)' : '#fff',
      opacity: disabled ? 0.6 : 1
    }
  }), error && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--color-alert-red)'
    }
  }, error));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
const {
  useState
} = React;
function Select({
  label,
  options = [],
  value,
  onChange,
  disabled = false
}) {
  const [focused, setFocused] = useState(false);
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      fontFamily: 'var(--font-body)',
      width: '100%'
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--text-primary)'
    }
  }, label), /*#__PURE__*/React.createElement("select", {
    value: value,
    onChange: onChange,
    disabled: disabled,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: {
      height: 44,
      borderRadius: 'var(--sign-radius-control, 4px)',
      padding: '0 14px',
      border: `1px solid ${focused ? 'var(--color-blue-darker)' : 'var(--border-hairline)'}`,
      outline: focused ? '3px solid var(--color-blue-soft)' : 'none',
      fontSize: 14,
      fontFamily: 'var(--font-body)',
      color: 'var(--text-primary)',
      background: '#fff'
    }
  }, options.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.value ?? o,
    value: o.value ?? o
  }, o.label ?? o))));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function Switch({
  checked,
  onChange,
  label,
  disabled = false
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      fontFamily: 'var(--font-body)',
      fontSize: 14,
      color: 'var(--text-primary)',
      opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: () => !disabled && onChange && onChange({
      target: {
        checked: !checked
      }
    }),
    style: {
      width: 40,
      height: 22,
      borderRadius: 999,
      position: 'relative',
      flex: 'none',
      background: checked ? 'var(--color-green)' : 'var(--color-line)',
      transition: 'background .15s ease'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 2,
      left: checked ? 20 : 2,
      width: 18,
      height: 18,
      borderRadius: '50%',
      background: '#fff',
      boxShadow: '0 1px 2px rgba(0,0,0,.25)',
      transition: 'left .15s ease'
    }
  })), label);
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
const {
  useState
} = React;
function Tabs({
  items,
  defaultValue,
  onChange
}) {
  const [active, setActive] = useState(defaultValue || items[0] && items[0].value);
  const select = v => {
    setActive(v);
    onChange && onChange(v);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      borderBottom: '1px solid var(--border-hairline)'
    }
  }, items.map(it => {
    const isActive = it.value === active;
    return /*#__PURE__*/React.createElement("button", {
      key: it.value,
      onClick: () => select(it.value),
      style: {
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        padding: '10px 16px',
        fontFamily: 'var(--font-body)',
        fontSize: 14,
        fontWeight: 600,
        color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
        borderBottom: isActive ? '2px solid var(--color-ink)' : '2px solid transparent',
        marginBottom: -1
      }
    }, it.label);
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/report/AccentSquares.jsx
try { (() => {
const COLORS = ['var(--color-green)', 'var(--color-blue)', 'var(--color-pink)', 'var(--color-orange)'];
function AccentSquares({
  count = 3,
  seed = 1
}) {
  const squares = Array.from({
    length: Math.min(count, 4)
  }, (_, i) => {
    const r = (seed * 97 + i * 53) % 100;
    return {
      top: `${8 + (seed * 13 + i * 29) % 70}%`,
      left: `${8 + (seed * 31 + i * 41) % 80}%`,
      size: 10 + r % 8,
      rotate: -30 + r % 60,
      color: COLORS[(seed + i) % 4]
    };
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      overflow: 'hidden'
    }
  }, squares.map((s, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      position: 'absolute',
      top: s.top,
      left: s.left,
      width: s.size,
      height: s.size,
      background: s.color,
      borderRadius: 3,
      transform: `rotate(${s.rotate}deg)`
    }
  })));
}
Object.assign(__ds_scope, { AccentSquares });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/report/AccentSquares.jsx", error: String((e && e.message) || e) }); }

// components/report/ChevronFlow.jsx
try { (() => {
function ChevronFlow({
  steps
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'stretch'
    }
  }, steps.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: s.color || 'var(--color-blue-soft)',
      padding: '14px 18px',
      borderRadius: 8,
      fontFamily: 'var(--font-body)',
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--text-primary)'
    }
  }, s.label), i < steps.length - 1 && /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "24",
    viewBox: "0 0 18 24",
    style: {
      flex: 'none',
      margin: '0 -2px'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2 2L14 12L2 22",
    stroke: "var(--text-muted)",
    strokeWidth: "2",
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })))));
}
Object.assign(__ds_scope, { ChevronFlow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/report/ChevronFlow.jsx", error: String((e && e.message) || e) }); }

// components/report/InsightNote.jsx
try { (() => {
function InsightNote({
  children,
  accent = 'var(--color-blue)'
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderLeft: `4px solid ${accent}`,
      background: 'var(--surface-card)',
      padding: '10px 16px',
      fontSize: 13,
      lineHeight: 1.5,
      color: 'var(--text-primary)',
      borderRadius: '0 6px 6px 0'
    }
  }, children);
}
Object.assign(__ds_scope, { InsightNote });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/report/InsightNote.jsx", error: String((e && e.message) || e) }); }

// components/report/TermItem.jsx
try { (() => {
function TermItem({
  label,
  value,
  featured = false,
  included = false
}) {
  if (included) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        border: '1.5px dashed var(--border-hairline)',
        background: 'var(--color-beige)',
        borderRadius: 8,
        padding: '12px 16px 12px 22px',
        fontSize: 13,
        color: 'var(--text-primary)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: -1,
        left: -1,
        width: 14,
        height: 14,
        background: 'var(--color-green)',
        borderRadius: '4px 0 4px 0'
      }
    }), label);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderLeft: `3px solid ${featured ? 'var(--color-orange)' : 'var(--border-hairline)'}`,
      background: 'var(--color-beige)',
      padding: '10px 14px',
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 13,
      color: 'var(--text-primary)'
    }
  }, /*#__PURE__*/React.createElement("span", null, label), value && /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700
    },
    className: "num"
  }, value));
}
Object.assign(__ds_scope, { TermItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/report/TermItem.jsx", error: String((e && e.message) || e) }); }

// ui_kits/executive-report/FunnelPage.jsx
try { (() => {
const bars = [{
  label: 'Philippines',
  value: 22,
  color: 'var(--color-blue)'
}, {
  label: 'Colombia',
  value: 34,
  color: 'var(--color-green)'
}, {
  label: 'Egypt',
  value: 18,
  color: 'var(--color-blue)'
}, {
  label: 'Kenya',
  value: 15,
  color: 'var(--color-blue)'
}, {
  label: 'India',
  value: 20,
  color: 'var(--color-blue)'
}, {
  label: 'Mexico',
  value: 24,
  color: 'var(--color-blue)'
}];
function FunnelPage({
  KpiCard,
  InsightNote,
  ChevronFlow
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-beige)',
      width: '100%',
      height: '100%',
      padding: '40px 52px',
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      fontFamily: 'var(--font-body)'
    }
  }, /*#__PURE__*/React.createElement(Header, {
    page: "2"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, "Application to hire funnel"), /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: '4px 0 0',
      fontFamily: 'var(--font-display)',
      fontSize: 26,
      fontWeight: 700,
      letterSpacing: '-0.02em'
    }
  }, "Every market moved candidates faster this month")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(KpiCard, {
    label: "Applications",
    value: "23,868",
    delta: "+12.4%",
    tone: "success"
  }), /*#__PURE__*/React.createElement(KpiCard, {
    label: "Conversion rate",
    value: "30.1%",
    delta: "+2.6pt",
    tone: "success"
  }), /*#__PURE__*/React.createElement(KpiCard, {
    label: "Time to fill",
    value: "4.2d",
    delta: "-1.1d",
    tone: "info"
  }), /*#__PURE__*/React.createElement(KpiCard, {
    label: "Backlog",
    value: "612",
    delta: "-8.0%",
    tone: "success"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      border: '1px solid var(--border-hairline)',
      borderRadius: 10,
      padding: '20px 22px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 18,
      height: 120
    }
  }, bars.map(b => /*#__PURE__*/React.createElement("div", {
    key: b.label,
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700
    },
    className: "num"
  }, b.value, "%"), /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      height: b.value * 2.6,
      background: b.color,
      borderRadius: 4
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: 'var(--text-muted)'
    }
  }, b.label))))), /*#__PURE__*/React.createElement(InsightNote, {
    accent: "var(--color-green)"
  }, "Colombia's conversion rate held above 30% for the third straight month, the best of any market this quarter."), /*#__PURE__*/React.createElement(ChevronFlow, {
    steps: [{
      label: 'Sourced · 23,868',
      color: 'var(--color-green-soft)'
    }, {
      label: 'Screened · 9,120',
      color: 'var(--color-blue-soft)'
    }, {
      label: 'Interviewed · 3,340',
      color: 'var(--color-pink-soft)'
    }, {
      label: 'Hired · 1,006',
      color: 'var(--color-orange-soft)'
    }]
  }), /*#__PURE__*/React.createElement(Footer, {
    page: "2"
  }));
}
function Header() {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-mark.jpg",
    alt: "Talkpush",
    style: {
      width: 26,
      height: 26,
      borderRadius: 6
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--text-muted)'
    }
  }, "Funnel Report \xB7 August 2026")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: 'var(--border-hairline)',
      marginTop: 10
    }
  }));
}
function Footer({
  page
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 10,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
      marginTop: 'auto'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Talkpush \xB7 Business Operations"), /*#__PURE__*/React.createElement("span", null, "Page ", page, " of 3 \xB7 Confidential"));
}
window.FunnelPage = FunnelPage;
window.Header = Header;
window.Footer = Footer;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/executive-report/FunnelPage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/executive-report/ReportApp.jsx
try { (() => {
const {
  KpiCard,
  InsightNote,
  ChevronFlow,
  Table,
  Badge,
  AccentSquares
} = window.TalkpushDesignSystem_0ed2b8;
function ReportApp() {
  const [page, setPage] = React.useState(0);
  const pages = [/*#__PURE__*/React.createElement(ReportCoverPage, {
    AccentSquares: AccentSquares
  }), /*#__PURE__*/React.createElement(FunnelPage, {
    KpiCard: KpiCard,
    InsightNote: InsightNote,
    ChevronFlow: ChevronFlow
  }), /*#__PURE__*/React.createElement(StatusPage, {
    Table: Table,
    InsightNote: InsightNote,
    Badge: Badge
  })];
  const labels = ['Cover', 'Funnel', 'Market status'];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16,
      padding: '30px 0',
      background: '#e9e6da',
      minHeight: '100vh'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, labels.map((l, i) => /*#__PURE__*/React.createElement("button", {
    key: l,
    onClick: () => setPage(i),
    style: {
      border: 'none',
      borderRadius: 999,
      padding: '8px 16px',
      cursor: 'pointer',
      fontFamily: 'var(--font-body)',
      fontSize: 13,
      fontWeight: 600,
      background: page === i ? 'var(--color-ink)' : '#fff',
      color: page === i ? '#fff' : 'var(--text-primary)'
    }
  }, l))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 794,
      height: 1000,
      boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
      overflow: 'hidden'
    }
  }, pages[page]));
}
window.ReportApp = ReportApp;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/executive-report/ReportApp.jsx", error: String((e && e.message) || e) }); }

// ui_kits/executive-report/ReportCoverPage.jsx
try { (() => {
function ReportCoverPage({
  AccentSquares
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      background: 'var(--color-beige)',
      width: '100%',
      height: '100%',
      padding: '56px 60px',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-body)'
    }
  }, /*#__PURE__*/React.createElement(AccentSquares, {
    count: 4,
    seed: 5
  }), /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-mark.jpg",
    alt: "Talkpush",
    style: {
      width: 40,
      height: 40,
      borderRadius: 9
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: 18,
      maxWidth: 640
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, "Funnel report \xB7 August 2026"), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-display)',
      fontSize: 46,
      fontWeight: 500,
      letterSpacing: '-0.03em',
      lineHeight: 1.08,
      color: 'var(--text-primary)'
    }
  }, "Colombia converted 1 in 3 qualified candidates, the best rate across all six markets"), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 10,
      width: 220,
      borderRadius: 5,
      background: 'var(--gradient-signature)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 11,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Talkpush \xB7 Business Operations"), /*#__PURE__*/React.createElement("span", null, "Page 1 of 3 \xB7 Confidential")));
}
window.ReportCoverPage = ReportCoverPage;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/executive-report/ReportCoverPage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/executive-report/StatusPage.jsx
try { (() => {
const rows = [{
  market: 'Colombia',
  apps: '5,120',
  rate: '34.0%',
  status: 'Resolved'
}, {
  market: 'Philippines',
  apps: '7,860',
  rate: '22.0%',
  status: 'In progress'
}, {
  market: 'Mexico',
  apps: '3,410',
  rate: '24.0%',
  status: 'In progress'
}, {
  market: 'Egypt',
  apps: '2,905',
  rate: '18.0%',
  status: 'Aging 14d'
}, {
  market: 'Kenya',
  apps: '2,140',
  rate: '15.0%',
  status: 'Aging 30d'
}];
const toneFor = s => s === 'Resolved' ? 'success' : s.startsWith('Aging 30') ? 'danger' : s.startsWith('Aging 14') ? 'warning' : 'info';
function StatusPage({
  Table,
  InsightNote,
  Badge
}) {
  const columns = [{
    key: 'market',
    label: 'Market'
  }, {
    key: 'apps',
    label: 'Applications'
  }, {
    key: 'rate',
    label: 'Conversion'
  }, {
    key: 'status',
    label: 'Status',
    render: s => /*#__PURE__*/React.createElement(Badge, {
      tone: toneFor(s)
    }, s)
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-beige)',
      width: '100%',
      height: '100%',
      padding: '40px 52px',
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
      fontFamily: 'var(--font-body)'
    }
  }, /*#__PURE__*/React.createElement(Header, null), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, "Market breakdown"), /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: '4px 0 0',
      fontFamily: 'var(--font-display)',
      fontSize: 26,
      fontWeight: 700,
      letterSpacing: '-0.02em'
    }
  }, "Two markets need attention on aging applications")), /*#__PURE__*/React.createElement(Table, {
    variant: "report",
    columns: columns,
    rows: rows
  }), /*#__PURE__*/React.createElement(InsightNote, {
    accent: "var(--color-orange)"
  }, "Egypt and Kenya are the two markets carrying aged applications past the 14-day mark. Recommend a targeted recruiter push this week."), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      border: '1px solid var(--border-hairline)',
      borderRadius: 10,
      padding: '14px 18px',
      fontSize: 12,
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--text-primary)'
    }
  }, "Data notes."), " Kenya's application count excludes the last three days of the period; the recruiting center's export job was delayed. All other markets are complete through August 14."), /*#__PURE__*/React.createElement(Footer, {
    page: "3"
  }));
}
window.StatusPage = StatusPage;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/executive-report/StatusPage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/pricing-proposal/ModulesPage.jsx
try { (() => {
const modules = [{
  title: 'Sourcing',
  color: 'var(--color-green)',
  tint: 'var(--color-green-lightest)',
  items: ['Social & job-board attraction', 'Referral capture', 'Landing page builder']
}, {
  title: 'Manage & Convert',
  color: 'var(--color-blue)',
  tint: 'var(--color-blue-lightest)',
  items: ['Conversational screening', 'Voice AI interviews', 'Recruiter dashboard']
}, {
  title: 'Hire & Onboard',
  color: 'var(--color-pink)',
  tint: 'var(--color-pink-lightest)',
  items: ['Offer & e-signature', 'Document collection', 'Day-one Q&A bot']
}];
function ModulesPage() {
  return /*#__PURE__*/React.createElement("div", {
    className: "context-proposal",
    style: {
      background: '#fff',
      width: '100%',
      height: '100%',
      padding: '48px 56px',
      display: 'flex',
      flexDirection: 'column',
      gap: 22,
      fontFamily: 'var(--font-body)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'var(--color-orange)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, "Meet the platform")), /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-display)',
      fontSize: 24,
      fontWeight: 700,
      letterSpacing: '-0.02em',
      color: '#000'
    }
  }, "Three modules cover the full candidate journey"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      flex: 1
    }
  }, modules.map(m => /*#__PURE__*/React.createElement("div", {
    key: m.title,
    style: {
      flex: 1,
      border: '1px solid var(--border-hairline)',
      borderRadius: 10,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: m.color,
      padding: '14px 16px',
      fontWeight: 700,
      fontSize: 14,
      color: '#000'
    }
  }, m.title), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      background: 'var(--color-beige)',
      flex: 1
    }
  }, m.items.map(it => /*#__PURE__*/React.createElement("div", {
    key: it,
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 15,
      height: 15,
      flex: 'none',
      borderRadius: 4,
      background: m.tint,
      marginTop: 1
    }
  }), /*#__PURE__*/React.createElement("span", null, it))))))));
}
window.ModulesPage = ModulesPage;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/pricing-proposal/ModulesPage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/pricing-proposal/PricingPage.jsx
try { (() => {
function PricingPage({
  Table,
  TermItem
}) {
  const columns = [{
    key: 'tier',
    label: 'Tier'
  }, {
    key: 'module',
    label: 'Module'
  }, {
    key: 'price',
    label: 'Monthly'
  }];
  const rows = [{
    tier: 'Tier 1',
    module: 'Sourcing',
    price: '$4,200'
  }, {
    tier: 'Tier 2',
    module: 'Manage & Convert',
    price: '$6,800'
  }, {
    tier: 'Tier 3',
    module: 'Hire & Onboard',
    price: '$3,900'
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "context-proposal",
    style: {
      background: '#fff',
      width: '100%',
      height: '100%',
      padding: '48px 56px',
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      fontFamily: 'var(--font-body)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'var(--color-orange)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, "Pricing")), /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-display)',
      fontSize: 24,
      fontWeight: 700,
      letterSpacing: '-0.02em',
      color: '#000'
    }
  }, "Three modules, one monthly rate"), /*#__PURE__*/React.createElement(Table, {
    variant: "report",
    columns: columns,
    rows: rows
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 10,
      padding: '18px 22px',
      background: 'var(--gradient-signature)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: '#000'
    }
  }, "Total monthly investment"), /*#__PURE__*/React.createElement("span", {
    className: "num",
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 30,
      fontWeight: 700,
      color: '#000'
    }
  }, "$14,900")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(TermItem, {
    label: "Contract length",
    value: "12 months",
    featured: true
  }), /*#__PURE__*/React.createElement(TermItem, {
    label: "Onboarding support included",
    included: true
  })));
}
window.PricingPage = PricingPage;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/pricing-proposal/PricingPage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/pricing-proposal/ProposalApp.jsx
try { (() => {
const {
  Table,
  TermItem
} = window.TalkpushDesignSystem_0ed2b8;
function ProposalApp() {
  const [page, setPage] = React.useState(0);
  const pages = [/*#__PURE__*/React.createElement(ProposalCoverPage, null), /*#__PURE__*/React.createElement(ModulesPage, null), /*#__PURE__*/React.createElement(PricingPage, {
    Table: Table,
    TermItem: TermItem
  })];
  const labels = ['Cover', 'Modules', 'Pricing & terms'];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16,
      padding: '30px 0',
      background: '#e9e6da',
      minHeight: '100vh'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, labels.map((l, i) => /*#__PURE__*/React.createElement("button", {
    key: l,
    onClick: () => setPage(i),
    style: {
      border: 'none',
      borderRadius: 999,
      padding: '8px 16px',
      cursor: 'pointer',
      fontFamily: 'var(--font-body)',
      fontSize: 13,
      fontWeight: 600,
      background: page === i ? '#000' : '#fff',
      color: page === i ? '#fff' : 'var(--text-primary)'
    }
  }, l))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 816,
      height: 1000,
      boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
      overflow: 'hidden'
    }
  }, pages[page]));
}
window.ProposalApp = ProposalApp;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/pricing-proposal/ProposalApp.jsx", error: String((e && e.message) || e) }); }

// ui_kits/pricing-proposal/ProposalCoverPage.jsx
try { (() => {
function ProposalCoverPage() {
  return /*#__PURE__*/React.createElement("div", {
    className: "context-proposal",
    style: {
      background: '#fff',
      width: '100%',
      height: '100%',
      padding: '64px 70px',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-body)'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-mark.jpg",
    alt: "Talkpush",
    style: {
      width: 36,
      height: 36,
      borderRadius: 8
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: 22,
      maxWidth: 560
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 10,
      width: 200,
      borderRadius: 3,
      background: 'var(--gradient-signature)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'var(--color-orange)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, "Pricing proposal")), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-display)',
      fontSize: 40,
      fontWeight: 700,
      letterSpacing: '-0.04em',
      lineHeight: 1.1,
      color: '#000'
    }
  }, "Workforce automation for Concentrix, sourcing through onboarding"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--text-muted)'
    }
  }, "Prepared for Concentrix \xB7 August 2026")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 56,
      background: 'var(--color-green)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 56,
      background: 'var(--color-blue)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 56,
      background: 'var(--color-pink)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 56,
      background: 'var(--color-orange)'
    }
  })));
}
window.ProposalCoverPage = ProposalCoverPage;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/pricing-proposal/ProposalCoverPage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/sign-app/DocumentList.jsx
try { (() => {
const DOCS = [{
  name: 'Offer letter — Maria Santos',
  sent: 'Aug 12',
  status: 'Completed'
}, {
  name: 'NDA — Contractor batch 3',
  sent: 'Aug 12',
  status: 'Pending'
}, {
  name: 'Background check consent — J. Cruz',
  sent: 'Aug 11',
  status: 'Viewed'
}, {
  name: 'Offer letter — Ana Reyes',
  sent: 'Aug 10',
  status: 'Voided'
}, {
  name: 'Onboarding packet — Q3 cohort',
  sent: 'Aug 9',
  status: 'Completed'
}];
const toneFor = s => ({
  Completed: 'success',
  Pending: 'attention',
  Viewed: 'info',
  Voided: 'neutral'
})[s] || 'neutral';
function DocumentList({
  Table,
  Badge,
  Input,
  Tabs,
  onOpen
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: '28px 32px',
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      color: 'var(--sign-muted-foreground)'
    }
  }, "Inbox"), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: '2px 0 0',
      fontFamily: 'var(--font-body)',
      fontSize: 22,
      fontWeight: 700,
      color: 'var(--sign-foreground)'
    }
  }, "Documents")), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 220
    }
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "Search documents"
  }))), /*#__PURE__*/React.createElement(Tabs, {
    items: [{
      label: 'All',
      value: 'all'
    }, {
      label: 'Pending signature',
      value: 'pending'
    }, {
      label: 'Completed',
      value: 'done'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    className: "context-sign",
    style: {
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement(Table, {
    variant: "sign",
    columns: [{
      key: 'name',
      label: 'Document'
    }, {
      key: 'sent',
      label: 'Sent'
    }, {
      key: 'status',
      label: 'Status',
      render: s => /*#__PURE__*/React.createElement(Badge, {
        tone: toneFor(s)
      }, s)
    }],
    rows: DOCS.map(d => ({
      ...d,
      name: /*#__PURE__*/React.createElement("span", {
        onClick: () => onOpen(d),
        style: {
          cursor: 'pointer',
          fontWeight: 600
        }
      }, d.name)
    }))
  })));
}
window.DocumentList = DocumentList;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/sign-app/DocumentList.jsx", error: String((e && e.message) || e) }); }

// ui_kits/sign-app/SidebarNav.jsx
try { (() => {
const NAV = [{
  label: 'Inbox',
  icon: '\u25A3'
}, {
  label: 'Sent',
  icon: '\u25B3'
}, {
  label: 'Templates',
  icon: '\u25C7'
}, {
  label: 'Settings',
  icon: '\u2699'
}];
function SidebarNav({
  active,
  onSelect
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 208,
      background: 'var(--sign-card)',
      borderRight: '1px solid var(--sign-border)',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 6,
      background: 'var(--sign-gradient)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '18px 18px 10px'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-mark.jpg",
    alt: "Talkpush",
    style: {
      width: 28,
      height: 28,
      borderRadius: 7
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 15,
      color: 'var(--sign-foreground)'
    }
  }, "Sign")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      padding: '10px 10px'
    }
  }, NAV.map(n => /*#__PURE__*/React.createElement("div", {
    key: n.label,
    onClick: () => onSelect(n.label),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '9px 12px',
      borderRadius: 6,
      cursor: 'pointer',
      fontSize: 14,
      fontWeight: 600,
      color: active === n.label ? 'var(--sign-foreground)' : 'var(--sign-muted-foreground)',
      background: active === n.label ? 'var(--sign-secondary)' : 'transparent'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      width: 20,
      textAlign: 'center'
    }
  }, n.icon), n.label))));
}
window.SidebarNav = SidebarNav;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/sign-app/SidebarNav.jsx", error: String((e && e.message) || e) }); }

// ui_kits/sign-app/SignApp.jsx
try { (() => {
const {
  Table,
  Badge,
  Input,
  Tabs,
  Dialog,
  Button
} = window.TalkpushDesignSystem_0ed2b8;
function SignApp() {
  const [active, setActive] = React.useState('Inbox');
  const [doc, setDoc] = React.useState(null);
  return /*#__PURE__*/React.createElement("div", {
    className: "context-sign",
    style: {
      display: 'flex',
      minHeight: '100vh',
      background: 'var(--sign-background)',
      fontFamily: 'var(--font-body)'
    }
  }, /*#__PURE__*/React.createElement(SidebarNav, {
    active: active,
    onSelect: setActive
  }), /*#__PURE__*/React.createElement(DocumentList, {
    Table: Table,
    Badge: Badge,
    Input: Input,
    Tabs: Tabs,
    onOpen: setDoc
  }), /*#__PURE__*/React.createElement(Dialog, {
    open: !!doc,
    title: doc ? doc.name : '',
    onClose: () => setDoc(null),
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      onClick: () => setDoc(null)
    }, "Close"), /*#__PURE__*/React.createElement(Button, {
      variant: "cta",
      onClick: () => setDoc(null)
    }, "Sign document"))
  }, "Review the document, then sign to complete this request. This action cannot be undone."));
}
window.SignApp = SignApp;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/sign-app/SignApp.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.KpiCard = __ds_scope.KpiCard;

__ds_ns.Table = __ds_scope.Table;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.AccentSquares = __ds_scope.AccentSquares;

__ds_ns.ChevronFlow = __ds_scope.ChevronFlow;

__ds_ns.InsightNote = __ds_scope.InsightNote;

__ds_ns.TermItem = __ds_scope.TermItem;

})();
