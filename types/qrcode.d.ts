declare module "qrcode" {
  type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";

  interface ToDataUrlOptions {
    errorCorrectionLevel?: ErrorCorrectionLevel;
    margin?: number;
    width?: number;
  }

  const QRCode: {
    toDataURL(text: string, options?: ToDataUrlOptions): Promise<string>;
  };

  export default QRCode;
}
