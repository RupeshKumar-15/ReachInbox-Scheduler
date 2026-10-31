import nodemailer from "nodemailer";

async function createEtherealAccount() {
  try {
    const account = await nodemailer.createTestAccount();

    console.log("\nEthereal account created successfully!\n");
    console.log("SMTP Host:", account.smtp.host);
    console.log("SMTP Port:", account.smtp.port);
    console.log("SMTP User:", account.user);
    console.log("SMTP Password:", account.pass);
  } catch (error) {
    console.error("Failed to create Ethereal account:", error);
  }
}

createEtherealAccount();