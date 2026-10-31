
import elasticsearch from "../config/elasticsearch";
import prisma from "../config/prisma";

const INDEX_NAME = "reachinbox-emails";

export async function initializeEmailIndex() {
  const exists = await elasticsearch.indices.exists({
    index: INDEX_NAME,
  });

  if (!exists) {
    await elasticsearch.indices.create({
      index: INDEX_NAME,
      mappings: {
        properties: {
          emailId: { type: "keyword" },
          userId: { type: "keyword" },
          recipient: { type: "text" },
          subject: { type: "text" },
          body: { type: "text" },
          createdAt: { type: "date" },
        },
      },
    });
  }

  console.log("Elasticsearch email index ready.");
}

export async function indexEmail(emailId: string) {
  const email = await prisma.email.findUnique({
    where: { id: emailId },
    include: {
      sender: {
        select: { userId: true },
      },
    },
  });

  if (!email) return;

  await elasticsearch.index({
    index: INDEX_NAME,
    id: email.id,
    document: {
      emailId: email.id,
      userId: email.sender.userId,
      recipient: email.recipient,
      subject: email.subject,
      body: email.body,
      createdAt: email.createdAt,
    },
  });
}

export async function searchEmailIds(userId: string, query: string) {
  const result = await elasticsearch.search({
    index: INDEX_NAME,
    query: {
      bool: {
        filter: [{ term: { userId } }],
        must: [
          {
            multi_match: {
              query,
              fields: ["recipient", "subject", "body"],
              fuzziness: "AUTO",
            },
          },
        ],
      },
    },
    size: 1000,
  });

  return result.hits.hits
    .map((hit) => hit._id)
    .filter((id): id is string => Boolean(id));
}
