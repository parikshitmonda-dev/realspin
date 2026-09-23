import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

// 1. Approve Coin Request
export const approveCoinRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const adminUid = context.auth.uid;
  const adminEmail = context.auth.token.email || '';
  const { requestId } = data;

  if (!requestId) {
    throw new functions.https.HttpsError('invalid-argument', 'requestId is required.');
  }

  // Verify caller is admin
  const adminDoc = await db.collection('users').doc(adminUid).get();
  const isAdmin = adminDoc.data()?.role === 'admin' || adminEmail === 'parikshitmonda@gmail.com';
  if (!isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Only administrators can approve coin requests.');
  }

  return await db.runTransaction(async (transaction) => {
    const requestRef = db.collection('coin_requests').doc(requestId);
    const requestSnap = await transaction.get(requestRef);

    if (!requestSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Request not found.');
    }

    const requestData = requestSnap.data()!;
    if (requestData.status !== 'PENDING') {
      throw new functions.https.HttpsError('failed-precondition', 'Only pending requests can be approved.');
    }

    const userRef = db.collection('users').doc(requestData.userId);
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'User profile not found.');
    }

    const userData = userSnap.data()!;
    const balanceBefore = Number(userData.balance || 0);
    const creditAmount = Number(requestData.requestedAmount || 0);
    const balanceAfter = balanceBefore + creditAmount;

    // Update Request
    transaction.update(requestRef, {
      status: 'APPROVED',
      reviewedBy: adminEmail || adminUid,
      reviewedAt: Date.now(),
    });

    // Credit User Wallet
    transaction.update(userRef, {
      balance: balanceAfter,
      updatedAt: Date.now(),
    });

    // Create Ledger Entry
    const ledgerRef = db.collection('ledger').doc();
    transaction.set(ledgerRef, {
      id: ledgerRef.id,
      userId: requestData.userId,
      userName: requestData.userName || userData.fullName || 'Player',
      userMobile: requestData.userMobile || userData.mobileNumber || '',
      type: 'ADMIN_CREDIT',
      amount: creditAmount,
      balanceBefore,
      balanceAfter,
      description: 'Virtual coins added after admin approval.',
      referenceId: requestId,
      createdAt: Date.now(),
      createdBy: adminEmail || adminUid,
    });

    // Admin Activity Log
    const logRef = db.collection('admin_logs').doc();
    transaction.set(logRef, {
      id: logRef.id,
      adminUid,
      adminEmail,
      action: 'APPROVE_COIN_REQUEST',
      targetUserId: requestData.userId,
      details: `Approved ${creditAmount} virtual coins for request ${requestId}. Balance: ${balanceBefore} -> ${balanceAfter}`,
      createdAt: Date.now(),
    });

    return { success: true, balanceAfter };
  });
});

// 2. Reject Coin Request
export const rejectCoinRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const adminUid = context.auth.uid;
  const adminEmail = context.auth.token.email || '';
  const { requestId, reason } = data;

  if (!requestId) {
    throw new functions.https.HttpsError('invalid-argument', 'requestId is required.');
  }

  const adminDoc = await db.collection('users').doc(adminUid).get();
  const isAdmin = adminDoc.data()?.role === 'admin' || adminEmail === 'parikshitmonda@gmail.com';
  if (!isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Only administrators can reject coin requests.');
  }

  return await db.runTransaction(async (transaction) => {
    const requestRef = db.collection('coin_requests').doc(requestId);
    const requestSnap = await transaction.get(requestRef);

    if (!requestSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Request not found.');
    }

    const requestData = requestSnap.data()!;
    if (requestData.status !== 'PENDING') {
      throw new functions.https.HttpsError('failed-precondition', 'Only pending requests can be rejected.');
    }

    // Status updated to REJECTED, wallet remains unchanged!
    transaction.update(requestRef, {
      status: 'REJECTED',
      adminReason: reason || 'Request rejected by administrator.',
      reviewedBy: adminEmail || adminUid,
      reviewedAt: Date.now(),
    });

    // Admin Activity Log
    const logRef = db.collection('admin_logs').doc();
    transaction.set(logRef, {
      id: logRef.id,
      adminUid,
      adminEmail,
      action: 'REJECT_COIN_REQUEST',
      targetUserId: requestData.userId,
      details: `Rejected coin request ${requestId}. Reason: ${reason || 'None provided'}`,
      createdAt: Date.now(),
    });

    return { success: true };
  });
});

