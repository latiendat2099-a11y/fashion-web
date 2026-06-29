import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const snsClient = new SNSClient({ region: "ap-southeast-1" });
const sesClient = new SESClient({ region: "ap-southeast-1" });

const SENDER_EMAIL = "latiendat2099@gmail.com"; 

export const handler = async (event) => {
    console.log("=== LAMBDA ĐÃ KÍCH HOẠT THÀNH CÔNG ===");
    
    for (const record of event.Records) {
        try {
            const orderData = JSON.parse(record.body);
            console.log("Đơn hàng nhận từ SQS:", orderData);
            
            const customerName = orderData.customer_name || 'Khách hàng';
            const customerEmail = orderData.email || 'N/A'; 
            const phone = orderData.phone || 'Không có';
            const address = orderData.address || 'Không có';
            const productId = orderData.product_id || 'N/A';
            const quantity = orderData.quantity || 1;
            const totalPrice = orderData.total_price ? orderData.total_price.toLocaleString() : '0';

            // =========================================================
            // 1. GỬI MAIL CHO CHỦ CỬA HÀNG (SNS) - LỊCH SỰ, GỌN GÀNG
            // =========================================================
            const snsMessage = `
Dear The Moon,

Hệ thống vừa ghi nhận một đơn đặt hàng mới từ Website. Vui lòng kiểm tra và xử lý theo quy trình.

[THÔNG TIN KHÁCH HÀNG]
• Họ và tên: ${customerName}
• Email liên hệ: ${customerEmail}
• Số điện thoại: ${phone}
• Địa chỉ giao hàng: ${address}

[CHI TIẾT ĐƠN HÀNG]
• Mã sản phẩm: #${productId}
• Số lượng: ${quantity}
• Tổng giá trị: ${totalPrice} VND

Trân trọng,
Hệ thống Quản lý Đơn hàng - THE MOON
`;

            const snsParams = {
                TopicArn: "arn:aws:sns:ap-southeast-1:054653532752:order-confirmed", 
                Subject: `[THE MOON - HỆ THỐNG] Thông báo đơn hàng mới #${productId} từ ${customerName}`,
                Message: snsMessage
            };
            
            await snsClient.send(new PublishCommand(snsParams));

            // =========================================================
            // 2. GỬI HÓA ĐƠN CHO KHÁCH HÀNG (SES HTML) - CAO CẤP & ĐỒNG BỘ
            // =========================================================
            const sesParams = {
                Source: SENDER_EMAIL, 
                Destination: {
                    ToAddresses: [customerEmail] 
                },
                Message: {
                    Subject: {
                        Data: `[THE MOON] Xác nhận đơn hàng #${productId} thành công`,
                        Charset: "UTF-8"
                    },
                    Body: {
                        Html: {
                            Data: `
                                <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 550px; margin: 0 auto; border: 1px solid #e5e5e5; padding: 40px 30px; color: #222222; background-color: #ffffff;">
                                    
                                    <div style="text-align: center; margin-bottom: 35px; border-bottom: 1px solid #f2f2f2; padding-bottom: 25px;">
                                        <h1 style="font-size: 24px; font-weight: 400; letter-spacing: 5px; text-transform: uppercase; margin: 0 0 5px 0; color: #000000;">THE MOON</h1>
                                        <p style="font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #888888; margin: 0;">Premium Fashion Studio</p>
                                    </div>
                                    
                                    <div style="margin-bottom: 30px;">
                                        <p style="font-size: 14px; line-height: 1.6; margin: 0;">Xin chào <strong>${customerName}</strong>,</p>
                                        <p style="font-size: 14px; line-height: 1.6; margin: 8px 0 0 0; color: #555555;">Cảm ơn bạn đã lựa chọn sản phẩm của chúng tôi. Đơn đặt hàng của bạn đã được tiếp nhận thành công và đang trong quá trình chuẩn bị đóng gói.</p>
                                    </div>
                                    
                                    <div style="background-color: #fcfcfc; padding: 20px 25px; border: 1px solid #f5f5f5; margin-bottom: 30px;">
                                        <h3 style="font-size: 13px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; margin: 0 0 15px 0; color: #000000; border-bottom: 1px solid #eaeaea; padding-bottom: 8px;">Thông tin đơn hàng #${productId}</h3>
                                        <table style="width: 100%; font-size: 13px; line-height: 2;">
                                            <tr>
                                                <td style="color: #777777;">Sản phẩm:</td>
                                                <td style="text-align: right; font-weight: 500; color: #000000;">Mã sản phẩm #${productId}</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #777777;">Số lượng:</td>
                                                <td style="text-align: right; font-weight: 500; color: #000000;">${quantity}</td>
                                            </tr>
                                            <tr style="border-top: 1px solid #eaeaea;">
                                                <td style="padding-top: 10px; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #000000;">Tổng thanh toán:</td>
                                                <td style="padding-top: 10px; text-align: right; font-size: 15px; font-weight: 600; color: #000000;">${totalPrice} VND</td>
                                            </tr>
                                        </table>
                                    </div>
                                    
                                    <div style="font-size: 13px; line-height: 1.6; margin-bottom: 35px; padding-left: 5px;">
                                        <p style="margin: 0 0 6px 0;"><strong style="color: #000000;">Địa chỉ giao hàng:</strong> <span style="color: #555555;">${address}</span></p>
                                        <p style="margin: 0;"><strong style="color: #000000;">Số điện thoại liên lạc:</strong> <span style="color: #555555;">${phone}</span></p>
                                    </div>
                                    
                                    <div style="border-top: 1px solid #f2f2f2; padding-top: 25px; text-align: center;">
                                        <p style="font-size: 13px; color: #000000; margin: 0 0 8px 0; font-weight: 500;">THE MOON STUDIO</p>
                                        <p style="font-size: 11px; color: #999999; margin: 0; line-height: 1.4;">Mọi thắc mắc về đơn hàng, vui lòng liên hệ hotline phản hồi nhanh.<br>Đây là email tự động từ hệ thống, vui lòng không trả lời trực tiếp thư này.</p>
                                    </div>
                                    
                               div>
                            `,
                            Charset: "UTF-8"
                        }
                    }
                }
            };

            await sesClient.send(new SendEmailCommand(sesParams));
            console.log(`👉 Đã gửi mail hóa đơn thành công!`);

        } catch (err) {
            console.error("Lỗi luồng gửi mail:", err);
            throw err; 
        }
    }
    return { statusCode: 200, body: "Xử lý thành công" };
};
