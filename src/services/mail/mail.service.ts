import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../../config/env';

export interface PasswordResetEmail {
  to: string;
  name: string;
  resetLink: string;
}

export class MailService {
  private transporter: Transporter | null = null;

  async sendPasswordResetEmail({ to, name, resetLink }: PasswordResetEmail): Promise<void> {
    const subject = 'Redefinição de senha - Vagare';
    const html = `
      <p>Olá, ${name}.</p>
      <p>Recebemos uma solicitação para redefinir sua senha no Vagare.</p>
      <p><a href="${resetLink}">Clique aqui para criar uma nova senha</a></p>
      <p>Este link expira em 1 hora. Se você não solicitou essa alteração, ignore este e-mail.</p>
    `;

    if (!env.gmailUser || !env.gmailAppPassword) {
      console.log(`[mail:dev] Reset de senha para ${to}: ${resetLink}`);
      return;
    }

    await this.getTransporter().sendMail({
      from: `"${env.mailFromName}" <${env.gmailUser}>`,
      to,
      subject,
      html,
    });
  }

  private getTransporter(): Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: env.gmailUser,
          pass: env.gmailAppPassword,
        },
      });
    }

    return this.transporter;
  }
}
