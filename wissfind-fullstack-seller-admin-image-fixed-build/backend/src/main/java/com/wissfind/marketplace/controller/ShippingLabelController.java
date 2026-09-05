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
import java.util.stream.Stream;

@RestController
@RequestMapping("/api/shipping-labels")
public class ShippingLabelController {
    private final OrderRepository orders;
    private final SellerApplicationRepository applications;

    public ShippingLabelController(OrderRepository orders, SellerApplicationRepository applications) {
        this.orders = orders;
        this.applications = applications;
    }

    /** Creates one complete 4x6 printable shipping label page per order. */
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

        SellerApplication seller = order.seller == null
                ? null
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

        // Exactly one 4 x 6 inch thermal-label page for the complete order.
        Document document = new Document(new Rectangle(283.46f, 425.20f), 14, 14, 12, 12);
        PdfWriter.getInstance(document, out);
        document.open();

        Font brand = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 19);
        Font title = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10);
        Font heading = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8);
        Font normal = FontFactory.getFont(FontFactory.HELVETICA, 7);
        Font bold = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8);
        Font tiny = FontFactory.getFont(FontFactory.HELVETICA, 6.5f);
        Font cod = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13);

        document.add(new Paragraph("WISSFIND", brand));
        Paragraph labelTitle = new Paragraph("SHIPPING LABEL", title);
        labelTitle.setSpacingAfter(5);
        document.add(labelTitle);

        PdfPTable addresses = new PdfPTable(2);
        addresses.setWidthPercentage(100);
        addresses.setWidths(new float[]{1, 1});
        addresses.addCell(box("PICKUP FROM", pickupAddress(seller), heading, normal));
        addresses.addCell(box("DELIVER TO", deliveryAddress(order), heading, normal));
        document.add(addresses);
        document.add(Chunk.NEWLINE);

        // Make COD collection impossible to miss for the delivery person.
        boolean codOrder = isCod(order);
        PdfPTable paymentBox = new PdfPTable(2);
        paymentBox.setWidthPercentage(100);
        paymentBox.setWidths(new float[]{1, 1});
        paymentBox.addCell(lineCell("SHIPMENT / ORDER", order.orderNumber, bold, tiny));
        if (codOrder) {
            paymentBox.addCell(highlightCell("COD - COLLECT FROM CUSTOMER",
                    "₹" + money(order.total), cod, tiny));
        } else {
            paymentBox.addCell(highlightCell("PAYMENT",
                    "PREPAID - NO COLLECTION", bold, tiny));
        }
        document.add(paymentBox);
        document.add(Chunk.NEWLINE);

        // Compact product snapshot so all products remain on the same label page.
        PdfPTable products = new PdfPTable(4);
        products.setWidthPercentage(100);
        products.setWidths(new float[]{3.8f, 1.6f, 0.8f, 1.4f});
        products.addCell(headerCell("PRODUCT", heading));
        products.addCell(headerCell("SKU / ID", heading));
        products.addCell(headerCell("QTY", heading));
        products.addCell(headerCell("CATEGORY", heading));

        for (OrderItem item : order.items) {
            products.addCell(valueCell(item.name, normal));
            products.addCell(valueCell(String.valueOf(item.productId), normal));
            products.addCell(valueCell(String.valueOf(item.quantity), normal));
            products.addCell(valueCell(safe(item.category), normal));
        }
        document.add(products);
        document.add(Chunk.NEWLINE);

        PdfPTable status = new PdfPTable(2);
        status.setWidthPercentage(100);
        status.setWidths(new float[]{1, 1});
        status.addCell(lineCell("DELIVERY", safe(order.deliveryStatus), bold, tiny));
        status.addCell(lineCell("PACKAGE", "1 / 1", bold, tiny));
        document.add(status);

        document.add(Chunk.NEWLINE);
        Image barcode = barcode(order.orderNumber);
        barcode.scaleToFit(245, 42);
        barcode.setAlignment(Element.ALIGN_CENTER);
        document.add(barcode);

        Paragraph footer = new Paragraph(
                codOrder
                        ? "COD: Collect only the amount printed above. Paste securely and do not cover barcode."
                        : "PREPAID: No cash collection. Paste this label securely and do not cover barcode.",
                tiny);
        footer.setAlignment(Element.ALIGN_CENTER);
        footer.setSpacingBefore(4);
        document.add(footer);

        document.close();
        return out.toByteArray();
    }

    private PdfPCell box(String headingText, String value, Font heading, Font normal) {
        PdfPCell cell = new PdfPCell();
        cell.setPadding(6);
        cell.addElement(new Paragraph(headingText, heading));
        cell.addElement(new Paragraph(value, normal));
        return cell;
    }

    private PdfPCell lineCell(String label, String value, Font bold, Font small) {
        PdfPCell cell = new PdfPCell();
        cell.setPadding(5);
        cell.addElement(new Paragraph(label, bold));
        cell.addElement(new Paragraph(value, small));
        return cell;
    }

    private PdfPCell highlightCell(String label, String value, Font valueFont, Font small) {
        PdfPCell cell = new PdfPCell();
        cell.setPadding(5);
        cell.setBackgroundColor(new java.awt.Color(245, 245, 245));
        cell.addElement(new Paragraph(label, small));
        Paragraph amount = new Paragraph(value, valueFont);
        amount.setSpacingBefore(2);
        cell.addElement(amount);
        return cell;
    }

    private PdfPCell headerCell(String value, Font font) {
        PdfPCell cell = new PdfPCell(new Paragraph(value, font));
        cell.setPadding(4);
        cell.setBackgroundColor(new java.awt.Color(238, 238, 238));
        return cell;
    }

    private PdfPCell valueCell(String value, Font font) {
        PdfPCell cell = new PdfPCell(new Paragraph(safe(value), font));
        cell.setPadding(4);
        return cell;
    }

    private String pickupAddress(SellerApplication seller) {
        if (seller == null) return "Seller pickup address not available";
        return String.join(", ", Stream.of(
                seller.storeName, seller.ownerName, seller.pickupAddress,
                seller.city, seller.state, seller.pincode
        ).filter(v -> v != null && !v.isBlank()).toList());
    }

    private String deliveryAddress(Order order) {
        return String.join(", ", Stream.of(
                order.customer == null ? null : order.customer.name,
                order.address
        ).filter(v -> v != null && !v.isBlank()).toList());
    }

    private boolean isCod(Order order) {
        if (order.paymentMethod != null && !order.paymentMethod.isBlank()) {
            return "COD".equalsIgnoreCase(order.paymentMethod.trim());
        }
        return order.paymentStatus != null
                && order.paymentStatus.toUpperCase().contains("COD");
    }

    private String money(BigDecimal value) {
        if (value == null) return "0.00";
        return value.stripTrailingZeros().toPlainString();
    }

    private Image barcode(String value) throws Exception {
        var matrix = new MultiFormatWriter().encode(value, BarcodeFormat.CODE_128, 600, 100);
        BufferedImage buffered = MatrixToImageWriter.toBufferedImage(matrix);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(buffered, "png", out);
        return Image.getInstance(out.toByteArray());
    }

    private String safe(String value) {
        return value == null || value.isBlank() ? "—" : value;
    }
}
