import nodemailer from "nodemailer";

// ------------------- SMTP Setup -------------------
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false, // true for 465, false for others
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ------------------- Helper to send email -------------------
const sendEmail = async ({ to, subject, html, text }) => {
  if (!to) {
    throw new Error("Email recipient is missing");
  }

  try {
    const info = await transporter.sendMail({
      from: `"Tender Management System" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text: text || "",
      html: html || "",
    });
    console.log("Email sent:", info.messageId);
    return info;
  } catch (err) {
    console.error("Error sending email:", err);
    throw new Error("Email could not be sent");
  }
};

// ------------------- Professional HTML Templates -------------------
const templateWrapper = (title, body) => `
  <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0;">
    <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: #ffffff; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 600;">${title}</h1>
    </div>
    <div style="padding: 30px 25px; background-color: #ffffff;">
      ${body}
    </div>
    <div style="padding: 20px 25px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b;">
      <p style="margin: 0;">
        This is an automated message from the Tender Management System.<br>
        Please do not reply to this email. For support, contact our <a href="mailto:support@tendersystem.com" style="color: #1e40af;">help desk</a>.
      </p>
      <p style="margin: 10px 0 0 0;">
        &copy; ${new Date().getFullYear()} Tender Management System. All rights reserved.
      </p>
    </div>
  </div>
`;

// ------------------- Auth Emails with OTP -------------------
export const sendRegisterOTPEmail = async (user, otp) => {
  await sendEmail({
    to: user.email,
    subject: "Account Verification - OTP Code Required",
    html: templateWrapper(
      "Account Verification",
      `<p style="margin: 0 0 20px 0;">Dear ${user.name},</p>
       <p style="margin: 0 0 20px 0;">Thank you for registering with our Tender Management System. To complete your account setup, please verify your email address using the One-Time Password (OTP) below:</p>
       <div style="background-color: #f1f5f9; border-left: 4px solid #1e40af; padding: 20px; margin: 25px 0; text-align: center;">
         <h2 style="margin: 0; color: #1e40af; font-size: 32px; font-weight: bold; letter-spacing: 3px;">${otp}</h2>
       </div>
       <p style="margin: 0 0 20px 0;"><strong>Important:</strong> This verification code will expire in 10 minutes for security purposes.</p>
       <p style="margin: 0 0 20px 0;">If you did not request this verification, please ignore this email or contact our support team immediately.</p>
       <p style="margin: 0;">Best regards,<br>The Tender Management Team</p>`
    ),
  });
};

export const sendResetPasswordOTPEmail = async (user, otp) => {
  await sendEmail({
    to: user.email,
    subject: "Password Reset Request - Verification Required",
    html: templateWrapper(
      "Password Reset Verification",
      `<p style="margin: 0 0 20px 0;">Dear ${user.name},</p>
       <p style="margin: 0 0 20px 0;">We have received a request to reset the password for your account. To proceed with the password reset, please use the verification code below:</p>
       <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 25px 0; text-align: center;">
         <h2 style="margin: 0; color: #dc2626; font-size: 32px; font-weight: bold; letter-spacing: 3px;">${otp}</h2>
       </div>
       <p style="margin: 0 0 20px 0;"><strong>Security Notice:</strong> This verification code will expire in 10 minutes.</p>
       <p style="margin: 0 0 20px 0;">If you did not request a password reset, please ignore this email and ensure your account remains secure. Consider changing your password if you suspect unauthorized access.</p>
       <p style="margin: 0;">Best regards,<br>The Tender Management Team</p>`
    ),
  });
};

// ------------------- Tender Emails -------------------
export const sendTenderCreatedEmail = async (tender) => {
  const creator = tender.createdBy;
  const formattedDeadline = tender.deadline.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  await sendEmail({
    to: creator.email,
    subject: `Tender Publication Confirmation: "${tender.title}"`,
    html: templateWrapper(
      "Tender Successfully Published",
      `<p style="margin: 0 0 20px 0;">Dear ${creator.name},</p>
       <p style="margin: 0 0 20px 0;">We are pleased to confirm that your tender has been successfully published on our platform.</p>
       <div style="background-color: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 6px; padding: 20px; margin: 25px 0;">
         <h3 style="margin: 0 0 15px 0; color: #0369a1;">Tender Details</h3>
         <p style="margin: 0 0 10px 0;"><strong>Title:</strong> ${
           tender.title
         }</p>
         <p style="margin: 0 0 10px 0;"><strong>Submission Deadline:</strong> ${formattedDeadline}</p>
         <p style="margin: 0;"><strong>Budget Range:</strong> ${tender.budgetMin.toLocaleString()} - ${tender.budgetMax.toLocaleString()}</p>
       </div>
       <p style="margin: 0 0 20px 0;">Your tender is now live and visible to qualified bidders. You will receive email notifications when applications are submitted.</p>
       <p style="margin: 0 0 20px 0;">You can monitor and manage your tender applications through your dashboard at any time.</p>
       <p style="margin: 0;">Best regards,<br>The Tender Management Team</p>`
    ),
  });
};

export const sendTenderStatusEmail = async (tender, status) => {
  const creator = tender.createdBy;
  const statusDisplay = status.charAt(0).toUpperCase() + status.slice(1);

  await sendEmail({
    to: creator.email,
    subject: `Tender Status Update: "${tender.title}" - ${statusDisplay}`,
    html: templateWrapper(
      "Tender Status Update",
      `<p style="margin: 0 0 20px 0;">Dear ${creator.name},</p>
       <p style="margin: 0 0 20px 0;">This email confirms that the status of your tender has been updated.</p>
       <div style="background-color: #fffbeb; border: 1px solid #f59e0b; border-radius: 6px; padding: 20px; margin: 25px 0;">
         <p style="margin: 0 0 10px 0;"><strong>Tender:</strong> ${tender.title}</p>
         <p style="margin: 0;"><strong>New Status:</strong> <span style="color: #d97706; font-weight: bold;">${statusDisplay}</span></p>
       </div>
       <p style="margin: 0 0 20px 0;">Please log in to your dashboard to view additional details and manage your tender accordingly.</p>
       <p style="margin: 0;">Best regards,<br>The Tender Management Team</p>`
    ),
  });
};

export const sendTenderNotificationEmail = async (email, tender, type) => {
  let subject = "",
    body = "";
  const typeDisplay = type.charAt(0).toUpperCase() + type.slice(1);

  if (type === "created") {
    subject = `Tender Published: "${tender.title}"`;
    body = `<p style="margin: 0 0 20px 0;">Your tender has been successfully published on our platform.</p>
            <div style="background-color: #f0fdf4; border: 1px solid #22c55e; border-radius: 6px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>Tender Title:</strong> ${
                tender.title
              }</p>
              <p style="margin: 0;"><strong>Submission Deadline:</strong> ${tender.deadline.toLocaleDateString(
                "en-US",
                {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }
              )}</p>
            </div>
            <p style="margin: 0;">Qualified bidders can now view and submit applications for your tender.</p>`;
  } else if (type === "updated") {
    subject = `Tender Modified: "${tender.title}"`;
    body = `<p style="margin: 0 0 20px 0;">The details of your tender have been successfully updated.</p>
            <div style="background-color: #fffbeb; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Updated Tender:</strong> ${tender.title}</p>
            </div>
            <p style="margin: 0;">All changes are now reflected on the platform and visible to potential bidders.</p>`;
  } else if (type === "deleted") {
    subject = `Tender Removed: "${tender.title}"`;
    body = `<div style="background-color: #fef2f2; border: 1px solid #ef4444; border-radius: 6px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Removed Tender:</strong> ${tender.title}</p>
            </div>
            <p style="margin: 0;">This tender has been permanently removed from the platform and is no longer accessible to bidders.</p>`;
  }

  await sendEmail({
    to: email,
    subject,
    html: templateWrapper(
      `Tender ${typeDisplay}`,
      body +
        `<p style="margin: 20px 0 0 0;">For any questions regarding this action, please contact our support team.</p>`
    ),
  });
};

// ------------------- Application Emails -------------------
export const sendApplicationSubmittedEmail = async (application) => {
  const tenderCreator = application.tender.createdBy;
  const bidder = application.bidder;

  await sendEmail({
    to: tenderCreator.email,
    subject: `New Tender Application Received: "${application.tender.title}"`,
    html: templateWrapper(
      "New Application Received",
      `<p style="margin: 0 0 20px 0;">Dear ${tenderCreator.name},</p>
       <p style="margin: 0 0 20px 0;">A new application has been submitted for your tender. Please review the details below:</p>
       <div style="background-color: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 6px; padding: 20px; margin: 25px 0;">
         <h3 style="margin: 0 0 15px 0; color: #0369a1;">Application Details</h3>
         <p style="margin: 0 0 10px 0;"><strong>Tender:</strong> ${
           application.tender.title
         }</p>
         <p style="margin: 0 0 10px 0;"><strong>Applicant:</strong> ${
           bidder.name
         }</p>
         <p style="margin: 0 0 15px 0;"><strong>Bid Amount:</strong> ${application.bidAmount.toLocaleString()}</p>
         <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 15px;">
           <p style="margin: 0 0 5px 0;"><strong>Proposal Message:</strong></p>
           <p style="margin: 0; font-style: italic;">${
             application.message || "No additional message provided"
           }</p>
         </div>
       </div>
       <p style="margin: 0 0 20px 0;">Please log in to your dashboard to review the complete application and take appropriate action.</p>
       <p style="margin: 0;">Best regards,<br>The Tender Management Team</p>`
    ),
  });
};

export const sendApplicationStatusEmail = async (user, application) => {
  const statusFriendly = application.status
    ? application.status.charAt(0).toUpperCase() + application.status.slice(1)
    : "Updated";

  let statusColor = "#6b7280";
  let bgColor = "#f9fafb";

  if (application.status === "approved" || application.status === "accepted") {
    statusColor = "#059669";
    bgColor = "#f0fdf4";
  } else if (
    application.status === "rejected" ||
    application.status === "declined"
  ) {
    statusColor = "#dc2626";
    bgColor = "#fef2f2";
  }

  await sendEmail({
    to: user.email,
    subject: `Application Status Update: "${application.tender.title}" - ${statusFriendly}`,
    html: templateWrapper(
      "Application Status Update",
      `<p style="margin: 0 0 20px 0;">Dear ${user.name},</p>
       <p style="margin: 0 0 20px 0;">We are writing to inform you of an update regarding your tender application.</p>
       <div style="background-color: ${bgColor}; border: 1px solid ${statusColor}; border-radius: 6px; padding: 20px; margin: 25px 0;">
         <h3 style="margin: 0 0 15px 0; color: ${statusColor};">Application Status</h3>
         <p style="margin: 0 0 10px 0;"><strong>Tender:</strong> ${
           application.tender.title
         }</p>
         <p style="margin: 0 0 15px 0;"><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${statusFriendly}</span></p>
         ${
           application.comment
             ? `
         <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 15px;">
           <p style="margin: 0 0 5px 0;"><strong>Review Comments:</strong></p>
           <p style="margin: 0; font-style: italic;">${application.comment}</p>
         </div>`
             : ""
         }
       </div>
       <p style="margin: 0 0 20px 0;">Thank you for your interest and participation in our tender process. Please log in to your dashboard for additional details.</p>
       <p style="margin: 0;">Best regards,<br>The Tender Management Team</p>`
    ),
  });
};

// ------------------- Deadline Reminder Emails -------------------
export const sendTenderDeadlineReminder = async (tender) => {
  const creator = tender.createdBy;
  const formattedDeadline = tender.deadline.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  await sendEmail({
    to: creator.email,
    subject: `Urgent: Tender Deadline Approaching - "${tender.title}"`,
    html: templateWrapper(
      "Tender Deadline Reminder",
      `<p style="margin: 0 0 20px 0;">Dear ${creator.name},</p>
       <p style="margin: 0 0 20px 0;">This is an important reminder that your tender submission deadline is approaching soon.</p>
       <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 20px; margin: 25px 0;">
         <h3 style="margin: 0 0 15px 0; color: #d97706;">⚠️ Deadline Alert</h3>
         <p style="margin: 0 0 10px 0;"><strong>Tender:</strong> ${tender.title}</p>
         <p style="margin: 0;"><strong>Deadline:</strong> <span style="color: #d97706; font-weight: bold;">${formattedDeadline}</span></p>
       </div>
       <p style="margin: 0 0 20px 0;">Please ensure you review all submitted applications and finalize your selection process before the deadline expires.</p>
       <p style="margin: 0 0 20px 0;">Log in to your dashboard to manage applications and extend the deadline if necessary.</p>
       <p style="margin: 0;">Best regards,<br>The Tender Management Team</p>`
    ),
  });
};

export default sendEmail;
