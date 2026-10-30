// Assertions in the existing browser fixtures retain Android's host contract.
// A browser accepting a CSS value or a block inside a text run is not evidence
// that the same presentation can be sent to a native View/Text.
const enums = {
  display: ['flex', 'none', 'contents'],
  position: ['absolute', 'relative', 'static'],
  flexDirection: ['row', 'row-reverse', 'column', 'column-reverse'],
  flexWrap: ['wrap', 'nowrap', 'wrap-reverse'],
};
const dimension = /^(?:width|height|minWidth|maxWidth|minHeight|maxHeight|top|right|bottom|left|start|end|padding\w*|margin\w*|gap|rowGap|columnGap|flexBasis|border\w*(?:Width|Radius)|fontSize|lineHeight|letterSpacing)$/;
export function assertNativePreviewStyle(style, host) {
  for (const [key, value] of Object.entries(style ?? {})) {
    if (value === undefined || value === null) continue;
    if (enums[key] && !enums[key].includes(value)) throw Error(`${host}: unsupported native ${key} ${String(value)}`);
    if (dimension.test(key) && typeof value === 'string' && !/^-?\d+(?:\.\d+)?%$/.test(value) && value !== 'auto') throw Error(`${host}: browser length passed to native ${key}: ${value}`);
    if (dimension.test(key) && typeof value === 'number' && !Number.isFinite(value)) throw Error(`${host}: non-finite native ${key}`);
  }
}

export function createNativePreviewHosts(React, RN, options = {}) {
  const InText = React.createContext(false);
  const normalizeStyle = options.normalizeStyle ?? (value => value);
  const normalizeLayout = options.normalizeLayout ?? (event => event);
  const scale = options.fontScale ?? 1;
  function useBoxContract(host) {
    const inText = React.useContext(InText);
    if (options.native !== false && inText) throw Error(`${host}: native layout box inside a Text run`);
  }
  function checkedStyle(value, host) {
    if (options.native !== false) assertNativePreviewStyle(RN.StyleSheet.flatten(value) ?? {}, host);
    return normalizeStyle(value);
  }
  const box = (name, Component) => React.forwardRef(({ style, onLayout, ...props }, ref) => {
    useBoxContract(name);
    return React.createElement(Component, {
      ...props, ref,
      ...(props.contentContainerStyle ? { contentContainerStyle: checkedStyle(props.contentContainerStyle, name + ' content') } : {}),
      onLayout: onLayout ? event => onLayout(normalizeLayout(event)) : undefined,
      style: typeof style === 'function' ? state => checkedStyle(style(state), name) : checkedStyle(style, name),
    });
  });
  const Text = React.forwardRef(({ style, allowFontScaling, children, ...props }, ref) => {
    const flat = RN.StyleSheet.flatten(style) ?? {};
    if (options.native !== false) assertNativePreviewStyle(flat, 'Text');
    const scaled = allowFontScaling === false ? {} : {
      fontSize: (flat.fontSize ?? 14) * scale,
      lineHeight: (flat.lineHeight ?? (flat.fontSize ?? 14) * 1.4) * scale,
    };
    return React.createElement(InText.Provider, { value: true },
      React.createElement(RN.Text, { ...props, ref, allowFontScaling, style: [flat, scaled] }, children));
  });
  const Modal = ({ children, ...props }) => React.createElement(RN.Modal, props,
    React.createElement(InText.Provider, { value: false }, children));
  return { View: box('View', RN.View), Pressable: box('Pressable', RN.Pressable), ScrollView: box('ScrollView', RN.ScrollView), Text, Modal };
}