// 3. Place Bet
export const placeBet = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to bet.');
  }

  const uid = context.auth.uid;
  const { roundId, selectedColor, amount } = data;
  const betAmount = Number(amount);

  if (!roundId || !selectedColor || !betAmount || betAmount <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid bet parameters.');
  }

  return await db.runTransaction(async (transaction) => {
    const roundRef = db.collection('rounds').doc(roundId);
    const roundSnap = await transaction.get(roundRef);

    if (!roundSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Round not found.');
    }

    const roundData = roundSnap.data()!;
    if (roundData.status !== 'BETTING_OPEN') {
      throw new functions.https.HttpsError('failed-precondition', 'Betting is closed for this round.');
    }

    const userRef = db.collection('users').doc(uid);
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'User profile not found.');
    }

    const userData = userSnap.data()!;
    const balance = Number(userData.balance || 0);

    if (balance <= 0) {
      throw new functions.https.HttpsError('failed-precondition', 'NO_COINS_AVAILABLE');
    }

    if (balance < betAmount) {
      throw new functions.https.HttpsError('failed-precondition', 'INSUFFICIENT_BALANCE');
    }

    const balanceAfter = balance - betAmount;

    // Deduct user balance
    transaction.update(userRef, {
      balance: balanceAfter,
      updatedAt: Date.now(),
    });

    // Create Bet record
    const betRef = db.collection('bets').doc();
    transaction.set(betRef, {
      id: betRef.id,
      roundId,
      userId: uid,
      userName: userData.fullName || 'Player',
      userMobile: userData.mobileNumber || '',
      selectedColor,
      amount: betAmount,
      status: 'PLACED',
      createdAt: Date.now(),
    });

    // Create Ledger record
    const ledgerRef = db.collection('ledger').doc();
    transaction.set(ledgerRef, {
      id: ledgerRef.id,
      userId: uid,
      userName: userData.fullName || 'Player',
      userMobile: userData.mobileNumber || '',
      type: 'BET_DEBIT',
      amount: -betAmount,
      balanceBefore: balance,
      balanceAfter,
      description: `Bet placed on ${selectedColor} (Round #${roundData.roundNumber || roundId})`,
      referenceId: roundId,
      createdAt: Date.now(),
    });

    // Increment round bet counter
    transaction.update(roundRef, {
      totalBetsCount: admin.firestore.FieldValue.increment(1),
      totalCoinsBet: admin.firestore.FieldValue.increment(betAmount),
    });

    return { success: true, balanceAfter, betId: betRef.id };
  });
});

// 4. Gift Coins
export const giftCoins = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const senderUid = context.auth.uid;
  const { recipientMobile, amount, message } = data;
  const giftAmount = Number(amount);

  if (!recipientMobile || !giftAmount || giftAmount <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid gift parameters.');
  }

  // Find recipient by mobile number
  const recipientQuery = await db.collection('users').where('mobileNumber', '==', recipientMobile.trim()).limit(1).get();
  if (recipientQuery.empty) {
    throw new functions.https.HttpsError('not-found', 'Recipient mobile number not registered.');
  }

  const recipientDoc = recipientQuery.docs[0];
  const recipientUid = recipientDoc.id;

  if (recipientUid === senderUid) {
    throw new functions.https.HttpsError('invalid-argument', 'Cannot gift coins to yourself.');
  }

  return await db.runTransaction(async (transaction) => {
    const senderRef = db.collection('users').doc(senderUid);
    const recipientRef = db.collection('users').doc(recipientUid);

    const [senderSnap, recipientSnap] = await Promise.all([
      transaction.get(senderRef),
      transaction.get(recipientRef),
    ]);

    const senderData = senderSnap.data()!;
    const recipientData = recipientSnap.data()!;

    const senderBalance = Number(senderData.balance || 0);
    if (senderBalance < giftAmount) {
      throw new functions.https.HttpsError('failed-precondition', 'Insufficient coin balance to gift.');
    }

    const senderBalanceAfter = senderBalance - giftAmount;
    const recipientBalance = Number(recipientData.balance || 0);
    const recipientBalanceAfter = recipientBalance + giftAmount;

    transaction.update(senderRef, { balance: senderBalanceAfter, updatedAt: Date.now() });
    transaction.update(recipientRef, { balance: recipientBalanceAfter, updatedAt: Date.now() });

    // Sender Ledger
    const senderLedgerRef = db.collection('ledger').doc();
    transaction.set(senderLedgerRef, {
      id: senderLedgerRef.id,
      userId: senderUid,
      userName: senderData.fullName || 'Sender',
      userMobile: senderData.mobileNumber || '',
      type: 'GIFT_SENT',
      amount: -giftAmount,
      balanceBefore: senderBalance,
      balanceAfter: senderBalanceAfter,
      description: `Gift sent to ${recipientData.fullName || recipientMobile}: "${message || 'Enjoy!'}"`,
      referenceId: recipientUid,
      createdAt: Date.now(),
    });

    // Recipient Ledger
    const recipientLedgerRef = db.collection('ledger').doc();
    transaction.set(recipientLedgerRef, {
      id: recipientLedgerRef.id,
      userId: recipientUid,
      userName: recipientData.fullName || 'Recipient',
      userMobile: recipientData.mobileNumber || '',
      type: 'GIFT_RECEIVED',
      amount: giftAmount,
      balanceBefore: recipientBalance,
      balanceAfter: recipientBalanceAfter,
      description: `Gift received from ${senderData.fullName || senderData.mobileNumber}: "${message || 'Enjoy!'}"`,
      referenceId: senderUid,
      createdAt: Date.now(),
    });

    return { success: true, senderBalanceAfter };
  });
});
