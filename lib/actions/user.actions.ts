'use server'
import { cookies } from "next/headers";
import { encryptId, extractCustomerIdFromUrl, parseStringify } from "../utils";
import { createAdminClient, createSessionClient } from "../appwrite";
import { ID } from "node-appwrite";
import { CountryCode, ProcessorTokenCreateRequest, ProcessorTokenCreateRequestProcessorEnum, Products } from "plaid";
import { plaidClient } from "../plaid";
import { revalidatePath } from "next/cache";
import { addFundingSource, createDwollaCustomer } from "./dwolla.actions";

const {
    APPWRITE_DATABASE_ID: DATABASE_ID,
    APPWRITE_USER_COLLECTION_ID: USER_COLLECTION_ID,
    APPWRITE_BANK_COLLECTION_ID: BANK_COLLECTION_ID
} = process.env;

export const signIn = async ({ email, password }: signInProps) => {
    try {
        const { account } = await createAdminClient();
        const session = await account.createEmailPasswordSession(email, password);
        
        const cookieStore = await cookies();
        cookieStore.set("appwrite-session", session.secret, { 
            path: "/", 
            httpOnly: true, 
            sameSite: "strict", 
            secure: true, 
        });

        return parseStringify(session);
    } catch (error: any) {
        console.error("Error signing in", error);
        return { error: error.message || "Failed to sign in" };
    }
}

export const signUp = async ({ password, ...userData }: SignUpParams) => {
    const { email, firstName, lastName } = userData;
    
    try {
        const { account, database } = await createAdminClient();
        
        const newUserAccount = await account.create(
            ID.unique(),
            email,
            password,
            `${firstName} ${lastName}`
        );

        if (!newUserAccount) throw new Error('Error creating Appwrite user account');

        const dwollaCustomerUrl = await createDwollaCustomer({ ...userData, type: 'personal' });
        if (!dwollaCustomerUrl) throw new Error("Error creating Dwolla Customer");

        const dwollaCustomerId = extractCustomerIdFromUrl(dwollaCustomerUrl);

       const newUser = await database.createDocument(
    DATABASE_ID!,
    USER_COLLECTION_ID!,
    ID.unique(),
    {
        ...userData,
        userId: newUserAccount.$id,
        dwollaCustomerId,
        dwollaCustomerUrl
    }
);

const session = await account.createEmailPasswordSession(email, password);
const cookieStore = await cookies();
cookieStore.set("appwrite-session", session.secret, {
    path: "/",
    httpOnly: true,
    sameSite: "strict",
    secure: true,
});

// Ensure you are returning the created database document!
return parseStringify(newUser);
    } catch (error: any) {
        console.error('Error in signUp action:', error);
        return { error: error.message || "Failed to sign up" };
    }
}

export async function getLoggedInUser() {
    try {
        const sessionClient = await createSessionClient();
        if (!sessionClient) return null;
        
        const { account } = sessionClient;
        const user = await account.get();
        
        return parseStringify(user);
    } catch (error) {
        console.log("Error getting logged-in user", error);
        return null;
    }
}

export const logoutAccount = async () => {
    try {
        const { account } = await createSessionClient();
        (await cookies()).delete('appwrite-session');
        await account.deleteSession('current');
        return { success: true };
    } catch (error) {
        console.log("Error during logout", error);
        return null;
    }
}

export const createLinkToken = async (user: any) => {
    try {
        // Debug log to see exactly what object structure is being passed from the frontend
        console.log("DEBUG PlaidLink User Object:", user);

        // Safely extract the ID checking common Appwrite / custom object layers
        const userId = user?.$id || user?.userId || user?.id || (user?.documents && user.documents[0]?.$id);
        
        if (!userId) {
            console.error("CRITICAL: Plaid link token creation blocked. Object received keys:", Object.keys(user || {}));
            throw new Error("Cannot create link token: Missing valid user ID.");
        }

        const tokenParams = {
            user: { 
                client_user_id: userId 
            },
            client_name: `${user.firstName || 'Guest'} ${user.lastName || 'User'}`,
            products: ['auth'] as Products[],
            language: 'en',
            country_codes: ['US'] as CountryCode[],
        };

        const response = await plaidClient.linkTokenCreate(tokenParams);
        return parseStringify({ linkToken: response.data.link_token });
    } catch (error: any) {
        if (error.response && error.response.data) {
            console.error("Plaid API Error Details:", error.response.data);
        } else {
            console.error("Error creating link token:", error);
        }
        return null;
    }
}


export const createBankAccount = async ({ userId, bankId, accountId, accessToken, fundingSourceUrl, sharableId }: createBankAccountProps) => {
    try {
        const { database } = await createAdminClient();
        const bankAccount = await database.createDocument(
            DATABASE_ID!,
            BANK_COLLECTION_ID!,
            ID.unique(),
            { userId, bankId, accountId, accessToken, fundingSourceUrl, sharableId }
        );
        return parseStringify(bankAccount);
    } catch (error) {
        console.log("Error creating bank account document", error);
        return null;
    }
}

export const exchangePublicToken = async ({ publicToken, user }: exchangePublicTokenProps) => {
    try {
        const response = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
        const accessToken = response.data.access_token;
        const itemId = response.data.item_id;
        
        const accountResponse = await plaidClient.accountsGet({ access_token: accessToken });
        const accountData = accountResponse.data.accounts[0];
        
        const request: ProcessorTokenCreateRequest = {
            access_token: accessToken,
            account_id: accountData.account_id,
            processor: "dwolla" as ProcessorTokenCreateRequestProcessorEnum
        };
        
        const processorTokenResponse = await plaidClient.processorTokenCreate(request);
        const processorToken = processorTokenResponse.data.processor_token;
        
        const fundingSourceUrl = await addFundingSource({
            dwollaCustomerId: user.dwollaCustomerId,
            processorToken,
            bankName: accountData.name
        });
        
        if (!fundingSourceUrl) throw new Error("Failed to create Dwolla funding source");
        
        await createBankAccount({
            userId: user.$id,
            bankId: itemId,
            accountId: accountData.account_id,
            accessToken,
            fundingSourceUrl,
            sharableId: encryptId(accountData.account_id),
        });
        
        revalidatePath("/");
        return parseStringify({ publicTokenExchange: "complete" });
    } catch (error) {
        console.log("Error exchanging public token", error);
        return null;
    }
}
