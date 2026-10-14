/**
 * Creates (or promotes) an ADMIN account.
 *
 * Usage (run inside the backend folder):
 *   node create-admin.js admin@yourmail.com "YourStrongPassword" "Admin Name"
 *
 * Use a DIFFERENT email from your teacher account. If the email already exists,
 * its role is changed to ADMIN and its password is replaced.
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

async function main() {
  const [email, password, name = "LUCOUS Admin"] = process.argv.slice(2);

  if (!email || !password) {
    console.error('Usage: node create-admin.js <email> "<password>" ["Admin Name"]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const hashed = await bcrypt.hash(password, 10);

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      await prisma.user.update({
        where: { email: normalizedEmail },
        data: { role: "ADMIN", password: hashed, isVerified: true },
      });
      console.log(`Updated ${normalizedEmail} -> role ADMIN.`);
    } else {
      await prisma.user.create({
        data: { name, email: normalizedEmail, password: hashed, role: "ADMIN", isVerified: true },
      });
      console.log(`Created admin ${normalizedEmail}.`);
    }
    console.log("Log in at /auth/admin/login");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
