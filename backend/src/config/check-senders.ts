import prisma from "./prisma";

async function checkSenders() {
  try {
    const senders = await prisma.sender.findMany({
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    console.log("Senders found:", senders.length);

    senders.forEach((sender) => {
      console.log({
        id: sender.id,
        senderEmail: sender.email,
        userEmail: sender.user.email,
        isActive: sender.isActive,
      });
    });
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSenders();