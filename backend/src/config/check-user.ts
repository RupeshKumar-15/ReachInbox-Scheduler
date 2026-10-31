import prisma from "./prisma";

async function checkUser() {
  try {
    const user = await prisma.user.findUnique({
      where: {
        email: "test@example.com",
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    console.log("Database user:", user);
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();