import test from 'tape'
import { Connection, Transaction } from '@safecoin/web3.js'
import {
  createInitializeInstruction,
  createUpdateInstruction,
  MyAccount,
} from '../src/'
import {
  Amman,
  assertConfirmedTransaction,
  assertTransactionSummary,
  LOCALHOST,
} from '@metaplex-foundation/amman'

const idl = require('../idl/basic_1.json')

;(function killStuckProcess() {
  test.onFinish(() => process.exit(0))
})()

const amman = Amman.instance({
  knownLabels: { basic1: idl.metadata.address },
  log: console.log,
})

async function initialize() {
  const [payer, payerKeypair] = await amman.genLabeledKeypair('payer')
  const [myAccount, myAccountKeypair] = await amman.genLabeledKeypair(
    'myAccount'
  )
  const connection = new Connection(LOCALHOST, 'confirmed')
  const transactionHandler = amman.payerTransactionHandler(
    connection,
    payerKeypair
  )

  await amman.airdrop(connection, payer, 2)

  const ix = createInitializeInstruction(
    {
      user: payer,
      myAccount,
    },
    { data: 1 }
  )
  const tx = new Transaction().add(ix)
  const res = await transactionHandler.sendAndConfirmTransaction(tx, [
    myAccountKeypair,
  ])
  return {
    res,
    connection,
    payer,
    payerKeypair,
    myAccount,
    myAccountKeypair,
    transactionHandler,
  }
}

test('initialize', async (t) => {
  const { res, connection, myAccount } = await initialize()

  assertConfirmedTransaction(t, res.txConfirmed)
  assertTransactionSummary(t, res.txSummary, {
    msgRx: [/instruction: initialize/i, /success/],
  })

  const accountInfo = await connection.getAccountInfo(myAccount)
  const [account] = MyAccount.fromAccountInfo(accountInfo!)

  t.equal(
    account.data.toString(),
    '1',
    'initializes account with provided data'
  )
})

test('update', async (t) => {
  const { connection, myAccount, transactionHandler } = await initialize()

  const ix = createUpdateInstruction({ myAccount }, { data: 2 })
  const tx = new Transaction().add(ix)
  const res = await transactionHandler.sendAndConfirmTransaction(tx, [])

  assertConfirmedTransaction(t, res.txConfirmed)
  assertTransactionSummary(t, res.txSummary, {
    msgRx: [/instruction: update/i, /success/],
  })

  const accountInfo = await connection.getAccountInfo(myAccount)
  const [account] = MyAccount.fromAccountInfo(accountInfo!)

  t.equal(account.data.toString(), '2', 'updates account with provided data')
})
