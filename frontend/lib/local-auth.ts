import { User } from '@/types';

const ACCOUNTS_KEY = 'cassanova_accounts';

interface StoredAccount {
  user: User;
  password: string;
}

export interface AuthSession {
  token: string;
  user: User;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
}

function readAccounts(): StoredAccount[] {
  const raw = localStorage.getItem(ACCOUNTS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as StoredAccount[];
  } catch {
    return [];
  }
}

function writeAccounts(accounts: StoredAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function createSession(user: User): AuthSession {
  return { token: `local-${user.id}`, user };
}

export function registerAccount(input: RegisterInput): AuthSession {
  const accounts = readAccounts();
  const email = input.email.trim().toLowerCase();
  const username = input.username.trim();

  if (accounts.some((account) => account.user.email === email)) {
    throw new Error('An account with this email already exists');
  }
  if (accounts.some((account) => account.user.username.toLowerCase() === username.toLowerCase())) {
    throw new Error('This username is already taken');
  }

  const user: User = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
    username,
    email,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    dateOfBirth: input.dateOfBirth,
    balance: 0,
    bonusBalance: 0,
    vipLevel: 'bronze',
    kycStatus: 'pending',
  };

  writeAccounts([...accounts, { user, password: input.password }]);
  return createSession(user);
}

export function loginAccount(email: string, password: string): AuthSession {
  const normalizedEmail = email.trim().toLowerCase();
  const account = readAccounts().find(
    (stored) => stored.user.email === normalizedEmail && stored.password === password,
  );
  if (!account) {
    throw new Error('Invalid email or password');
  }
  return createSession(account.user);
}
