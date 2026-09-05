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

    /** One printable shipping-label page is created for every product line in the order. */
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

        SellerApplication seller = applications.findByUserId(order.seller.id).orElse(null);
        byte[] pdf = buildPdf(order, seller);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.inline()
                .filename("WISSFIND-" + safe(order.orderNumber) + "-shipping-labels.pdf")
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
        Document document = new Document(PageSize.A5, 24, 24, 24, 24);
        PdfWriter.getInstance(document, out);
        document.open();

        Font title = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18);
        Font heading = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11);
        Font normal = FontFactory.getFont(FontFactory.HELVETICA, 9);
        Font bold = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10);
        Font small = FontFactory.getFont(FontFactory.HELVETICA, 8);

        for (int index = 0; index < order.items.size(); index++) {
            OrderItem item = order.items.get(index);

            Paragraph brand = new Paragraph("WISSFIND", title);
            brand.setSpacingAfter(2);
            document.add(brand);
            Paragraph labelTitle = new Paragraph("SHIPPING LABEL", heading);
            labelTitle.setSpacingAfter(8);
            document.add(labelTitle);

            PdfPTable addresses = new PdfPTable(2);
            addresses.setWidthPercentage(100);
            addresses.setWidths(new float[]{1, 1});
            addresses.addCell(box("PICKUP FROM", pickupAddress(seller), heading, normal));
            addresses.addCell(box("DELIVER TO", deliveryAddress(order), heading, normal));
            document.add(addresses);
            document.add(Chunk.NEWLINE);

            PdfPTable orderInfo = new PdfPTable(2);
            orderInfo.setWidthPercentage(100);
            orderInfo.setWidths(new float[]{1, 1});
            orderInfo.addCell(lineCell("Order", order.orderNumber, bold, small));
            orderInfo.addCell(lineCell("Payment", safe(order.paymentMethod), bold, small));
            orderInfo.addCell(lineCell("Product", item.name, bold, small));
            orderInfo.addCell(lineCell("Category", safe(item.category), bold, small));
            orderInfo.addCell(lineCell("Quantity", String.valueOf(item.quantity), bold, small));
            orderInfo.addCell(lineCell("Price", "₹" + (item.price == null ? "0" : item.price), bold, small));
            orderInfo.addCell(lineCell("Package", (index + 1) + " / " + order.items.size(), bold, small));
            orderInfo.addCell(lineCell("Delivery", safe(order.deliveryStatus), bold, small));
            document.add(orderInfo);

            document.add(Chunk.NEWLINE);
            Image barcode = barcode(order.orderNumber + "-" + item.id);
            barcode.scaleToFit(260, 55);
            barcode.setAlignment(Element.ALIGN_CENTER);
            document.add(barcode);

            Paragraph footer = new Paragraph(
                    "Paste this label securely on the outer package. Do not cover the barcode.", small);
            footer.setAlignment(Element.ALIGN_CENTER);
            footer.setSpacingBefore(8);
            document.add(footer);

            if (index < order.items.size() - 1) document.newPage();
        }

        document.close();
        return out.toByteArray();
    }

    private PdfPCell box(String headingText, String value, Font heading, Font normal) {
        PdfPCell cell = new PdfPCell();
        cell.setPadding(9);
        cell.addElement(new Paragraph(headingText, heading));
        cell.addElement(new Paragraph(value, normal));
        return cell;
    }

    private PdfPCell lineCell(String label, String value, Font bold, Font small) {
        PdfPCell cell = new PdfPCell();
        cell.setPadding(7);
        cell.addElement(new Paragraph(label, bold));
        cell.addElement(new Paragraph(value, small));
        return cell;
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
        var matrix = new MultiFormatWriter().encode(value, BarcodeFormat.CODE_128, 600, 120);
        BufferedImage buffered = MatrixToImageWriter.toBufferedImage(matrix);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(buffered, "png", out);
        return Image.getInstance(out.toByteArray());
    }

    private String safe(String value) {
        return value == null || value.isBlank() ? "—" : value;
    }
}
