import jsPDF from "jspdf";
import QRCode from "qrcode";

export interface ShippingLabelData {
  trackingId: string;
  orderNumber?: string | null;
  buyerName?: string | null;
  buyerPhone?: string | null;
  pickupPointName?: string | null;
  addressLine?: string | null;
  weightKg?: number;
  itemsSummary?: string[];
  originCountry?: string | null;
  boxTracking?: string | null;
}

const scanBaseUrl = () => `${window.location.origin}/rastreo`;

/** Builds the shipping guide PDF with a dynamic QR code linked to the tracking ID. */
export const generateShippingLabelPdf = async (data: ShippingLabelData): Promise<jsPDF> => {
  const doc = new jsPDF({ unit: "mm", format: [100, 150] });
  const qrUrl = `${scanBaseUrl()}/${encodeURIComponent(data.trackingId)}`;
  const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 1, width: 320 });

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("GUÍA DE ENVÍO", 50, 10, { align: "center" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Pedido: ${data.orderNumber ?? "-"}`, 6, 17);
  doc.text(`Origen: ${data.originCountry ?? "-"}`, 6, 22);
  if (data.boxTracking) doc.text(`Caja: ${data.boxTracking}`, 6, 27);

  doc.addImage(qrDataUrl, "PNG", 27, 30, 46, 46);
  doc.setFontSize(8);
  doc.text(data.trackingId, 50, 80, { align: "center", maxWidth: 90 });

  doc.setDrawColor(200);
  doc.line(6, 85, 94, 85);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("DESTINATARIO", 6, 91);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(data.buyerName ?? "-", 6, 96, { maxWidth: 88 });
  doc.text(data.buyerPhone ?? "-", 6, 101);
  doc.text(data.pickupPointName ? `Punto de entrega: ${data.pickupPointName}` : "Entrega a domicilio", 6, 106, { maxWidth: 88 });
  doc.text(data.addressLine ?? "-", 6, 111, { maxWidth: 88 });

  doc.line(6, 118, 94, 118);
  doc.setFont("helvetica", "bold");
  doc.text(`PESO: ${(data.weightKg ?? 0).toFixed(2)} kg`, 6, 124);
  doc.setFont("helvetica", "normal");

  let y = 130;
  (data.itemsSummary ?? []).slice(0, 5).forEach((line) => {
    doc.text(`• ${line}`, 6, y, { maxWidth: 88 });
    y += 4;
  });

  doc.setFontSize(6);
  doc.text("Escanea el QR para ver el estado en tiempo real", 50, 147, { align: "center" });
  return doc;
};

export const downloadShippingLabel = async (data: ShippingLabelData) => {
  const doc = await generateShippingLabelPdf(data);
  doc.save(`guia-${data.trackingId}.pdf`);
};

export const previewShippingLabel = async (data: ShippingLabelData): Promise<string> => {
  const doc = await generateShippingLabelPdf(data);
  return doc.output("dataurlstring");
};

export const printShippingLabel = async (data: ShippingLabelData) => {
  const doc = await generateShippingLabelPdf(data);
  doc.autoPrint();
  window.open(doc.output("bloburl") as unknown as string, "_blank");
};
