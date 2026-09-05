package com.wissfind.marketplace.controller;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.lowagie.text.*;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.wissfind.marketplace.entity.Order;
import com.wissfind.marketplace.entity.OrderItem;
import com.wissfind.marketplace.entity.SellerApplication;
import com.wissfind.marketplace.repo.OrderRepository;
import com.wissfind.marketplace.repo.SellerApplicationRepository;
import com.wissfind.marketplace.service.CurrentUser;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.util.Objects;

@RestController
@RequestMapping("/api/shipping-labels")
public class ShippingLabelController {
    private final OrderRepository orders;
    private final SellerApplicationRepository applications;

    public ShippingLabelController(OrderRepository orders, SellerApplicationRepository applications) {
        this.orders = orders;
        this.applications = applications;
    }

    /** Always creates exactly one printable 4x6 shipping-label page per order. */
    @GetMapping(value = "/order/{orderId}.pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    @PreAuthorize("hasAnyRole('SELLER','ADMIN')")
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> orderLabels(@PathVariable Long orderId) throws Exception {
        Order order = orders.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));
        authorize(order);

        if ("Cancelled".equalsIgnoreCase(order.deliveryStatus)) {
            throw new IllegalArgumentException("Shipping label is not available for a cancelled order");
        }
        if (order.items == null || order.items.isEmpty()) {
            throw new IllegalArgumentException("No products found in this order");
        }

