import { Transaction, User } from '@/types';

export const MOCK_TOKEN = 'mock-local-token';

export const MOCK_USER: User = {
  id: 'mock-user-1',
  username: 'player1',
  email: 'player1@example.com',
  firstName: 'Alex',
  lastName: 'Morgan',
  balance: 1250.75,
  bonusBalance: 75.0,
  vipLevel: 'silver',
  kycStatus: 'verified',
};

const now = Date.now();
const daysAgo = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();

export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    _id: 'tx-1',
    userId: MOCK_USER.id,
    type: 'deposit',
    amount: 500,
    status: 'completed',
    paymentMethod: 'Credit/Debit Card',
    balanceBefore: 0,
    balanceAfter: 500,
    description: 'Deposit via Credit/Debit Card',
    createdAt: daysAgo(6),
  },
  {
    _id: 'tx-2',
    userId: MOCK_USER.id,
    type: 'bet',
    amount: 25,
    status: 'completed',
    balanceBefore: 500,
    balanceAfter: 475,
    description: 'Bet on Mega Fortune',
    createdAt: daysAgo(5),
  },
  {
    _id: 'tx-3',
    userId: MOCK_USER.id,
    type: 'win',
    amount: 180.5,
    status: 'completed',
    balanceBefore: 475,
    balanceAfter: 655.5,
    description: 'Win on Book of Dead',
    createdAt: daysAgo(4),
  },
  {
    _id: 'tx-4',
    userId: MOCK_USER.id,
    type: 'withdrawal',
    amount: 100,
    status: 'pending',
    paymentMethod: 'Bank Transfer',
    balanceBefore: 655.5,
    balanceAfter: 555.5,
    description: 'Withdrawal via Bank Transfer',
    createdAt: daysAgo(2),
  },
  {
    _id: 'tx-5',
    userId: MOCK_USER.id,
    type: 'deposit',
    amount: 750,
    status: 'completed',
    paymentMethod: 'Cryptocurrency',
    balanceBefore: 555.5,
    balanceAfter: 1305.5,
    description: 'Deposit via Cryptocurrency',
    createdAt: daysAgo(1),
  },
  {
    _id: 'tx-6',
    userId: MOCK_USER.id,
    type: 'bet',
    amount: 55,
    status: 'failed',
    balanceBefore: 1305.5,
    balanceAfter: 1305.5,
    description: 'Bet on Gonzo\'s Quest',
    createdAt: daysAgo(0),
  },
];
