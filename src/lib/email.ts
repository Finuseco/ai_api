
import nodemailer from 'nodemailer';

interface MailOptions {
    to: string;
    subject: string;
    html: string;
}

export async function sendMail({ to, subject, html }: MailOptions) {
    try {
        if(!process.env.SMTP_HOST||!process.env.SMTP_USER||!process.env.SMTP_PASSWORD)throw new Error('SMTP non configuré.');
        const transporter=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||465),secure:Number(process.env.SMTP_PORT||465)===465,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD},tls:{rejectUnauthorized:true}});
        await transporter.sendMail({
            from: `"CashPay Elite Studio" <${process.env.SMTP_USER || 'noreply@cashpay-all.com'}>`,
            to,
            subject,
            html,
        });
        return { success: true };
    } catch (error) {
        console.error('[EMAIL SERVICE] Send Error:', error);
        return { success: false, error };
    }
}

export const emailTemplates = {
    projectInvitation: (name: string, inviter: string, projectName: string) => `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
            <div style="background-color: #000e38; padding: 30px; text-align: center;">
                <img src="https://www.cashpay-all.com/logos/logo.png" alt="JOJO AI" style="height: 35px;" />
            </div>
            <div style="padding: 30px;">
                <h1 style="color: #000e38; font-size: 20px; margin-bottom: 10px;">Invitation Elite Studio</h1>
                <p style="color: #4b5563; font-size: 14px;">Bonjour <strong>${name}</strong>,</p>
                <p style="color: #4b5563; font-size: 14px;"><strong>${inviter}</strong> vous invite à collaborer sur l'architecture : <strong>${projectName}</strong>.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="http://localhost:8090" style="background-color: #8a2be2; color: #ffffff; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 12px; text-transform: uppercase;">Rejoindre le Projet</a>
                </div>
                <p style="color: #94a3b8; font-size: 11px; text-align: center;">Veuillez vous connecter à votre compte Elite pour accepter l'invitation.</p>
            </div>
        </div>
    `,
    otp: (name: string, code: string) => `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
            <div style="background-color: #000e38; padding: 30px; text-align: center;">
                <img src="https://www.cashpay-all.com/logos/logo.png" alt="CashPay" style="height: 35px;" />
            </div>
            <div style="padding: 30px;">
                <h1 style="color: #000e38; font-size: 20px; margin-bottom: 10px;">Code de Sécurité Elite</h1>
                <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-radius: 12px; margin: 25px 0;">
                    <span style="font-family: monospace; font-size: 32px; font-weight: 900; color: #000e38; letter-spacing: 6px;">${code}</span>
                </div>
            </div>
        </div>
    `
};