        SellerApplication seller = order.seller == null ? null
                : applications.findByUserId(order.seller.id).orElse(null);
        byte[] pdf = buildPdf(order, seller);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.inline()
                .filename("WISSFIND-" + safe(order.orderNumber) + "-shipping-label.pdf")
                .build());
        return ResponseEntity.ok().headers(headers).body(pdf);
    }

    private void authorize(Order order) {
        if ("ADMIN".equals(CurrentUser.role())) return;
        if (order.seller == null || !Objects.equals(order.seller.id, CurrentUser.id())) {
            throw new IllegalArgumentException("You can print labels only for your own orders");
        }
    }

    private byte[] buildPdf(Order order, SellerApplication seller) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        // Exactly one 4 x 6 inch thermal-label page (100 x 150 mm).
        // Small margins and compact cells keep the complete label on one page.
        Document document = new Document(new Rectangle(283.46f, 425.20f), 10, 10, 10, 10);
        PdfWriter.getInstance(document, out);
        document.open();

        Font title = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 15);
        Font section = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8);
        Font value = FontFactory.getFont(FontFactory.HELVETICA, 7);
        Font valueBold = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8);
        Font tiny = FontFactory.getFont(FontFactory.HELVETICA, 6.5f);

        Paragraph brand = new Paragraph("WISSFIND", title);
        brand.setLeading(16);
        brand.setSpacingAfter(0);
        document.add(brand);

        Paragraph labelTitle = new Paragraph("SHIPPING LABEL", valueBold);
        labelTitle.setLeading(9);
        labelTitle.setSpacingAfter(4);
        document.add(labelTitle);

        PdfPTable addresses = new PdfPTable(2);
        addresses.setWidthPercentage(100);
        addresses.setWidths(new float[]{1, 1});
        addresses.addCell(box("PICKUP FROM", pickupAddress(seller), section, value));
        addresses.addCell(box("DELIVER TO", deliveryAddress(order), section, value));
        document.add(addresses);

        PdfPTable shipment = new PdfPTable(2);
        shipment.setWidthPercentage(100);
        shipment.setWidths(new float[]{1, 1});
        shipment.setSpacingBefore(4);
        shipment.addCell(lineCell("SHIPMENT / ORDER", safe(order.orderNumber), valueBold, tiny));
        shipment.addCell(codCell(order, valueBold, tiny));
        document.add(shipment);

        PdfPTable products = new PdfPTable(4);
        products.setWidthPercentage(100);
        products.setWidths(new float[]{3.8f, 1.7f, 0.8f, 1.4f});
        products.setSpacingBefore(4);
        products.addCell(headerCell("PRODUCT", section));
        products.addCell(headerCell("SKU / ID", section));
        products.addCell(headerCell("QTY", section));
        products.addCell(headerCell("CATEGORY", section));

        for (OrderItem item : order.items) {
            products.addCell(dataCell(item.name, value));
            products.addCell(dataCell(String.valueOf(item.productId), value));
            products.addCell(dataCell(String.valueOf(item.quantity), value));
            products.addCell(dataCell(safe(item.category), value));
        }
        document.add(products);

        PdfPTable delivery = new PdfPTable(2);
        delivery.setWidthPercentage(100);
        delivery.setWidths(new float[]{1, 1});
        delivery.setSpacingBefore(4);
        delivery.addCell(lineCell("DELIVERY", safe(order.deliveryStatus), valueBold, tiny));
        delivery.addCell(lineCell("PACKAGE", "1 / 1", valueBold, tiny));
        document.add(delivery);

        Image barcode = barcode(safe(order.orderNumber));
        barcode.scaleToFit(210, 34);
        barcode.setAlignment(Element.ALIGN_CENTER);
        barcode.setSpacingBefore(4);
        barcode.setSpacingAfter(1);
        document.add(barcode);

        Paragraph footer = new Paragraph(
                "COD: Collect only the amount printed above. Paste securely and do not cover barcode.", tiny);
        footer.setAlignment(Element.ALIGN_CENTER);
        footer.setLeading(7);
        footer.setSpacingBefore(0);
        document.add(footer);

        document.close();
        return out.toByteArray();
    }

    private PdfPCell box(String headingText, String valueText, Font heading, Font value) {
        PdfPCell cell = new PdfPCell();
        cell.setPadding(5);
        cell.setMinimumHeight(50);
        cell.addElement(paragraph(headingText, heading, 9));
        cell.addElement(paragraph(valueText, value, 8));
        return cell;
    }

    private PdfPCell lineCell(String label, String valueText, Font bold, Font small) {
        PdfPCell cell = new PdfPCell();
        cell.setPadding(4);
        cell.addElement(paragraph(label, bold, 8));
        cell.addElement(paragraph(valueText, small, 7));
        return cell;
    }

    private PdfPCell codCell(Order order, Font bold, Font small) {
        PdfPCell cell = new PdfPCell();
        cell.setPadding(4);
        boolean cod = "COD".equalsIgnoreCase(safe(order.paymentMethod));
        if (cod) {
            cell.addElement(paragraph("COD - COLLECT FROM CUSTOMER", bold, 8));
            cell.addElement(paragraph("₹" + amount(order.total), FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12), 12));
        } else {
            cell.addElement(paragraph("PREPAID - NO COLLECTION", bold, 8));
            cell.addElement(paragraph("₹0", small, 7));
        }
        return cell;
    }

    private PdfPCell headerCell(String text, Font font) {
        PdfPCell cell = new PdfPCell();
        cell.setPadding(3);
        cell.setBackgroundColor(new java.awt.Color(245, 245, 245));
        cell.addElement(paragraph(text, font, 7));
        return cell;
    }

    private PdfPCell dataCell(String text, Font font) {
        PdfPCell cell = new PdfPCell();
        cell.setPadding(3);
        cell.addElement(paragraph(safe(text), font, 7));
        return cell;
    }

    private Paragraph paragraph(String text, Font font, float leading) {
        Paragraph p = new Paragraph(safe(text), font);
        p.setLeading(leading);
        p.setSpacingBefore(0);
        p.setSpacingAfter(0);
        return p;
    }

    private String pickupAddress(SellerApplication seller) {
        if (seller == null) return "Seller pickup address not available";
        return String.join(", ", java.util.stream.Stream.of(
                seller.storeName, seller.ownerName, seller.pickupAddress,
                seller.city, seller.state, seller.pincode
        ).filter(v -> v != null && !v.isBlank()).toList());
    }

    private String deliveryAddress(Order order) {
        return String.join(", ", java.util.stream.Stream.of(
                order.customer == null ? null : order.customer.name,
                order.address
        ).filter(v -> v != null && !v.isBlank()).toList());
    }

    private Image barcode(String value) throws Exception {
        var matrix = new MultiFormatWriter().encode(value, BarcodeFormat.CODE_128, 500, 90);
        BufferedImage buffered = MatrixToImageWriter.toBufferedImage(matrix);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(buffered, "png", out);
        return Image.getInstance(out.toByteArray());
    }

    private String amount(BigDecimal value) {
        return value == null ? "0" : value.stripTrailingZeros().toPlainString();
    }

    private String safe(String value) {
        return value == null || value.isBlank() ? "—" : value;
    }
}
