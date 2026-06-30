import jsPDF from "jspdf";
import logo from "../assets/CampusCraves-Logo.png";

const PRIMARY = [37, 99, 235];
const SECONDARY = [59, 130, 246];
const SUCCESS = [22, 163, 74];

const DARK = [15, 23, 42];
const TEXT = [71, 85, 105];
const LIGHT = [248, 250, 252];
const BORDER = [226, 232, 240];
const WHITE = [255, 255, 255];

const formatDate = (date) => {
    return new Date(date).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const money = (value) => {
    return `Rs. ${Number(value || 0).toFixed(2)}`;
};

export const downloadReceipt = (order) => {

    const pdf = new jsPDF({
        unit: "mm",
        format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    let y = 15;

    // Background

    pdf.setFillColor(...LIGHT);

    pdf.rect(
        0,
        0,
        pageWidth,
        pageHeight,
        "F"
    );

    // White Card

    pdf.setFillColor(...WHITE);

    pdf.roundedRect(
        10,
        10,
        pageWidth - 20,
        pageHeight - 20,
        8,
        8,
        "F"
    );


    // ==============================
    // CAMPUSCRAVES PNG LOGO
    // ==============================

    pdf.addImage(logo, "PNG", 21, 11, 21, 21);

    // ==============================
    // Brand
    // ==============================

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(21);

    // Campus
    pdf.setTextColor(...DARK);
    pdf.text("Campus", 46, 21);

    // Craves
    pdf.setTextColor(...PRIMARY);
    pdf.text("Craves", 77, 21);

    // Subtitle
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(107, 114, 128);

    pdf.text(
        "College Food Ordering Platform",
        46,
        28
    );

    // ===============================
    // SUCCESS BADGE
    // ===============================

    pdf.setFillColor(220, 252, 231);

    pdf.circle(
        pageWidth - 25,
        22,
        9,
        "F"
    );

    pdf.setTextColor(...SUCCESS);

    pdf.setFont("zapfdingbats");

    pdf.setFontSize(18);

    pdf.text(
        "3",
        pageWidth - 28,
        26
    );

    pdf.setFont("helvetica", "normal");

    // ===============================
    // ORDER TITLE
    // ===============================

    y = 42;

    pdf.setFont(
        "helvetica",
        "bold"
    );

    pdf.setFontSize(23);

    pdf.setTextColor(...SUCCESS);

    pdf.text(
        "ORDER CONFIRMED",
        pageWidth / 2,
        y,
        {
            align: "center"
        }
    );

    // ===============================
    // SUB TITLE
    // ===============================

    y += 8;

    pdf.setFont(
        "helvetica",
        "normal"
    );

    pdf.setFontSize(11);

    pdf.setTextColor(...TEXT);

    pdf.text(
        "Your order has been placed successfully.",
        pageWidth / 2,
        y,
        {
            align: "center"
        }
    );

    y += 7;

    pdf.setFontSize(9);

    pdf.setFont("helvetica", "normal");

    pdf.setFontSize(10);

    pdf.setTextColor(...TEXT);

    pdf.text(
        "Thank you for choosing CampusCraves",
        pageWidth / 2,
        y,
        {
            align: "center"
        }
    );

    // ===============================
    // PREMIUM TOKEN CARD
    // ===============================

    y += 12;

    pdf.setFillColor(...PRIMARY);

    pdf.roundedRect(
        20,
        y,
        pageWidth - 40,
        38,
        6,
        6,
        "F"
    );

    pdf.setTextColor(255, 255, 255);

    pdf.setFont(
        "helvetica",
        "normal"
    );

    pdf.setFontSize(11);

    pdf.text(
        "ORDER TOKEN",
        pageWidth / 2,
        y + 10,
        {
            align: "center"
        }
    );

    pdf.setFont(
        "helvetica",
        "bold"
    );

    pdf.setFontSize(30);

    pdf.text(
        `#${String(order.token_number).padStart(2, "0")}`,
        pageWidth / 2,
        y + 26,
        {
            align: "center"
        }
    );

    y += 48;


    // =======================================
    // PREMIUM ORDER DETAILS CARD
    // =======================================

    pdf.setFillColor(248, 250, 252);

    pdf.roundedRect(
        20,
        y,
        pageWidth - 40,
        52,
        5,
        5,
        "F"
    );

    pdf.setDrawColor(...BORDER);

    pdf.roundedRect(
        20,
        y,
        pageWidth - 40,
        52,
        5,
        5
    );

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(...DARK);

    pdf.text(
        "Order Details",
        28,
        y + 10
    );

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);

    const leftX = 28;
    const rightX = 112;

    let rowY = y + 20;

    // LEFT COLUMN

    pdf.setTextColor(...TEXT);
    pdf.text("Order ID", leftX, rowY);

    pdf.setTextColor(...DARK);
    pdf.setFont("helvetica", "bold");
    pdf.text(`#CC${10000 + order.id}`, leftX + 30, rowY);

    rowY += 8;

    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...TEXT);
    pdf.text("Date", leftX, rowY);

    pdf.setTextColor(...DARK);

    pdf.text(
        formatDate(order.created_at),
        leftX + 30,
        rowY
    );

    rowY += 8;

    pdf.setTextColor(...TEXT);
    pdf.text("Payment", leftX, rowY);

    pdf.setTextColor(...DARK);

    pdf.text(
        order.payment_method || "Online",
        leftX + 30,
        rowY
    );

    // RIGHT COLUMN

    let rightY = y + 20;

    pdf.setTextColor(...TEXT);

    pdf.text(
        "Status",
        rightX,
        rightY
    );

    pdf.setTextColor(...SUCCESS);

    pdf.setFont(
        "helvetica",
        "bold"
    );

    pdf.text(
        order.payment_status || "Paid",
        rightX + 28,
        rightY
    );

    rightY += 8;

    pdf.setFont(
        "helvetica",
        "normal"
    );

    pdf.setTextColor(...TEXT);

    pdf.text(
        "Token",
        rightX,
        rightY
    );

    pdf.setTextColor(...PRIMARY);

    pdf.setFont(
        "helvetica",
        "bold"
    );

    pdf.text(
        `#${String(order.token_number).padStart(2, "0")}`,
        rightX + 28,
        rightY
    );

    rightY += 8;

    pdf.setFont(
        "helvetica",
        "normal"
    );

    pdf.setTextColor(...TEXT);

    pdf.text(
        "Pickup",
        rightX,
        rightY
    );

    pdf.setTextColor(...DARK);

    pdf.text(
        "Main Cafeteria",
        rightX + 28,
        rightY
    );

    y += 65;

    // ======================================
    // ORDERED ITEMS
    // ======================================

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.setTextColor(...DARK);

    pdf.text(
        "Ordered Items",
        20,
        y
    );

    y += 10;

    let subtotal = 0;

    order.order_items?.forEach((item) => {

        const itemHeight = 30;

        if (y + itemHeight > pageHeight - 20) {

            pdf.addPage();

            pdf.setFillColor(...LIGHT);
            pdf.rect(0, 0, pageWidth, pageHeight, "F");

            pdf.setFillColor(...WHITE);
            pdf.roundedRect(
                10,
                10,
                pageWidth - 20,
                pageHeight - 20,
                8,
                8,
                "F"
            );

            y = 20;

            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(15);
            pdf.setTextColor(...DARK);

            pdf.text(
                "Ordered Items (Continued)",
                20,
                y
            );

            y += 10;

        }

        const qty = Number(item.quantity || 0);
        const price = Number(item.price_at_time || 0);
        const total = qty * price;

        subtotal += total;

        // Card Background

        pdf.setFillColor(255, 255, 255);

        pdf.roundedRect(
            20,
            y,
            pageWidth - 40,
            24,
            4,
            4,
            "F"
        );

        pdf.setDrawColor(...BORDER);

        pdf.roundedRect(
            20,
            y,
            pageWidth - 40,
            24,
            4,
            4
        );

        // Food Circle

        pdf.setFillColor(...PRIMARY);

        pdf.circle(
            28,
            y + 8,
            3,
            "F"
        );

        // Food Name

        pdf.setFont(
            "helvetica",
            "bold"
        );

        pdf.setFontSize(11);

        pdf.setTextColor(...DARK);

        pdf.text(
            item.food_items?.name || "Food Item",
            35,
            y + 9
        );

        // Qty

        pdf.setFont(
            "helvetica",
            "normal"
        );

        pdf.setFontSize(9);

        pdf.setTextColor(...TEXT);

        pdf.text(
            `Qty : ${qty}`,
            35,
            y + 17
        );

        // Price

        pdf.setFont(
            "helvetica",
            "bold"
        );

        pdf.setFontSize(12);

        pdf.setTextColor(...PRIMARY);

        pdf.text(
            money(total),
            pageWidth - 28,
            y + 13,
            {
                align: "right"
            }
        );

        y += 30;

    });

    // Divider

    // Required space for summary section
    const summaryHeight = 120;

    // Agar summary fit nahi hogi
    if (y + summaryHeight > pageHeight - 20) {

        pdf.addPage();

        pdf.setFillColor(...LIGHT);
        pdf.rect(0, 0, pageWidth, pageHeight, "F");

        pdf.setFillColor(...WHITE);
        pdf.roundedRect(
            10,
            10,
            pageWidth - 20,
            pageHeight - 20,
            8,
            8,
            "F"
        );

        y = 20;

    }

    // =========================================
    // PREMIUM BILL SUMMARY
    // =========================================

    const platformFee = 0;

    const taxes = 0;

    const discount = 0;

    const grandTotal =
        subtotal +
        platformFee +
        taxes -
        discount;

    // CARD

    pdf.setFillColor(248, 250, 252);

    pdf.roundedRect(
        20,
        y,
        pageWidth - 40,
        52,
        5,
        5,
        "F"
    );

    pdf.setDrawColor(...BORDER);

    pdf.roundedRect(
        20,
        y,
        pageWidth - 40,
        52,
        5,
        5
    );

    // TITLE

    pdf.setFont(
        "helvetica",
        "bold"
    );

    pdf.setFontSize(13);

    pdf.setTextColor(...DARK);

    pdf.text(
        "Bill Summary",
        28,
        y + 10
    );

    // SUBTOTAL

    pdf.setFont(
        "helvetica",
        "normal"
    );

    pdf.setFontSize(10);

    pdf.setTextColor(...TEXT);

    pdf.text(
        "Subtotal",
        28,
        y + 22
    );

    pdf.setTextColor(...DARK);

    pdf.text(
        money(subtotal),
        pageWidth - 28,
        y + 22,
        {
            align: "right"
        }
    );

    // PLATFORM

    pdf.setTextColor(...TEXT);

    pdf.text(
        "Platform Fee",
        28,
        y + 30
    );

    pdf.setTextColor(...DARK);

    pdf.text(
        money(platformFee),
        pageWidth - 28,
        y + 30,
        {
            align: "right"
        }
    );

    // TAX

    pdf.setTextColor(...TEXT);

    pdf.text(
        "Taxes",
        28,
        y + 38
    );

    pdf.setTextColor(...DARK);

    pdf.text(
        money(taxes),
        pageWidth - 28,
        y + 38,
        {
            align: "right"
        }
    );

    // DISCOUNT

    pdf.setTextColor(...TEXT);

    pdf.text(
        "Discount",
        28,
        y + 46
    );

    pdf.setTextColor(...SUCCESS);

    pdf.text(
        money(discount),
        pageWidth - 28,
        y + 46,
        {
            align: "right"
        }
    );

    y += 60;

    // =====================================
    // GRAND TOTAL CARD
    // =====================================

    pdf.setFillColor(...PRIMARY);

    pdf.roundedRect(
        20,
        y,
        pageWidth - 40,
        18,
        5,
        5,
        "F"
    );

    pdf.setFont(
        "helvetica",
        "bold"
    );

    pdf.setFontSize(14);

    pdf.setTextColor(255, 255, 255);

    pdf.text(
        "Grand Total",
        28,
        y + 11
    );

    pdf.text(
        money(grandTotal),
        pageWidth - 34,
        y + 11,
        {
            align: "right"
        }
    );

    y += 28;

    // =========================================
    // PICKUP INFORMATION
    // =========================================

    pdf.setFillColor(239, 246, 255);

    pdf.roundedRect(
        20,
        y,
        pageWidth - 40,
        34,
        5,
        5,
        "F"
    );

    pdf.setDrawColor(...PRIMARY);

    pdf.roundedRect(
        20,
        y,
        pageWidth - 40,
        34,
        5,
        5
    );

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(...PRIMARY);

    pdf.text(
        "Pickup Information",
        28,
        y + 10
    );

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(...DARK);

    pdf.text(
        "Pickup : Main Cafeteria",
        28,
        y + 20
    );

    pdf.text(
        "Collect your order when token is ready.",
        28,
        y + 28
    );

    y += 44;

    // =========================================
    // THANK YOU CARD
    // =========================================

    pdf.setFillColor(240, 253, 244);

    pdf.roundedRect(
        20,
        y,
        pageWidth - 40,
        30,
        5,
        5,
        "F"
    );

    pdf.setFont("helvetica", "bold");

    pdf.setFontSize(16);

    pdf.setTextColor(...SUCCESS);

    pdf.text(
        "Thank You!",
        pageWidth / 2,
        y + 12,
        {
            align: "center"
        }
    );

    pdf.setFont("helvetica", "normal");

    pdf.setFontSize(10);

    pdf.setTextColor(...TEXT);

    pdf.text(
        "We hope you enjoy your meal.",
        pageWidth / 2,
        y + 20,
        {
            align: "center"
        }
    );

    y += 40;

    // =========================================
    // FOOTER
    // =========================================

    pdf.setDrawColor(...BORDER);

    pdf.line(
        20,
        y,
        pageWidth - 20,
        y
    );

    y += 8;

    pdf.setFont("helvetica", "bold");

    pdf.setFontSize(16);

    pdf.setTextColor(...PRIMARY);

    pdf.text(
        "CampusCraves",
        pageWidth / 2,
        y,
        {
            align: "center"
        }
    );

    y += 6;

    pdf.setFont("helvetica", "normal");

    pdf.setFontSize(10);

    pdf.setTextColor(...TEXT);

    pdf.text(
        "College Food Ordering Platform",
        pageWidth / 2,
        y,
        {
            align: "center"
        }
    );

    y += 6;

    pdf.text(
        "support@campuscraves.in",
        pageWidth / 2,
        y,
        {
            align: "center"
        }
    );

    y += 6;

    pdf.text(
        "www.campuscraves.in",
        pageWidth / 2,
        y,
        {
            align: "center"
        }
    );

    y += 8;

    pdf.setFontSize(8);

    pdf.setTextColor(160);

    pdf.text(
        `Generated on ${formatDate(new Date())}`,
        pageWidth / 2,
        y,
        {
            align: "center"
        }
    );

    y += 5;

    pdf.text(
        "This is a computer generated receipt.",
        pageWidth / 2,
        y,
        {
            align: "center"
        }
    );

    // ===============================
    // SAVE PDF
    // ===============================

    pdf.save(
        `CampusCraves_Receipt_CC${10000 + order.id}.pdf`
    );

};