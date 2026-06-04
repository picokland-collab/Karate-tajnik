declare module 'bwip-js' {
  interface BwipOptions {
    bcid:          string;
    text:          string;
    scale?:        number;
    columns?:      number;
    eclevel?:      number;
    encoding?:     string;
    includetext?:  boolean;
    [key: string]: unknown;
  }
  function toCanvas(canvas: HTMLCanvasElement, opts: BwipOptions): void;
  const _default: { toCanvas: typeof toCanvas };
  export default _default;
  export { toCanvas };
}
