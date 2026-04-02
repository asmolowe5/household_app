import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";

const config = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments] ?? PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID!,
      "PLAID-SECRET": process.env.PLAID_SECRET!,
    },
  },
});

export const plaidClient = new PlaidApi(config);

export async function createLinkToken(userId: string) {
  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: "Smolowe Portal",
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: "en",
    webhook: `${process.env.NEXT_PUBLIC_APP_URL}/api/plaid/webhook`,
  });
  return response.data.link_token;
}

export async function exchangePublicToken(publicToken: string) {
  const response = await plaidClient.itemPublicTokenExchange({
    public_token: publicToken,
  });
  return {
    accessToken: response.data.access_token,
    itemId: response.data.item_id,
  };
}

export async function syncTransactions(accessToken: string, cursor?: string | null) {
  const allAdded: any[] = [];
  const allModified: any[] = [];
  const allRemoved: any[] = [];
  let hasMore = true;
  let nextCursor = cursor ?? undefined;

  while (hasMore) {
    const response = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor: nextCursor,
    });

    allAdded.push(...response.data.added);
    allModified.push(...response.data.modified);
    allRemoved.push(...response.data.removed);
    hasMore = response.data.has_more;
    nextCursor = response.data.next_cursor;
  }

  return {
    added: allAdded,
    modified: allModified,
    removed: allRemoved,
    cursor: nextCursor,
  };
}

export async function getAccounts(accessToken: string) {
  const response = await plaidClient.accountsGet({
    access_token: accessToken,
  });
  return response.data.accounts;
}
