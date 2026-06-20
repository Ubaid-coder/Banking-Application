'use server'

import { cookies } from "next/headers";
import { parseStringify } from "../utils";
import { createAdminClient, createSessionClient } from "../appwrite";
import { ID } from "node-appwrite";

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
  } catch (error) {
    console.error("Error", error);
  }
}

export const signUp = async ({ password, ...userData }: SignUpParams) => {
  const { email, firstName, lastName } = userData;

  let newUserAccount;

  try {
    const { account } = await createAdminClient();

    newUserAccount = await account.create(
      ID.unique(),
      email,
      password,
      `${firstName} ${lastName}`
    );

    if (!newUserAccount) throw new Error('Error creating user')


    const cookieStore = await cookies();

    const session = await account.createEmailPasswordSession(email, password);
    cookieStore.set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: true,
    });

    return parseStringify(newUserAccount);
  } catch (error) {
    console.error('Error', error);
  }
}

export async function getLoggedInUser() {
  try {
    const sessionClient = await createSessionClient();

    // If no session exists, safely return null instead of crashing
    if (!sessionClient) return null;

    const { account } = sessionClient;
    const user = await account.get();

    return parseStringify(user)
  } catch (error) {
    console.log(error)
  }
}

export const logoutAccount = async () => {
  try {
    const { account } = await createSessionClient();

    (await cookies()).delete('appwrite-session');
    await account.deleteSession('current');
  } catch (error) {
    return null;
  }
}