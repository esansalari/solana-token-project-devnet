// File: create-token.js
import { Connection, Keypair, PublicKey, clusterApiUrl, sendAndConfirmTransaction, Transaction } from '@solana/web3.js';
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import bs58 from 'bs58';
import { createInterface } from 'readline';
import { promisify } from 'util';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = promisify(rl.question).bind(rl);

// Token details
const TOKEN_NAME = "ClickScore";
const TOKEN_SYMBOL = "CLS";
const TOKEN_DESCRIPTION = "ClickScore token on Solana devnet";
const TOKEN_DECIMALS = 9;
const TOKEN_AMOUNT = 10000000000000000000n; // 10 billion with 9 decimal places

function createKeypairFromSecretKey(secretKeyString) {
  console.log("Received secret key string length:", secretKeyString.length);
  
  let secretKey;
  try {
    secretKey = bs58.decode(secretKeyString);
    console.log("Successfully decoded as base58. Decoded length:", secretKey.length);
  } catch (e) {
    console.log("Failed to decode as base58, attempting JSON parse.");
    try {
      secretKey = Uint8Array.from(JSON.parse(secretKeyString));
      console.log("Successfully parsed as JSON. Array length:", secretKey.length);
    } catch (jsonError) {
      console.log("Failed to parse as JSON.");
      throw new Error("Invalid secret key format. Please provide a valid base58 string or JSON array.");
    }
  }

  if (secretKey.length !== 32 && secretKey.length !== 64) {
    console.log("Unexpected secret key length:", secretKey.length);
    throw new Error("Invalid secret key length. Expected 32 or 64 bytes.");
  }

  if (secretKey.length === 32) {
    console.log("Expanding 32-byte key to 64 bytes");
    const fullSecretKey = new Uint8Array(64);
    fullSecretKey.set(secretKey);
    secretKey = fullSecretKey;
  }

  const keypair = Keypair.fromSecretKey(secretKey);
  console.log("Keypair created successfully. Public key:", keypair.publicKey.toBase58());
  return keypair;
}

async function createToken(secretKeyString) {
  try {
    console.log("Creating wallet from secret key...");
    const fromWallet = createKeypairFromSecretKey(secretKeyString);
    if (!fromWallet || !fromWallet.publicKey) {
      throw new Error("Failed to create wallet. Invalid keypair.");
    }
    console.log("Wallet public key:", fromWallet.publicKey.toBase58());

    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    console.log("Connected to devnet");

    console.log("Creating token mint...");
    const mint = await createMint(
      connection,
      fromWallet,
      fromWallet.publicKey,
      fromWallet.publicKey,
      TOKEN_DECIMALS
    );
    console.log("Token mint created:", mint.toBase58());

    console.log("Getting or creating token account...");
    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      fromWallet,
      mint,
      fromWallet.publicKey
    );
    console.log("Token account:", fromTokenAccount.address.toBase58());

    console.log("Minting tokens...");
    const signature = await mintTo(
      connection,
      fromWallet,
      mint,
      fromTokenAccount.address,
      fromWallet.publicKey,
      TOKEN_AMOUNT
    );
    console.log("Minting signature:", signature);

    console.log("Token creation process completed successfully.");
    console.log('Token Mint Address:', mint.toBase58());
    console.log('Token Account Address:', fromTokenAccount.address.toBase58());

    const balance = await connection.getTokenAccountBalance(fromTokenAccount.address);
    console.log('Token Balance:', balance.value.uiAmount);

  } catch (error) {
    console.error("An error occurred:", error);
    if (error instanceof Error) {
      console.error("Error stack:", error.stack);
    }
  }
}

async function main() {
  try {
    const secretKey = await question('Please enter your wallet secret key: ');
    await createToken(secretKey.trim());
  } catch (error) {
    console.error("An error occurred in the main function:", error);
  } finally {
    rl.close();
  }
}

main().catch(console.error);