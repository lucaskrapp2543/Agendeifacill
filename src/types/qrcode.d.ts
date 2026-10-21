// Tipos mínimos do pacote "qrcode" (não traz declaração própria). Usado por
// PlacaQrGenerator e StoryGeneratorModal.
declare module 'qrcode' {
  export interface QRCodeRenderOptions {
    width?: number;
    margin?: number;
    scale?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    color?: { dark?: string; light?: string };
  }
  const QRCode: {
    toCanvas(canvas: HTMLCanvasElement, text: string, options?: QRCodeRenderOptions): Promise<void>;
    toDataURL(text: string, options?: QRCodeRenderOptions): Promise<string>;
  };
  export default QRCode;
}
