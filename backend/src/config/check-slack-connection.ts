import prisma from "./prisma";

async function checkSlackConnection() {
  try {
    const connections = await prisma.slackConnection.findMany({
      select: {
        userId: true,
        teamId: true,
        teamName: true,
        connected: true,
        updatedAt: true,
      },
    });

    console.log("Slack connections:", connections);
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSlackConnection();